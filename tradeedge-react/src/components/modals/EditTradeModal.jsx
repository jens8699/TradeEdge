import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

const SETUPS = ['', 'Breakout', 'Pullback', 'Reversal', 'Range', 'Trend continuation', 'News play', 'Gap fill', 'VWAP', 'Support/Resistance', 'Other'];
const SESSION_LIST = ['', 'Sydney', 'Tokyo', 'London', 'New York', 'Premarket', 'After Hours'];
const RATINGS = ['A', 'B', 'C', 'D'];
const RATING_LABELS = { A: 'Perfect execution', B: 'Good trade', C: 'Average', D: 'Poor execution' };
const RATING_COLORS = { A: '#E07A3B', B: '#A89687', C: '#EFC97A', D: '#F09595' };
const EMOTIONS = [
  { key: 'calm',          label: 'Calm',          icon: '😌', color: '#E07A3B' },
  { key: 'confident',     label: 'Confident',     icon: '💪', color: '#A89687' },
  { key: 'fomo',          label: 'FOMO',           icon: '😰', color: '#EFC97A' },
  { key: 'anxious',       label: 'Anxious',        icon: '😬', color: '#EFC97A' },
  { key: 'revenge',       label: 'Revenge',        icon: '😤', color: '#F09595' },
  { key: 'overconfident', label: 'Overconfident',  icon: '🤑', color: '#F09595' },
  { key: 'bored',         label: 'Bored',          icon: '😑', color: '#8B8882' },
  { key: 'focused',       label: 'Focused',        icon: '🎯', color: '#E07A3B' },
];

// ── Shared style helpers ──────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 8,
  padding: '8px 11px', fontSize: 13, color: 'var(--c-text)',
  fontFamily: "'Inter', sans-serif", outline: 'none',
};

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>
      {children}
    </div>
  );
}

function F({ label, children, style }) {
  return (
    <div style={style}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EditTradeModal({ trade, onClose, showToast }) {
  const { updateTrade } = useApp();
  const [form, setForm] = useState({
    date:      trade.date,
    symbol:    trade.symbol,
    direction: trade.direction,
    accounts:  trade.accounts,
    riskPer:   trade.riskPer || '',
    rewardPer: trade.rewardPer || '',
    outcome:   trade.outcome,
    pnl:       trade.pnl ?? '',
    setup:     trade.setup || '',
    notes:     trade.notes || '',
    entry:     trade.entry || '',
    exit:      trade.exit  || '',
    qty:       trade.qty   || '',
    session:   trade.session || '',
    rating:    trade.rating  || '',
    emotion:   trade.emotion || '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  // Escape to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleOutcomeChange = (v) => { set('outcome', v); set('pnl', ''); };

  // Live R:R ratio
  const rr = form.riskPer && form.rewardPer && parseFloat(form.riskPer) > 0
    ? (parseFloat(form.rewardPer) / parseFloat(form.riskPer)).toFixed(2)
    : null;

  const save = async () => {
    setErr('');
    const accounts  = parseInt(form.accounts)  || 1;
    const riskPer   = parseFloat(form.riskPer)   || 0;
    const rewardPer = parseFloat(form.rewardPer) || 0;
    const manualPnl = String(form.pnl).trim();
    let pnl = parseFloat(manualPnl);
    if (manualPnl === '' || isNaN(pnl)) {
      if (form.outcome === 'win')       pnl =  rewardPer * accounts;
      else if (form.outcome === 'loss') pnl = -riskPer   * accounts;
      else                              pnl = 0;
    }
    const updated = {
      ...trade,
      date: form.date, symbol: form.symbol.toUpperCase().trim(), direction: form.direction,
      accounts, riskPer, rewardPer,
      risk: riskPer * accounts, reward: rewardPer * accounts,
      outcome: form.outcome, pnl,
      setup:   form.setup,
      notes:   form.notes.trim(),
      entry:   form.entry   ? parseFloat(form.entry)  : null,
      exit:    form.exit    ? parseFloat(form.exit)   : null,
      qty:     form.qty     ? parseInt(form.qty)      : null,
      session: form.session || null,
      rating:  form.rating  || null,
      emotion: form.emotion || null,
    };
    setSaving(true);
    const result = await updateTrade(updated);
    setSaving(false);
    if (result && !result.ok) { setErr(result.error); return; }
    showToast('Trade updated', 'success');
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 400,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 20,
        padding: '28px 28px 24px',
        width: 580,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: '88vh',
        overflowY: 'auto',
        zIndex: 401,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>
            Edit trade
          </div>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.1 }}>
            {trade.symbol}<span style={{ color: 'var(--c-accent)' }}>.</span>
          </div>
        </div>

        {/* ── Row 1: Date · Symbol ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <F label="Date">
            <input type="date" style={inputStyle} value={form.date} onChange={e => set('date', e.target.value)} />
          </F>
          <F label="Symbol">
            <input type="text" style={inputStyle} value={form.symbol} onChange={e => set('symbol', e.target.value.toUpperCase())} />
          </F>
        </div>

        {/* ── Row 2: Direction · Accounts · Outcome ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <F label="Direction">
            <select style={inputStyle} value={form.direction} onChange={e => set('direction', e.target.value)}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </F>
          <F label="Accounts">
            <input type="number" style={inputStyle} min="1" value={form.accounts} onChange={e => set('accounts', e.target.value)} />
          </F>
          <F label="Outcome">
            <select style={inputStyle} value={form.outcome} onChange={e => handleOutcomeChange(e.target.value)}>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="breakeven">Breakeven</option>
            </select>
          </F>
        </div>

        {/* ── Row 3: Risk · Reward · P&L + live R:R ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: rr ? 4 : 12 }}>
          <F label="Risk / account">
            <input type="number" style={inputStyle} step="0.01" value={form.riskPer} onChange={e => set('riskPer', e.target.value)} />
          </F>
          <F label="Reward / account">
            <input type="number" style={inputStyle} step="0.01" value={form.rewardPer} onChange={e => set('rewardPer', e.target.value)} />
          </F>
          <F label="Actual P&L">
            <input type="number" style={inputStyle} step="0.01" value={form.pnl} onChange={e => set('pnl', e.target.value)} />
          </F>
        </div>
        {rr && (
          <div style={{ fontSize: 11, color: 'var(--c-accent)', textAlign: 'right', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", marginBottom: 12 }}>
            1 : {rr} R:R
          </div>
        )}

        {/* ── Row 4: Entry · Exit · Qty ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <F label="Entry price">
            <input type="number" style={inputStyle} step="0.01" placeholder="0.00" value={form.entry} onChange={e => set('entry', e.target.value)} />
          </F>
          <F label="Exit price">
            <input type="number" style={inputStyle} step="0.01" placeholder="0.00" value={form.exit} onChange={e => set('exit', e.target.value)} />
          </F>
          <F label="Qty / contracts">
            <input type="number" style={inputStyle} min="1" placeholder="1" value={form.qty} onChange={e => set('qty', e.target.value)} />
          </F>
        </div>

        {/* ── Row 5: Session · Setup ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <F label="Session">
            <select style={inputStyle} value={form.session} onChange={e => set('session', e.target.value)}>
              {SESSION_LIST.map(s => <option key={s} value={s}>{s || '— None —'}</option>)}
            </select>
          </F>
          <F label="Setup">
            <select style={inputStyle} value={form.setup} onChange={e => set('setup', e.target.value)}>
              {SETUPS.map(s => <option key={s} value={s}>{s || '— None —'}</option>)}
            </select>
          </F>
        </div>

        {/* ── Trade rating ── */}
        <div style={{ marginBottom: 12 }}>
          <FieldLabel>Trade rating</FieldLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            {RATINGS.map(r => (
              <button
                key={r}
                onClick={() => set('rating', form.rating === r ? '' : r)}
                style={{
                  width: 40, height: 36, borderRadius: 8, fontWeight: 700, fontSize: 14,
                  border: form.rating === r ? 'none' : '1px solid var(--c-border)',
                  background: form.rating === r ? RATING_COLORS[r] : 'transparent',
                  color: form.rating === r ? '#17150F' : 'var(--c-text-2)',
                  cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                }}
              >
                {r}
              </button>
            ))}
            {form.rating && (
              <span style={{ fontSize: 11, color: RATING_COLORS[form.rating], fontWeight: 600, marginLeft: 4 }}>
                {RATING_LABELS[form.rating]}
              </span>
            )}
          </div>
        </div>

        {/* ── Emotion ── */}
        <div style={{ marginBottom: 12 }}>
          <FieldLabel>Mindset / emotion</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {EMOTIONS.map(e => {
              const active = form.emotion === e.key;
              return (
                <button key={e.key} onClick={() => set('emotion', active ? '' : e.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  border: active ? `1px solid ${e.color}55` : '1px solid var(--c-border)',
                  background: active ? `${e.color}18` : 'transparent',
                  color: active ? e.color : 'var(--c-text-2)',
                  cursor: 'pointer', transition: 'all 0.15s',
                  fontFamily: "'Inter', sans-serif",
                }}>
                  <span style={{ fontSize: 13 }}>{e.icon}</span>
                  {e.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Notes ── */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel>Notes</FieldLabel>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 72, lineHeight: 1.6 }}
            rows={3}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </div>

        {err && (
          <div style={{ fontSize: 12, color: '#C65A45', marginBottom: 12 }}>{err}</div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'transparent', border: '1px solid var(--c-border)',
              color: 'var(--c-text-2)', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={save}
            style={{
              padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: 'rgba(224,122,59,0.12)', border: '1px solid rgba(224,122,59,0.4)',
              color: 'var(--c-accent)', cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1, fontFamily: "'Inter', sans-serif",
              transition: 'opacity 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}
