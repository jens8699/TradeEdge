import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { sb, dbToTrade, dbToPayout, tradeToDb, payoutToDb, fetchSignedUrls } from '../lib/supabase';
import { mergeChecklistTags, setChecklistTag } from '../lib/checklistTags';
import { mergeCritiques, clearCritique } from '../lib/tradeCritiques';
import { mergeViolations, clearViolations } from '../lib/ruleViolations';
import {
  mergeTradeAccounts,
  dbToAccount,
  accountToDb,
  migrateLocalStorageToSupabase,
} from '../lib/tradeAccounts';
import { uid, computeStats, dataUrlToBlob } from '../lib/utils';

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
          // Handle base64 image upload — direct conversion (CSP blocks
          // fetch() on data: URIs, so we decode the base64 ourselves).
          if (data.image && data.image.startsWith('data:')) {
            try {
              const blob = dataUrlToBlob(data.image);
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
  // Prop firm accounts (TopStep $50k, Apex $100k, …) and the trade↔account
  // side-table. Both moved from localStorage to Supabase 2026-05-06 so users
  // see the same data across devices/browsers. Owned here so every consumer
  // (PropFirmTracker, TradeEntry, History) reads the same instance.
  const [propFirmAccounts, setPropFirmAccounts] = useState([]);
  const [accountTags,      setAccountTags]      = useState({}); // { tradeId: accountId }
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

  // Initial data load. Order matters:
  //   1. Migrate any legacy localStorage prop-firm-accounts/tags to Supabase
  //      (idempotent — no-op for already-migrated users or fresh installs)
  //   2. Fetch trades, payouts, accounts, tags, profile in parallel
  //   3. Build the in-memory accountTags map (used by mergeTradeAccounts)
  const load = useCallback(async (uid_) => {
    setLoading(true);
    try {
      // 1. One-time migration. Runs on every load but no-ops once cleared.
      await migrateLocalStorageToSupabase(uid_);

      // 2. Parallel fetch.
      const [
        { data: t },
        { data: p },
        { data: accs },
        { data: tags },
        { data: profileData },
      ] = await Promise.all([
        sb.from('trades').select('*').eq('user_id', uid_).order('date', { ascending: false }),
        sb.from('payouts').select('*').eq('user_id', uid_).order('date', { ascending: false }),
        sb.from('prop_firm_accounts').select('*').eq('user_id', uid_).order('created_at', { ascending: true }),
        sb.from('trade_account_tags').select('trade_id, account_id').eq('user_id', uid_),
        sb.from('profiles').select('theme').eq('id', uid_).single(),
      ]);

      // 3. Build the tag map for mergeTradeAccounts.
      const tagMap = {};
      for (const row of (tags || [])) tagMap[row.trade_id] = row.account_id;

      const tradeListRaw = (t || []).map(dbToTrade);
      const tradeList    = mergeTradeAccounts(
        mergeViolations(mergeCritiques(mergeChecklistTags(tradeListRaw))),
        tagMap,
      );
      const payoutList   = (p || []).map(dbToPayout);
      const accountList  = (accs || []).map(dbToAccount);

      await fetchSignedUrls(tradeList);
      setTrades(tradeList);
      setPayouts(payoutList);
      setPropFirmAccounts(accountList);
      setAccountTags(tagMap);

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
    // Account tag side-table is now in Supabase — delete the row + local map.
    sb.from('trade_account_tags').delete().eq('trade_id', tradeId).then(() => {});
    setAccountTags(prev => {
      if (!(tradeId in prev)) return prev;
      const next = { ...prev };
      delete next[tradeId];
      return next;
    });
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

  // ── Prop Firm Account CRUD ──────────────────────────────────────────────────
  // Optimistic UI updates — local state changes immediately, Supabase write
  // happens in the background. On failure we roll back and surface the error
  // so the caller can show a toast.

  const addPropFirmAccount = useCallback(async (account) => {
    if (!userId) return { ok: false, error: 'No user' };
    setPropFirmAccounts(prev => [...prev, account]);
    const { error } = await sb.from('prop_firm_accounts').insert([accountToDb(account, userId)]);
    if (error) {
      setPropFirmAccounts(prev => prev.filter(a => a.id !== account.id));
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }, [userId]);

  const updatePropFirmAccount = useCallback(async (account) => {
    if (!userId) return { ok: false, error: 'No user' };
    let prevSnapshot = null;
    setPropFirmAccounts(prev => {
      prevSnapshot = prev;
      const idx = prev.findIndex(a => a.id === account.id);
      if (idx < 0) return [...prev, account];
      const next = [...prev];
      next[idx] = account;
      return next;
    });
    const { error } = await sb
      .from('prop_firm_accounts')
      .update(accountToDb(account, userId))
      .eq('id', account.id);
    if (error) {
      if (prevSnapshot) setPropFirmAccounts(prevSnapshot);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }, [userId]);

  const deletePropFirmAccount = useCallback(async (id) => {
    if (!userId) return { ok: false, error: 'No user' };
    let prevSnapshot = null;
    setPropFirmAccounts(prev => {
      prevSnapshot = prev;
      return prev.filter(a => a.id !== id);
    });
    const { error } = await sb.from('prop_firm_accounts').delete().eq('id', id);
    if (error) {
      if (prevSnapshot) setPropFirmAccounts(prevSnapshot);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }, [userId]);

  // ── Trade↔Account tag CRUD ──────────────────────────────────────────────────
  // `null`/empty accountId clears the tag (deletes the row).

  const setTradeAccountTag = useCallback(async (tradeId, accountId) => {
    if (!userId || !tradeId) return { ok: false, error: 'Missing input' };

    // Optimistic local update first.
    setAccountTags(prev => {
      const next = { ...prev };
      if (accountId) next[tradeId] = accountId;
      else delete next[tradeId];
      return next;
    });
    // Mirror onto the trades array so consumers re-render with the new tag.
    setTrades(prev => prev.map(t => {
      if (t.id !== tradeId) return t;
      const { accountId: _drop, ...rest } = t;
      return accountId ? { ...rest, accountId } : rest;
    }));

    if (accountId) {
      const { error } = await sb
        .from('trade_account_tags')
        .upsert({ trade_id: tradeId, user_id: userId, account_id: accountId }, { onConflict: 'trade_id' });
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await sb
        .from('trade_account_tags')
        .delete()
        .eq('trade_id', tradeId);
      if (error) return { ok: false, error: error.message };
    }
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
      // Cross-device prop firm accounts + trade tags (Supabase-backed).
      propFirmAccounts, accountTags,
      addPropFirmAccount, updatePropFirmAccount, deletePropFirmAccount,
      setTradeAccountTag,
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
