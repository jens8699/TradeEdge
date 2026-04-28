import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { sb, dbToTrade, dbToPayout, tradeToDb, payoutToDb, fetchSignedUrls } from '../lib/supabase';
import { mergeChecklistTags, setChecklistTag } from '../lib/checklistTags';
import { mergeCritiques, clearCritique } from '../lib/tradeCritiques';
import { mergeViolations, clearViolations } from '../lib/ruleViolations';
import { uid, computeStats } from '../lib/utils';

const AppContext = createContext(null);

// ── Offline Queue helpers ────────────────────────────────────────────────────
const OQ_KEY = 'te_offline_queue';
function oqGet()    { try { return JSON.parse(localStorage.getItem(OQ_KEY) || '[]'); } catch(e) { return []; } }
function oqSet(q)   { localStorage.setItem(OQ_KEY, JSON.stringify(q)); }
function oqAdd(item){ const q = oqGet(); q.push({ ...item, queuedAt: new Date().toISOString() }); oqSet(q); }

async function syncOfflineQueue(userId) {
  const q = oqGet();
  if (!q.length) return 0;
  const remaining = [];
  for (const item of q) {
    try {
      if (item.type === 'trade') {
        if (item.action === 'insert') {
          const data = { ...item.data };
          // Handle base64 image upload
          if (data.image && data.image.startsWith('data:')) {
            try {
              const res = await fetch(data.image);
              const blob = await res.blob();
              const ext = blob.type.includes('png') ? 'png' : 'jpg';
              const filePath = `${userId}/${Date.now()}.${ext}`;
              const { error: upErr } = await sb.storage.from('trade-screenshots').upload(filePath, blob, { contentType: blob.type });
              data.image = upErr ? null : filePath;
            } catch(e) { data.image = null; }
          }
          await sb.from('trades').insert([data]);
        } else if (item.action === 'delete') {
          await sb.from('trades').delete().eq('id', item.id);
        } else if (item.action === 'update') {
          await sb.from('trades').update(item.data).eq('id', item.data.id);
        }
      } else if (item.type === 'payout') {
        if (item.action === 'insert') await sb.from('payouts').insert([item.data]);
        else if (item.action === 'delete') await sb.from('payouts').delete().eq('id', item.id);
      }
    } catch(e) {
      remaining.push(item);
    }
  }
  oqSet(remaining);
  return q.length - remaining.length;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ userId, children }) {
  const [trades,   setTrades]   = useState([]);
  const [payouts,  setPayouts]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [syncPending, setSyncPending] = useState(() => oqGet().length > 0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [theme, setTheme] = useState(() => localStorage.getItem('te_theme') || 'dark');

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('te_theme', next);
    // Persist to Supabase profile
    if (userId && navigator.onLine) {
      try { await sb.from('profiles').update({ theme: next }).eq('id', userId); } catch(e) {}
    }
  }, [theme, userId]);

  // Initial data load
  const load = useCallback(async (uid_) => {
    setLoading(true);
    try {
      const [{ data: t }, { data: p }, { data: profileData }] = await Promise.all([
        sb.from('trades').select('*').eq('user_id', uid_).order('date', { ascending: false }),
        sb.from('payouts').select('*').eq('user_id', uid_).order('date', { ascending: false }),
        sb.from('profiles').select('theme').eq('id', uid_).single(),
      ]);
      const tradeListRaw = (t || []).map(dbToTrade);
      const tradeList    = mergeViolations(mergeCritiques(mergeChecklistTags(tradeListRaw)));
      const payoutList   = (p || []).map(dbToPayout);
      await fetchSignedUrls(tradeList);
      setTrades(tradeList);
      setPayouts(payoutList);
      // Restore theme from profile if available
      if (profileData?.theme && !localStorage.getItem('te_theme')) {
        setTheme(profileData.theme);
        localStorage.setItem('te_theme', profileData.theme);
      }
    } catch(e) {
      console.warn('Load error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userId) load(userId);
  }, [userId, load]);

  // Online/offline handlers
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const q = oqGet();
      if (q.length > 0) {
        setSyncPending(true);
        const synced = await syncOfflineQueue(userId);
        if (synced > 0) await load(userId);
        setSyncPending(oqGet().length > 0);
      }
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userId, load]);

  // Manual sync trigger
  const doSync = useCallback(async () => {
    if (!userId) return;
    setSyncPending(true);
    const synced = await syncOfflineQueue(userId);
    if (synced > 0) await load(userId);
    setSyncPending(oqGet().length > 0);
  }, [userId, load]);

  // ── Auto-sync public profile stats whenever trades change ──────────────────
  // Debounced 2s — keeps profiles.trade_count / win_rate / total_pnl fresh so
  // followers see live numbers. Silently no-op for users who haven't set
  // is_public=true (the update will succeed but isn't visible in Discover).
  useEffect(() => {
    if (!userId) return;
    if (loading) return; // avoid syncing the empty initial state
    if (!navigator.onLine) return;
    const handle = setTimeout(async () => {
      try {
        const s = computeStats(trades);
        await sb.from('profiles').update({
          trade_count: s.count,
          win_rate:    s.winRate,
          total_pnl:   s.totalPnl,
        }).eq('id', userId);
      } catch (e) {
        // Migration may not have been run yet — silently ignore "column not found"
        if (!String(e?.message || '').includes('column')) {
          console.warn('Public stats sync failed:', e);
        }
      }
    }, 2000);
    return () => clearTimeout(handle);
  }, [trades, userId, loading]);

  // ── Trade CRUD ──────────────────────────────────────────────────────────────

  const addTrade = useCallback(async (trade) => {
    const t = { ...trade, id: trade.id || uid(), createdAt: trade.createdAt || new Date().toISOString() };
    if (!navigator.onLine) {
      const dbData = tradeToDb(t, userId);
      if (trade._pendingImage) dbData.image = trade._pendingImage;
      oqAdd({ type: 'trade', action: 'insert', data: dbData });
      setTrades(prev => [t, ...prev]);
      setSyncPending(true);
      return { ok: true, offline: true };
    }
    const { error } = await sb.from('trades').insert([tradeToDb(t, userId)]);
    if (error) return { ok: false, error: error.message };
    setTrades(prev => [t, ...prev]);
    return { ok: true };
  }, [userId]);

  const deleteTrade = useCallback(async (tradeId) => {
    const trade = trades.find(t => t.id === tradeId);
    setTrades(prev => prev.filter(t => t.id !== tradeId));
    if (!navigator.onLine) {
      oqAdd({ type: 'trade', action: 'delete', id: tradeId });
      setSyncPending(true);
      return;
    }
    await sb.from('trades').delete().eq('id', tradeId);
    // Remove screenshot from storage
    if (trade?.image && !trade.image.startsWith('data:')) {
      sb.storage.from('trade-screenshots').remove([trade.image]).catch(() => {});
    }
    // Clean up side-tables so they don't grow forever
    setChecklistTag(tradeId, null);
    clearCritique(tradeId);
    clearViolations(tradeId);
  }, [trades]);

  const updateTrade = useCallback(async (updated) => {
    setTrades(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (!navigator.onLine) {
      oqAdd({ type: 'trade', action: 'update', data: tradeToDb(updated, userId) });
      setSyncPending(true);
      return { ok: true, offline: true };
    }
    const { error } = await sb.from('trades').update(tradeToDb(updated, userId)).eq('id', updated.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, [userId]);

  // ── Payout CRUD ─────────────────────────────────────────────────────────────

  const addPayout = useCallback(async (payout) => {
    const p = { ...payout, id: uid(), createdAt: new Date().toISOString() };
    if (!navigator.onLine) {
      oqAdd({ type: 'payout', action: 'insert', data: payoutToDb(p, userId) });
      setPayouts(prev => [p, ...prev]);
      setSyncPending(true);
      return { ok: true, offline: true };
    }
    const { error } = await sb.from('payouts').insert([payoutToDb(p, userId)]);
    if (error) return { ok: false, error: error.message };
    setPayouts(prev => [p, ...prev]);
    return { ok: true };
  }, [userId]);

  const deletePayout = useCallback(async (payoutId) => {
    setPayouts(prev => prev.filter(p => p.id !== payoutId));
    if (!navigator.onLine) {
      oqAdd({ type: 'payout', action: 'delete', id: payoutId });
      setSyncPending(true);
      return;
    }
    await sb.from('payouts').delete().eq('id', payoutId);
  }, []);

  // ── Export / Import ─────────────────────────────────────────────────────────

  const exportData = useCallback(() => {
    const data = { trades, payouts, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `tradeedge-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [trades, payouts]);

  const importData = useCallback(async (file) => {
    const text     = await file.text();
    const imported = JSON.parse(text);
    const its = Array.isArray(imported.trades)  ? imported.trades  : Array.isArray(imported) ? imported : [];
    const ips = Array.isArray(imported.payouts) ? imported.payouts : [];
    if (its.length) {
      const rows = its.map(t => tradeToDb({ ...t, image: null }, userId));
      await sb.from('trades').upsert(rows, { onConflict: 'id' });
    }
    if (ips.length) {
      const rows = ips.map(p => payoutToDb(p, userId));
      await sb.from('payouts').upsert(rows, { onConflict: 'id' });
    }
    await load(userId);
  }, [userId, load]);

  const offlineQueueCount = oqGet().length;

  return (
    <AppContext.Provider value={{
      trades, payouts, userId, loading, activeTab, setActiveTab,
      syncPending, isOnline, offlineQueueCount,
      theme, toggleTheme,
      load, addTrade, deleteTrade, updateTrade,
      addPayout, deletePayout,
      exportData, importData, doSync,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
