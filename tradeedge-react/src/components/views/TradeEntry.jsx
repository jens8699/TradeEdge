import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { sb } from '../../lib/supabase';

const DRAFT_KEY = 'te_trade_draft';

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

const SETUPS = ['', 'Breakout', 'Pullback', 'Reversal', 'Range', 'Trend continuation', 'News play', 'Gap fill', 'VWAP', 'Support/Resistance', 'Other'];
const SESSION_LIST = ['', 'Sydney', 'Tokyo', 'London', 'New York', 'Premarket', 'After Hours'];
const RATINGS = ['A', 'B', 'C', 'D'];
const RATING_LABELS = { A: 'Perfect execution', B: 'Good trade', C: 'Average', D: 'Poor execution' };
const RATING_COLORS = { A: '#E07A3B', B: '#A89687', C: '#EFC97A', D: '#F09595' };

export default function TradeEntry({ showToast }) {
  const { userId, trades, addTrade } = useApp();

  const [form, setForm] = useState({
    date: today(), symbol: '', direction: 'long', accounts: 1,
    riskPer: '', rewardPer: '', outcome: 'win', pnl: '', setup: '', notes: '',
    entry: '', exit: '', qty: '', session: '', rating: '',
  });
  const [pendingImage, setPendingImage]       = useState(null);
  const [previewSrc,   setPreviewSrc]         = useState(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [saveMsg, setSaveMsg]                 = useState('');
  const [isDragOver, setIsDragOver]           = useState(false);
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

  const save = async () => {
    const { date, symbol, direction, accounts, riskPer, rewardPer, outcome, setup, notes } = form;
    let pnl = parseFloat(form.pnl);
    if (!date || !symbol || parseFloat(riskPer) <= 0 || parseInt(accounts) < 1) {
      setSaveMsg('Need date, symbol, accounts, and risk');
      setTimeout(() => setSaveMsg(''), 3000);
      return;
    }
    const accounts_ = parseInt(accounts) || 1;
    const riskPer_   = parseFloat(riskPer) || 0;
    const rewardPer_ = parseFloat(rewardPer) || 0;
    const totalRisk  = riskPer_ * accounts_;
    const totalReward = rewardPer_ * accounts_;
    // Auto-calc P&L unless the user explicitly typed a custom value
    const manualPnl = String(form.pnl).trim();
    if (manualPnl === '' || isNaN(pnl)) {
      if (outcome === 'win') pnl = totalReward;
      else if (outcome === 'loss') pnl = -totalRisk;
      else pnl = 0;
    }
    setSaving(true); setSaveMsg('Saving…');

    // Upload screenshot
    let imagePath = null;
    let imageUrl  = null;
    const tradeId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    if (pendingImage && userId) {
      try {
        const res = await fetch(pendingImage);
        const blob = await res.blob();
        const filePath = `${userId}/${tradeId}.jpg`;
        const { error: upErr } = await sb.storage.from('trade-screenshots').upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });
        if (!upErr) {
          imagePath = filePath;
          const { data: signed } = await sb.storage.from('trade-screenshots').createSignedUrl(filePath, 3600);
          if (signed) imageUrl = signed.signedUrl;
        }
      } catch(e) { console.warn('Screenshot upload error:', e); }
    }

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
    };

    const result = await addTrade(trade);
    setSaving(false);
    if (!result.ok) { setSaveMsg('Save failed: ' + result.error); return; }
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
    setForm({ date: today(), symbol: '', direction: 'long', accounts: 1, riskPer: '', rewardPer: '', outcome: 'win', pnl: '', setup: '', notes: '', entry: '', exit: '', qty: '', session: '', rating: '' });
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
    <div style={{ padding: '36px 44px', maxWidth: 820, paddingBottom: 48 }}>

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={field}>
            <span style={label}>Symbol</span>
            <input style={inp} type="text" placeholder="NQ, ES, AAPL…" value={form.symbol} onChange={e => set('symbol', e.target.value)} />
          </div>
          <div style={field}>
            <span style={label}>Date</span>
            <input style={inp} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          <div style={field}>
            <span style={label}>Qty / contracts</span>
            <input style={inp} type="number" placeholder="1" min="1" value={form.qty} onChange={e => set('qty', e.target.value)} />
          </div>
          <div style={field}>
            <span style={label}>Accounts</span>
            <input style={inp} type="number" min="1" max="20" value={form.accounts} onChange={e => set('accounts', e.target.value)} />
          </div>
          <div style={field}>
            <span style={label}>Risk / acct ($)</span>
            <input style={inp} type="number" placeholder="50" step="0.01" value={form.riskPer} onChange={e => set('riskPer', e.target.value)} />
          </div>
          <div style={field}>
            <span style={label}>Actual P/L ($)</span>
            <input style={inp} type="number" placeholder="auto" step="0.01" value={form.pnl} onChange={e => set('pnl', e.target.value)} />
          </div>
        </div>

        {/* R:R preview */}
        {preview && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--c-bg, #1C1613)', borderRadius: 8, fontSize: 12, color: 'var(--c-text-2)', display: 'flex', gap: 20, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
            <span>Risk: <strong style={{ color: 'var(--c-text)' }}>${preview.totalRisk.toFixed(2)}</strong></span>
            <span>Target: <strong style={{ color: 'var(--c-text)' }}>${preview.totalReward.toFixed(2)}</strong></span>
            <span>R:R: <strong style={{ color: 'var(--c-text)' }}>{preview.rr}</strong></span>
            <span>P&L will save as: <strong style={{ color: preview.expectedPnl >= 0 ? 'var(--c-accent)' : '#C65A45' }}>{preview.expectedPnl >= 0 ? '+' : ''}${preview.expectedPnl.toFixed(2)}</strong></span>
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
          <select style={inp} value={form.setup} onChange={e => set('setup', e.target.value)}>
            {SETUPS.map(s => <option key={s} value={s}>{s || '— None —'}</option>)}
          </select>
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
              <span style={{ fontSize: 11, opacity: 0.6 }}>or click to browse</span>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
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
