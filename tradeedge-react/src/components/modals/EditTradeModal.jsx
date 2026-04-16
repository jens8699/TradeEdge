import { useState } from 'react';
import { useApp } from '../../context/AppContext';

const SETUPS = ['', 'Breakout', 'Pullback', 'Reversal', 'Range', 'Trend continuation', 'News play', 'Gap fill', 'VWAP', 'Support/Resistance', 'Other'];

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
    pnl:       trade.pnl ?? '',   // Keep existing pnl for editing; user can clear to re-auto-calc
    setup:     trade.setup || '',
    notes:     trade.notes || '',
  });
  // When outcome changes, clear pnl so auto-calc kicks in (user can still type a custom value)
  const handleOutcomeChange = (v) => {
    set('outcome', v);
    set('pnl', '');
  };
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setErr('');
    const accounts  = parseInt(form.accounts)  || 1;
    const riskPer   = parseFloat(form.riskPer)   || 0;
    const rewardPer = parseFloat(form.rewardPer) || 0;
    const manualPnl = String(form.pnl).trim();
    let pnl = parseFloat(manualPnl);
    if (manualPnl === '' || isNaN(pnl)) {
      if (form.outcome === 'win')  pnl =  rewardPer * accounts;
      else if (form.outcome === 'loss') pnl = -riskPer * accounts;
      else pnl = 0;
    }
    const updated = {
      ...trade,
      date: form.date, symbol: form.symbol, direction: form.direction,
      accounts, riskPer, rewardPer,
      risk: riskPer * accounts, reward: rewardPer * accounts,
      outcome: form.outcome, pnl,
      setup: form.setup,
      notes: form.notes.trim(),
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
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px' }}>
            <div className="jm-field"><label>Date</label>
              <input type="date" className="jm-in" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            <div className="jm-field"><label>Symbol</label>
              <input type="text" className="jm-in" value={form.symbol} onChange={e => set('symbol', e.target.value)} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'14px' }}>
            <div className="jm-field"><label>Direction</label>
              <select className="jm-in" value={form.direction} onChange={e => set('direction', e.target.value)}>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select></div>
            <div className="jm-field"><label>Accounts</label>
              <input type="number" className="jm-in" min="1" value={form.accounts} onChange={e => set('accounts', e.target.value)} /></div>
            <div className="jm-field"><label>Outcome</label>
              <select className="jm-in" value={form.outcome} onChange={e => handleOutcomeChange(e.target.value)}>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
                <option value="breakeven">Breakeven</option>
              </select></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'14px' }}>
            <div className="jm-field"><label>Risk/account</label>
              <input type="number" className="jm-in" step="0.01" value={form.riskPer} onChange={e => set('riskPer', e.target.value)} /></div>
            <div className="jm-field"><label>Reward/account</label>
              <input type="number" className="jm-in" step="0.01" value={form.rewardPer} onChange={e => set('rewardPer', e.target.value)} /></div>
            <div className="jm-field"><label>Actual P/L</label>
              <input type="number" className="jm-in" step="0.01" value={form.pnl} onChange={e => set('pnl', e.target.value)} /></div>
          </div>
          <div className="jm-field" style={{ marginBottom:'14px' }}>
            <label>Setup</label>
            <select className="jm-in" value={form.setup} onChange={e => set('setup', e.target.value)}>
              {SETUPS.map(s => <option key={s} value={s}>{s || '— None —'}</option>)}
            </select>
          </div>
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
