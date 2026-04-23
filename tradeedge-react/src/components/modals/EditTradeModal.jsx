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
      <div className="edit-overlay" onClick={onClose} />
      <div className="edit-modal">
        <div className="edit-card">
          <h2>Edit Trade</h2>

          {/* ── Row 1: Date · Symbol ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px' }}>
            <div className="jm-field">
              <label>Date</label>
              <input type="date" className="jm-in" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="jm-field">
              <label>Symbol</label>
              <input type="text" className="jm-in" value={form.symbol} onChange={e => set('symbol', e.target.value.toUpperCase())} />
            </div>
          </div>

          {/* ── Row 2: Direction · Accounts · Outcome ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'14px' }}>
            <div className="jm-field">
              <label>Direction</label>
              <select className="jm-in" value={form.direction} onChange={e => set('direction', e.target.value)}>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div className="jm-field">
              <label>Accounts</label>
              <input type="number" className="jm-in" min="1" value={form.accounts} onChange={e => set('accounts', e.target.value)} />
            </div>
            <div className="jm-field">
              <label>Outcome</label>
              <select className="jm-in" value={form.outcome} onChange={e => handleOutcomeChange(e.target.value)}>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
                <option value="breakeven">Breakeven</option>
              </select>
            </div>
          </div>

          {/* ── Row 3: Risk · Reward · P&L + live R:R ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom: rr ? '6px' : '14px' }}>
            <div className="jm-field">
              <label>Risk / account</label>
              <input type="number" className="jm-in" step="0.01" value={form.riskPer} onChange={e => set('riskPer', e.target.value)} />
            </div>
            <div className="jm-field">
              <label>Reward / account</label>
              <input type="number" className="jm-in" step="0.01" value={form.rewardPer} onChange={e => set('rewardPer', e.target.value)} />
            </div>
            <div className="jm-field">
              <label>Actual P&L</label>
              <input type="number" className="jm-in" step="0.01" value={form.pnl} onChange={e => set('pnl', e.target.value)} />
            </div>
          </div>
          {rr && (
            <p style={{ fontSize:'11px', color:'#E07A3B', margin:'0 0 14px', textAlign:'right', fontWeight:600 }}>
              R:R ratio → 1 : {rr}
            </p>
          )}

          {/* ── Row 4: Entry · Exit · Qty ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'14px' }}>
            <div className="jm-field">
              <label>Entry price</label>
              <input type="number" className="jm-in" step="0.01" placeholder="0.00" value={form.entry} onChange={e => set('entry', e.target.value)} />
            </div>
            <div className="jm-field">
              <label>Exit price</label>
              <input type="number" className="jm-in" step="0.01" placeholder="0.00" value={form.exit} onChange={e => set('exit', e.target.value)} />
            </div>
            <div className="jm-field">
              <label>Qty / contracts</label>
              <input type="number" className="jm-in" min="1" placeholder="1" value={form.qty} onChange={e => set('qty', e.target.value)} />
            </div>
          </div>

          {/* ── Row 5: Session · Setup ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px' }}>
            <div className="jm-field">
              <label>Session</label>
              <select className="jm-in" value={form.session} onChange={e => set('session', e.target.value)}>
                {SESSION_LIST.map(s => <option key={s} value={s}>{s || '— None —'}</option>)}
              </select>
            </div>
            <div className="jm-field">
              <label>Setup</label>
              <select className="jm-in" value={form.setup} onChange={e => set('setup', e.target.value)}>
                {SETUPS.map(s => <option key={s} value={s}>{s || '— None —'}</option>)}
              </select>
            </div>
          </div>

          {/* ── Row 6: Trade rating ── */}
          <div className="jm-field" style={{ marginBottom:'14px' }}>
            <label>Trade rating</label>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'6px' }}>
              {RATINGS.map(r => (
                <button
                  key={r}
                  onClick={() => set('rating', form.rating === r ? '' : r)}
                  style={{
                    width:'40px', height:'36px', borderRadius:'8px', fontWeight:700, fontSize:'14px',
                    border: form.rating === r ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    background: form.rating === r ? RATING_COLORS[r] : 'rgba(255,255,255,0.05)',
                    color: form.rating === r ? '#17150F' : '#6B6760',
                    cursor:'pointer', transition:'all 0.15s', flexShrink: 0,
                  }}
                >
                  {r}
                </button>
              ))}
              {form.rating && (
                <span style={{ fontSize:'11px', color: RATING_COLORS[form.rating], fontWeight:600, marginLeft:'4px' }}>
                  {RATING_LABELS[form.rating]}
                </span>
              )}
            </div>
          </div>

          {/* ── Emotion ── */}
          <div className="jm-field" style={{ marginBottom:'14px' }}>
            <label>Mindset / emotion</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'6px' }}>
              {EMOTIONS.map(e => {
                const active = form.emotion === e.key;
                return (
                  <button key={e.key} onClick={() => set('emotion', active ? '' : e.key)} style={{
                    display:'flex', alignItems:'center', gap:'5px',
                    padding:'5px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:600,
                    border: active ? 'none' : '0.5px solid rgba(255,255,255,0.1)',
                    background: active ? `${e.color}22` : 'rgba(255,255,255,0.04)',
                    color: active ? e.color : '#6B6760',
                    cursor:'pointer', transition:'all 0.15s',
                    outline: active ? `1px solid ${e.color}55` : 'none',
                  }}>
                    <span style={{ fontSize:'13px' }}>{e.icon}</span>
                    {e.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="jm-field" style={{ marginBottom:'14px' }}>
            <label>Notes</label>
            <textarea className="jm-in" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {err && <p style={{ color:'#F09595', fontSize:'12px', margin:'0 0 10px' }}>{err}</p>}

          <div className="edit-actions">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="jm-btn" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
