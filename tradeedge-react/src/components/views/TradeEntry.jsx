import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { sb } from '../../lib/supabase';
import { setChecklistTag } from '../../lib/checklistTags';
import { checkAgainst as checkRules } from '../../lib/tradingRules';
import { setViolations as persistViolations } from '../../lib/ruleViolations';
import { formatAccountLabel } from '../../lib/tradeAccounts';
import { calcPnlFromPrices, isKnownFuturesSymbol } from '../../lib/futuresMath';
import { extractTradeFromScreenshot } from '../../lib/screenshotExtract';
import { dataUrlToBlob } from '../../lib/utils';

const DRAFT_KEY = 'te_trade_draft';
const CHECKLIST_SESSION_KEY = 'te_checklist_session';

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d.riskPer && !d.notes && !d.pnl) return null;
    return d;
  } catch(e) { return null; }
}

function today() { return new Date().toISOString().slice(0, 10); }

// Read today's checklist pass status. Returns true if passed today, false otherwise.
function isChecklistPassedToday() {
  try {
    const raw = localStorage.getItem(CHECKLIST_SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    return s.date === today();
  } catch { return false; }
}

// Default setup suggestions. Users can type anything they want — these just
// give them a head start in the autocomplete dropdown.
const DEFAULT_SETUPS = [
  'Breakout', 'Pullback', 'Reversal', 'Range', 'Trend continuation',
  'News play', 'Gap fill', 'VWAP', 'Support/Resistance',
  'FVG entry', 'ICT BoS', 'Opening drive', 'Liquidity sweep',
];
const SESSION_LIST = ['', 'Sydney', 'Tokyo', 'London', 'New York', 'Premarket', 'After Hours'];
const RATINGS = ['A', 'B', 'C', 'D'];
const RATING_LABELS = { A: 'Perfect execution', B: 'Good trade', C: 'Average', D: 'Poor execution' };
const RATING_COLORS = { A: '#E07A3B', B: '#A89687', C: '#EFC97A', D: '#F09595' };

// Default symbol hints for users who haven't logged anything yet. The user's
// own history (frequency-sorted) is mixed in on top of these.
const DEFAULT_SYMBOLS = [
  // Index futures
  'ES', 'NQ', 'YM', 'RTY', 'MES', 'MNQ', 'MYM', 'M2K',
  // Other futures
  'CL', 'GC', 'SI', 'NG', 'ZB', 'ZN',
  // Forex
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'GBP/JPY',
  // Stocks
  'SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'META',
  // Crypto
  'BTC/USD', 'ETH/USD',
];

export default function TradeEntry({ showToast }) {
  const {
    userId, trades, addTrade, setActiveTab,
    propFirmAccounts, setTradeAccountTag,
  } = useApp();

  // Setup suggestions = defaults + every distinct setup the user has used
  // before, frequency-sorted (their most-used setups float to the top).
  const setupSuggestions = (() => {
    const counts = new Map();
    for (const t of trades) {
      const s = (t.setup || '').trim();
      if (!s) continue;
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    const userSetups = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
    // Merge: user setups first (frequency-sorted), then defaults not already in the list
    const seen = new Set(userSetups.map(s => s.toLowerCase()));
    const merged = [...userSetups];
    for (const s of DEFAULT_SETUPS) {
      if (!seen.has(s.toLowerCase())) merged.push(s);
    }
    return merged;
  })();

  // Symbol suggestions — same shape as setups: user history first
  // (frequency-sorted, most-used floats to the top), then defaults.
  const symbolSuggestions = (() => {
    const counts = new Map();
    for (const t of trades) {
      const s = (t.symbol || '').trim().toUpperCase();
      if (!s) continue;
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    const userSymbols = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([sym]) => sym);
    const seen = new Set(userSymbols.map(s => s.toUpperCase()));
    const merged = [...userSymbols];
    for (const s of DEFAULT_SYMBOLS) {
      if (!seen.has(s.toUpperCase())) merged.push(s);
    }
    return merged;
  })();
  // Re-read checklist status whenever this view mounts and on window focus.
  const [checklistPassedToday, setChecklistPassedToday] = useState(isChecklistPassedToday);
  useEffect(() => {
    const refresh = () => setChecklistPassedToday(isChecklistPassedToday());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const [form, setForm] = useState({
    date: today(), symbol: '', direction: 'long', accounts: 1,
    riskPer: '', rewardPer: '', outcome: 'win', pnl: '', setup: '', notes: '',
    entry: '', exit: '', qty: '', session: '', rating: '',
    accountId: '', // PropFirmTracker account this trade was placed on (optional)
  });

  // Prop firm accounts available for the dropdown — read from AppContext
  // (Supabase-backed). No window listeners needed; context updates re-render
  // this component automatically when accounts change anywhere in the app.
  const propAccounts = propFirmAccounts;
  const [pendingImage, setPendingImage]       = useState(null);
  const [previewSrc,   setPreviewSrc]         = useState(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [saveMsg, setSaveMsg]                 = useState('');
  const [isDragOver, setIsDragOver]           = useState(false);
  // Screenshot AI extract — Claude vision parses a broker screenshot and
  // pre-fills the form (symbol / direction / entry / exit / qty / pnl / etc.).
  const [extracting, setExtracting]           = useState(false);
  const [extractMsg, setExtractMsg]           = useState('');
  const [showDailyLoss, setShowDailyLoss]     = useState(false);
  const [dailyLossMsg, setDailyLossMsg]       = useState('');
  const fileRef = useRef(null);

  // Restore draft on mount
  useEffect(() => {
    const d = loadDraft();
    if (d) { setForm(f => ({ ...f, ...d })); setShowDraftBanner(true); }
  }, []);

  // Auto-save draft
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form]);

  // Check daily loss
  useEffect(() => {
    const limit = parseFloat(localStorage.getItem('te_daily_loss_limit') || '0');
    if (!limit) { setShowDailyLoss(false); return; }
    const iso = today();
    const todayPnl = trades.filter(t => t.date === iso).reduce((s, t) => s + t.pnl, 0);
    if (todayPnl <= -limit) {
      setShowDailyLoss(true);
      setDailyLossMsg(`Daily loss limit of $${limit.toLocaleString(undefined,{minimumFractionDigits:2})} reached. Today's P/L: $${todayPnl.toLocaleString(undefined,{minimumFractionDigits:2})}`);
    } else {
      setShowDailyLoss(false);
    }
  }, [trades]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const preview = (() => {
    const risk = parseFloat(form.riskPer) || 0;
    const reward = parseFloat(form.rewardPer) || 0;
    const accounts = parseInt(form.accounts) || 1;
    if (!risk && !reward) return null;
    const totalRisk = risk * accounts;
    const totalReward = reward * accounts;
    const rr = risk > 0 ? (reward / risk).toFixed(2) : '—';
    // Compute what pnl WILL be saved
    const manualPnl = String(form.pnl).trim();
    let expectedPnl;
    if (manualPnl === '') {
      if (form.outcome === 'win') expectedPnl = totalReward;
      else if (form.outcome === 'loss') expectedPnl = -totalRisk;
      else expectedPnl = 0;
    } else {
      expectedPnl = parseFloat(manualPnl) || 0;
    }
    return { totalRisk, totalReward, rr, accounts, expectedPnl };
  })();

  // Live rule violations — recomputes as the form changes.
  const ruleViolations = (() => {
    const iso = today();
    const todayList = trades.filter(t => t.date === iso);
    const todayPnl = todayList.reduce((s, t) => s + (t.pnl || 0), 0);
    return checkRules({
      todayPnl,
      todayTradeCount: todayList.length,
      tradeRisk:  preview ? preview.totalRisk   : 0,
      tradeReward: preview ? preview.totalReward : 0,
    });
  })();

  const handleFile = useCallback((file) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1200;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        setPendingImage(dataUrl); setPreviewSrc(dataUrl);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  // Paste-from-clipboard support — paste a screenshot directly into the form.
  // Skips when the user is actively typing in an input/textarea (so pasting
  // text into the notes field still works as expected).
  useEffect(() => {
    function onPaste(e) {
      const target = e.target;
      const tag = target?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
      const items = e.clipboardData?.items;
      if (!items) return;
      // Find an image item; ignore the rest
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          // Only swallow the paste event if it actually has an image
          if (!isEditable || !e.clipboardData.getData('text')) {
            e.preventDefault();
          }
          const file = item.getAsFile();
          if (file) {
            handleFile(file);
            try {
              showToast?.('Screenshot pasted', 'success', 2000);
            } catch {}
          }
          return;
        }
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFile, showToast]);

  // Run Claude vision on the uploaded screenshot and pre-fill form fields
  // from the result. Always shows a toast on success/failure so the user
  // knows what just happened — silent fills feel like magic-but-spooky.
  const extractFromScreenshot = useCallback(async () => {
    if (extracting) return;
    if (!pendingImage) return;
    setExtracting(true);
    setExtractMsg('');
    try {
      const result = await extractTradeFromScreenshot(pendingImage);
      if (result?.error) {
        setExtractMsg(result.error);
        showToast?.(result.error, 'warn', 3500);
        return;
      }
      // Map AI fields → form fields. Only overwrite empty/default fields so
      // we don't blow away anything the user already typed.
      setForm(f => {
        const next = { ...f };
        if (result.symbol && !f.symbol)       next.symbol    = String(result.symbol).toUpperCase();
        if (result.direction)                  next.direction = /short/i.test(result.direction) ? 'short' : 'long';
        if (result.entry  && !f.entry)         next.entry     = String(result.entry);
        if (result.exit   && !f.exit)          next.exit      = String(result.exit);
        if (result.qty    && !f.qty)           next.qty       = String(result.qty);
        if (Number.isFinite(result.pnl) && !f.pnl) next.pnl   = String(result.pnl);
        if (result.date   && !f.date)          next.date      = result.date;
        if (result.session && !f.session)      next.session   = result.session;
        if (result.notes && !f.notes)          next.notes     = result.notes;
        // Outcome is inferable from PnL.
        if (Number.isFinite(result.pnl) && !f.outcome) {
          next.outcome = result.pnl >= 0 ? 'win' : 'loss';
        }
        return next;
      });
      const filled = Object.keys(result).filter(k => k !== 'error').length;
      showToast?.(`Pre-filled ${filled} field${filled === 1 ? '' : 's'} from screenshot`, 'success', 3500);
    } catch (e) {
      const msg = e.message || 'Could not extract trade from screenshot.';
      setExtractMsg(msg);
      showToast?.(msg, 'error', 4000);
    } finally {
      setExtracting(false);
    }
  }, [pendingImage, extracting, showToast]);

  const save = async () => {
    const { date, symbol, direction, accounts, riskPer, rewardPer, outcome, setup, notes } = form;

    // Three valid ways to determine P&L — try them in order of user intent:
    //   1. User typed a manual P&L value (most explicit)
    //   2. Entry + Exit + Qty filled with a known futures symbol (auto-calc)
    //   3. Risk per account + outcome (the original R:R workflow)
    // Any one of these is enough to save the trade. We don't force users
    // through the R:R path anymore — that was the friction Jens flagged
    // when prepping the demo video.
    const accounts_   = parseInt(accounts) || 1;
    const riskPer_    = parseFloat(riskPer) || 0;
    const rewardPer_  = parseFloat(rewardPer) || 0;
    const totalRisk   = riskPer_ * accounts_;
    const totalReward = rewardPer_ * accounts_;

    const manualPnlNum = parseFloat(form.pnl);
    const hasManualPnl = !isNaN(manualPnlNum);
    const autoCalcPnl  = calcPnlFromPrices({
      symbol, entry: form.entry, exit: form.exit, qty: form.qty, direction,
    });

    // Validation — list everything missing so users know exactly what to fix.
    const missing = [];
    if (!date)                   missing.push('date');
    if (!symbol)                 missing.push('symbol');
    if (parseInt(accounts) < 1)  missing.push('account count');
    const hasPnlPath = hasManualPnl || autoCalcPnl != null || riskPer_ > 0;
    if (!hasPnlPath && missing.length === 0) {
      missing.push('P&L (or risk per account, or entry + exit + qty)');
    }
    if (missing.length) {
      setSaveMsg(missing.length === 1
        ? `Missing: ${missing[0]}`
        : `Missing: ${missing.join(', ')}`);
      setTimeout(() => setSaveMsg(''), 4000);
      return;
    }

    // Resolve final P&L: manual > auto-calc > risk-derived.
    let pnl;
    if (hasManualPnl) {
      pnl = manualPnlNum;
    } else if (autoCalcPnl != null) {
      pnl = autoCalcPnl;
    } else {
      if (outcome === 'win')       pnl = totalReward;
      else if (outcome === 'loss') pnl = -totalRisk;
      else                         pnl = 0;
    }
    setSaving(true); setSaveMsg('Saving…');

    // Upload screenshot
    let imagePath = null;
    let imageUrl  = null;
    const tradeId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    if (pendingImage && userId) {
      try {
        // Don't use fetch() on the data URL — CSP blocks it. Convert directly.
        const blob = dataUrlToBlob(pendingImage);
        const filePath = `${userId}/${tradeId}.jpg`;
        const { error: upErr } = await sb.storage.from('trade-screenshots').upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });
        if (!upErr) {
          imagePath = filePath;
          const { data: signed } = await sb.storage.from('trade-screenshots').createSignedUrl(filePath, 3600);
          if (signed) imageUrl = signed.signedUrl;
        }
      } catch(e) { console.warn('Screenshot upload error:', e); }
    }

    // Tag the trade with whether the day's pre-trade checklist was passed.
    // Only tag if the trade's date is today — backdated trades stay null/unknown.
    const checklistPassed = (date === today())
      ? isChecklistPassedToday()
      : null;

    const trade = {
      id: tradeId, date, symbol: symbol.trim().toUpperCase(), direction, accounts: accounts_,
      riskPer: riskPer_, rewardPer: rewardPer_, risk: totalRisk, reward: totalReward,
      outcome, pnl, setup, notes: notes.trim(), image: imagePath, imageUrl,
      _pendingImage: pendingImage && !imagePath ? pendingImage : null,
      entry:   form.entry   ? parseFloat(form.entry)  : null,
      exit:    form.exit    ? parseFloat(form.exit)   : null,
      qty:     form.qty     ? parseInt(form.qty)      : null,
      session: form.session || null,
      rating:  form.rating  || null,
      checklistPassed,
      // Tag immediately so PropFirmTracker / Stats see this trade tied to the
      // chosen account WITHOUT needing a page reload (the side-table localStorage
      // tag below is the persistent backup that survives reloads). Field is
      // ignored by tradeToDb / Supabase — purely client-side until a real
      // schema migration lands in Phase 3.
      accountId: form.accountId || null,
    };

    const result = await addTrade(trade);
    setSaving(false);
    if (!result.ok) { setSaveMsg('Save failed: ' + result.error); return; }
    // Persist the checklist tag locally (no Supabase column for this yet).
    if (checklistPassed === true || checklistPassed === false) {
      setChecklistTag(tradeId, checklistPassed);
    }
    // Persist which prop firm account this trade was placed on. Now stored
    // in Supabase (`trade_account_tags`) so it follows the user across
    // devices. Fire-and-forget — failures only matter for the next page load.
    if (form.accountId) {
      setTradeAccountTag(tradeId, form.accountId);
    }
    // Stamp any active rule violations so Stats can show adherence over time.
    if (ruleViolations && ruleViolations.length > 0) {
      persistViolations(tradeId, ruleViolations);
    }
    showToast(imagePath ? 'Trade saved with screenshot' : result.offline ? 'Saved offline — syncs when back online' : 'Trade saved', result.offline ? 'warn' : 'success', result.offline ? 4000 : 3000);
    setSaveMsg('');
    // Reset form — also reset outcome so it never carries over to the next trade
    setForm(f => ({ ...f, riskPer: '', rewardPer: '', pnl: '', notes: '', setup: '', outcome: 'win', entry: '', exit: '', qty: '', session: '', rating: '' }));
    setPendingImage(null); setPreviewSrc(null);
    localStorage.removeItem(DRAFT_KEY);
    setShowDraftBanner(false);
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setForm({ date: today(), symbol: '', direction: 'long', accounts: 1, riskPer: '', rewardPer: '', outcome: 'win', pnl: '', setup: '', notes: '', entry: '', exit: '', qty: '', session: '', rating: '', accountId: '' });
    setShowDraftBanner(false);
    setPendingImage(null); setPreviewSrc(null);
  };

  // ── Shared input style ──────────────────────────────────────────────────────
  const inp = {
    width: '100%', padding: '10px 13px', borderRadius: 10, fontSize: 14,
    background: 'var(--c-surface)', border: '1px solid var(--c-border)',
    color: 'var(--c-text)', outline: 'none', fontFamily: "'Inter', sans-serif",
    fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  const label = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-text-2)', display: 'block', marginBottom: 7 };
  const field = { display: 'flex', flexDirection: 'column' };
  const hr = { height: 1, background: 'var(--c-border)', margin: '28px 0' };

  // Auto-calculated P&L from entry + exit + qty for known futures contracts.
  // Computed every render so the UI reflects what the user is typing live.
  // Returns null if symbol isn't a known futures contract or any input is
  // missing — UI then falls back to the manual / risk-reward path.
  const autoCalcPnlPreview = calcPnlFromPrices({
    symbol:    form.symbol,
    entry:     form.entry,
    exit:      form.exit,
    qty:       form.qty,
    direction: form.direction,
  });
  const isAutoCalcSymbol = isKnownFuturesSymbol(form.symbol);

  const outcomeActive = (v) => ({
    flex: 1, padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600,
    fontFamily: "'Inter', sans-serif", cursor: 'pointer', transition: 'all 0.15s',
    border: form.outcome === v
      ? `1.5px solid ${v === 'win' ? 'var(--c-accent)' : '#C65A45'}`
      : '1.5px solid var(--c-border)',
    background: form.outcome === v
      ? v === 'win' ? 'rgba(224,122,59,0.1)' : 'rgba(198,90,69,0.1)'
      : 'transparent',
    color: form.outcome === v
      ? v === 'win' ? 'var(--c-accent)' : '#C65A45'
      : 'var(--c-text-2)',
  });

  return (
    <div style={{ padding: 'clamp(20px, 5vw, 36px) clamp(16px, 4.5vw, 44px) 48px', maxWidth: 840, margin: '0 auto' }}>

      {/* ── Editorial header ── */}
      <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
        Entry
      </div>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.1, marginBottom: 8 }}>
        Log a <em style={{ fontStyle: 'italic', color: 'var(--c-accent)' }}>trade</em>.
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--c-text-2)', lineHeight: 1.55, maxWidth: 480, marginBottom: 6 }}>
        The trade is done — what matters now is what you record about it.
      </div>

      {/* Banners */}
      {showDailyLoss && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(198,90,69,0.1)', border: '1px solid rgba(198,90,69,0.3)', borderRadius: 10, padding: '10px 16px', marginTop: 16, fontSize: 13, color: '#C65A45' }}>
          <span>⚠</span><span>{dailyLossMsg}</span>
        </div>
      )}
      {showDraftBanner && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '10px 16px', marginTop: 16, fontSize: 12, color: 'var(--c-text-2)' }}>
          <span>Draft restored</span>
          <button onClick={clearDraft} style={{ fontSize: 11, color: 'var(--c-text-2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
            Discard
          </button>
        </div>
      )}

      {/* Checklist status — only shown when the trade is being logged for today */}
      {form.date === today() && (
        checklistPassedToday ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(93,202,165,0.08)',
            border: '1px solid rgba(93,202,165,0.25)',
            borderRadius: 10, padding: '10px 16px', marginTop: 16,
            fontSize: 12.5, color: '#5DCAA5',
          }}>
            <span style={{ fontWeight: 600 }}>✓</span>
            <span style={{ color: 'var(--c-text-2)' }}>
              Checklist passed today — this trade will be tagged as <strong style={{ color: 'var(--c-text)' }}>on plan</strong>.
            </span>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            background: 'rgba(239,201,122,0.06)',
            border: '1px solid rgba(239,201,122,0.25)',
            borderRadius: 10, padding: '10px 16px', marginTop: 16,
            fontSize: 12.5, color: '#EFC97A',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 600 }}>⚠</span>
              <span style={{ color: 'var(--c-text-2)' }}>
                Today's pre-trade checklist hasn't been passed — this trade will be tagged as <strong style={{ color: '#EFC97A' }}>off plan</strong>.
              </span>
            </span>
            <button
              onClick={() => setActiveTab('checklist')}
              style={{ fontSize: 11, fontWeight: 600, color: '#EFC97A', background: 'transparent', border: '1px solid rgba(239,201,122,0.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              Go to checklist →
            </button>
          </div>
        )
      )}

      {/* Rule violations — soft warning, doesn't block save */}
      {ruleViolations.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          marginTop: 16,
          padding: '12px 16px',
          background: 'rgba(198,90,69,0.06)',
          border: '1px solid rgba(198,90,69,0.3)',
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#C65A45', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
            <span>⚠</span>
            <span>{ruleViolations.length} rule {ruleViolations.length === 1 ? 'violation' : 'violations'}</span>
          </div>
          {ruleViolations.map((v, i) => (
            <div key={v.ruleId || i} style={{
              fontSize: 12.5, color: 'var(--c-text-2)', lineHeight: 1.55,
              paddingLeft: 18, position: 'relative',
            }}>
              <span style={{ position: 'absolute', left: 4, color: '#C65A45' }}>·</span>
              {v.message}
            </div>
          ))}
        </div>
      )}

      <div style={hr} />

      {/* ── Win / Loss toggle ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={label}>Outcome</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[['win', 'Win →'], ['loss', 'Loss →'], ['breakeven', 'Breakeven']].map(([v, lbl]) => (
            <button key={v} onClick={() => set('outcome', v)} style={outcomeActive(v)}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* ── Trade details ── */}
      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '22px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-text-2)', marginBottom: 18 }}>Trade details</div>

        {/* Account picker — which prop firm account did this trade go on?
            Optional but recommended — enables per-account analytics. */}
        <div style={{ marginBottom: 16 }}>
          <div style={field}>
            <span style={label}>Account</span>
            {propAccounts.length > 0 ? (
              <select
                style={inp}
                value={form.accountId}
                onChange={e => set('accountId', e.target.value)}
              >
                <option value="">— Unassigned —</option>
                {propAccounts.map(a => (
                  <option key={a.id} value={a.id}>{formatAccountLabel(a)}</option>
                ))}
              </select>
            ) : (
              <div style={{
                ...inp,
                color: 'var(--c-text-2)', fontSize: 12, lineHeight: 1.5,
                cursor: 'default',
              }}>
                Add prop firm accounts in <em>Prop Firms</em> to tag trades by account.
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={field}>
            <span style={label}>Symbol</span>
            <input
              style={inp}
              type="text"
              list="symbol-suggestions"
              placeholder="NQ, ES, AAPL…"
              value={form.symbol}
              onChange={e => set('symbol', e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <datalist id="symbol-suggestions">
              {symbolSuggestions.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div style={field}>
            <span style={label}>Date</span>
            <input style={inp} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div style={field}>
            <span style={label}>Direction</span>
            <select style={inp} value={form.direction} onChange={e => set('direction', e.target.value)}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          <div style={field}>
            <span style={label}>Entry price</span>
            <input style={inp} type="number" placeholder="0.00" step="0.01" value={form.entry} onChange={e => set('entry', e.target.value)} />
          </div>
          <div style={field}>
            <span style={label}>Exit price</span>
            <input style={inp} type="number" placeholder="0.00" step="0.01" value={form.exit} onChange={e => set('exit', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div style={field}>
            <span style={label}>Quantity</span>
            <input style={inp} type="number" placeholder="1" min="1" value={form.qty} onChange={e => set('qty', e.target.value)} />
          </div>
          <div style={field}>
            <span style={label}>Accounts</span>
            <input style={inp} type="number" min="1" max="20" value={form.accounts} onChange={e => set('accounts', e.target.value)} />
          </div>
          <div style={field}>
            <span style={label}>Risk ($)</span>
            <input style={inp} type="number" placeholder="50" step="0.01" value={form.riskPer} onChange={e => set('riskPer', e.target.value)} />
          </div>
          <div style={field}>
            <span style={label}>Target ($)</span>
            <input style={inp} type="number" placeholder="100" step="0.01" value={form.rewardPer} onChange={e => set('rewardPer', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 16 }}>
          <div style={field}>
            <span style={label}>
              P/L ($) <span style={{ fontWeight: 400, opacity: 0.55 }}>— override</span>
              {autoCalcPnlPreview != null && !form.pnl && (
                <span style={{
                  marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                  color: 'var(--c-accent)', background: 'rgba(224,122,59,0.12)',
                  border: '1px solid rgba(224,122,59,0.35)',
                  padding: '2px 7px', borderRadius: 100, textTransform: 'uppercase',
                }}>
                  ✦ Auto
                </span>
              )}
            </span>
            <input
              style={inp}
              type="number"
              placeholder={autoCalcPnlPreview != null
                ? `${autoCalcPnlPreview >= 0 ? '+' : ''}${autoCalcPnlPreview}`
                : 'auto'}
              step="0.01"
              value={form.pnl}
              onChange={e => set('pnl', e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
            <div style={{ fontSize: 11, color: 'var(--c-text-2)', lineHeight: 1.6, opacity: 0.7 }}>
              {autoCalcPnlPreview != null
                ? <>Auto-calculated from your <b>entry</b>, <b>exit</b>, and <b>qty</b> for {form.symbol.toUpperCase()}. Type to override.</>
                : isAutoCalcSymbol
                  ? <>Fill <b>entry</b>, <b>exit</b>, and <b>qty</b> below for instant P&L on {form.symbol.toUpperCase()}. Otherwise wins save as Target × Accounts, losses as −Risk × Accounts.</>
                  : <>Leave blank to auto-calculate — wins save as Target × Accounts, losses as −Risk × Accounts.</>}
            </div>
          </div>
        </div>

        {/* R:R preview */}
        {preview && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--c-bg, #1C1613)', borderRadius: 8, fontSize: 12, color: 'var(--c-text-2)', display: 'flex', gap: 20, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
            <span>Total risk: <strong style={{ color: '#C65A45' }}>${preview.totalRisk.toFixed(2)}</strong></span>
            {preview.totalReward > 0 && <span>Total target: <strong style={{ color: 'var(--c-accent)' }}>${preview.totalReward.toFixed(2)}</strong></span>}
            {preview.totalReward > 0 && <span>R:R: <strong style={{ color: 'var(--c-text)' }}>1 : {preview.rr}</strong></span>}
            <span>Will save as: <strong style={{ color: preview.expectedPnl >= 0 ? 'var(--c-accent)' : '#C65A45' }}>{preview.expectedPnl >= 0 ? '+' : ''}${preview.expectedPnl.toFixed(2)}</strong></span>
          </div>
        )}
      </div>

      {/* ── Session & Setup ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={field}>
          <span style={label}>Session</span>
          <select style={inp} value={form.session} onChange={e => set('session', e.target.value)}>
            {SESSION_LIST.map(s => <option key={s} value={s}>{s || '— None —'}</option>)}
          </select>
        </div>
        <div style={field}>
          <span style={label}>Setup tag</span>
          <input
            style={inp}
            type="text"
            list="setup-suggestions"
            placeholder="e.g. Breakout, FVG entry, ICT BoS…"
            value={form.setup}
            onChange={e => set('setup', e.target.value)}
            autoComplete="off"
          />
          <datalist id="setup-suggestions">
            {setupSuggestions.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
      </div>

      {/* ── Rating pills ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={label}>Trade rating</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {RATINGS.map(r => (
            <button key={r} onClick={() => set('rating', form.rating === r ? '' : r)} style={{
              padding: '8px 20px', borderRadius: 100, fontWeight: 600, fontSize: 14,
              fontFamily: "'Inter', sans-serif", cursor: 'pointer', transition: 'all 0.15s',
              border: form.rating === r ? 'none' : '1px solid var(--c-border)',
              background: form.rating === r ? RATING_COLORS[r] : 'transparent',
              color: form.rating === r ? '#fff' : 'var(--c-text-2)',
            }}>
              {r}
            </button>
          ))}
          {form.rating && (
            <span style={{ fontSize: 12, color: RATING_COLORS[form.rating], fontStyle: 'italic' }}>
              {RATING_LABELS[form.rating]}
            </span>
          )}
        </div>
      </div>

      {/* ── Thought process ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, letterSpacing: '-0.02em', color: 'var(--c-text)', marginBottom: 12, lineHeight: 1.2 }}>
          Thought <em style={{ fontStyle: 'italic', color: 'var(--c-accent)' }}>process</em>.
        </div>
        <textarea
          style={{ ...inp, resize: 'vertical', minHeight: 120, lineHeight: 1.6, fontVariantNumeric: 'normal' }}
          placeholder="What was your thesis going in? What did you see, what did you feel, and what actually happened? Any lessons?"
          rows={5}
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
        />
      </div>

      {/* ── Screenshot ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={label}>Chart screenshot (optional)</div>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          style={{
            border: `1.5px dashed ${isDragOver ? 'var(--c-accent)' : 'var(--c-border)'}`,
            borderRadius: 12, padding: '28px 24px', textAlign: 'center', cursor: 'pointer',
            background: isDragOver ? 'rgba(224,122,59,0.04)' : 'transparent',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          {previewSrc ? (
            <img src={previewSrc} alt="preview" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8 }} />
          ) : (
            <div style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.6 }}>
              Drop your chart screenshot here<br />
              <span style={{ fontSize: 11, opacity: 0.6 }}>or click to browse · or paste with ⌘V / Ctrl-V</span>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />

        {/* AI extract button — only shows when a screenshot has been uploaded. */}
        {previewSrc && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={extractFromScreenshot}
              disabled={extracting}
              style={{
                padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                background: extracting ? 'var(--c-border)' : 'rgba(224,122,59,0.12)',
                color: extracting ? 'var(--c-text-2)' : '#E07A3B',
                border: '1px solid rgba(224,122,59,0.3)',
                cursor: extracting ? 'wait' : 'pointer',
                transition: 'background 0.15s',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {extracting ? (
                <>
                  <span className="jm-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
                  Reading screenshot…
                </>
              ) : (
                <>✨ Auto-fill from screenshot</>
              )}
            </button>
            <span style={{ fontSize: 11, color: 'var(--c-text-2)', opacity: 0.7, fontStyle: 'italic' }}>
              Claude vision pulls symbol, prices, qty, P&L. Review before saving.
            </span>
            {extractMsg && (
              <div style={{ fontSize: 11, color: '#C65A45', flexBasis: '100%' }}>{extractMsg}</div>
            )}
          </div>
        )}
      </div>

      {/* ── Save row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          disabled={saving}
          onClick={save}
          style={{
            padding: '13px 28px', borderRadius: 12, fontSize: 15, fontWeight: 600,
            fontFamily: "'Inter', sans-serif", cursor: saving ? 'not-allowed' : 'pointer',
            background: saving ? 'var(--c-border)' : 'var(--c-accent)',
            color: '#fff', border: 'none', transition: 'background 0.15s', opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save trade'}
        </button>
        {saveMsg && (
          <span style={{
            fontSize: 13, fontStyle: 'italic',
            color: saveMsg.startsWith('Need') || saveMsg.startsWith('Save') ? '#C65A45' : 'var(--c-text-2)',
          }}>
            {saveMsg}
          </span>
        )}
        {!saveMsg && !saving && (
          <span style={{ fontSize: 11, color: 'var(--c-text-2)', opacity: 0.6 }}>
            Auto-saved
          </span>
        )}
      </div>

    </div>
  );
}
