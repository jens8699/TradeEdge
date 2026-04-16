import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt } from '../../lib/utils';

export default function Payouts({ showToast }) {
  const { payouts, addPayout, deletePayout } = useApp();
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10));
  const [firm,   setFirm]   = useState('');
  const [amount, setAmount] = useState('');
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const chartRef = useRef(null);
  const chartInst = useRef(null);

  const total = payouts.reduce((s, p) => s + p.amount, 0);

  // Payout chart
  useEffect(() => {
    if (!payouts.length) return;
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
      const ctx = chartRef.current;
      if (!ctx) return;
      const sorted = [...payouts].sort((a,b) => a.date.localeCompare(b.date));
      let cum = 0;
      const labels = [], data = [];
      sorted.forEach(p => { cum += p.amount; labels.push(p.date); data.push(Math.round(cum*100)/100); });
      chartInst.current = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ data, borderColor: '#5DCAA5', backgroundColor: 'rgba(93,202,165,0.12)', fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#5DCAA5', pointBorderColor: '#17150F', pointBorderWidth: 2, borderWidth: 2.5 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0E0C08', titleColor: '#F5F3ED', bodyColor: '#E8E6E1', borderColor: '#2A2720', borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: ctx => '$' + ctx.raw.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) } } }, scales: { y: { ticks: { color: '#8B8882', callback: v => '$' + v }, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { ticks: { color: '#8B8882' }, grid: { display: false } } } }
      });
    });
  }, [payouts]);

  useEffect(() => () => { if (chartInst.current) chartInst.current.destroy(); }, []);

  const save = async () => {
    if (!date || !firm || !parseFloat(amount) || parseFloat(amount) <= 0) {
      setMsg('Need date, firm, and amount'); setTimeout(() => setMsg(''), 3000); return;
    }
    setSaving(true);
    const result = await addPayout({ date, firm: firm.trim(), amount: parseFloat(amount), notes: notes.trim() });
    setSaving(false);
    if (!result.ok) { setMsg('Save failed: ' + result.error); return; }
    showToast(result.offline ? 'Saved offline — syncs when back online' : 'Payout logged', result.offline ? 'warn' : 'success', result.offline ? 4000 : 3000);
    setFirm(''); setAmount(''); setNotes('');
  };

  const handleDelete = async (id) => {
    await deletePayout(id);
    setConfirmDel(null);
    showToast('Payout deleted', 'success');
  };

  return (
    <div className="jm-view">
      <div className="jm-greeting">
        <p className="jm-hello">Track your withdrawals</p>
        <h1 className="jm-page-title">Payout <span>Tracker</span></h1>
      </div>

      {payouts.length > 0 && (
        <div className="jm-hero" style={{ background:'radial-gradient(ellipse at top right, rgba(93,202,165,0.2) 0%, rgba(93,202,165,0.04) 50%, #1E1C16 100%)', borderColor:'rgba(93,202,165,0.35)' }}>
          <p className="jm-hero-label">Total withdrawn</p>
          <p className="jm-hero-val" style={{ color:'#B6EBD8' }}>{fmt(total)}</p>
          <p className="jm-hero-meta">{payouts.length} payout{payouts.length===1?'':'s'}</p>
        </div>
      )}

      {payouts.length > 0 && (
        <div className="jm-card" style={{ marginBottom:'14px' }}>
          <h2 className="jm-card-title">Payout history</h2>
          <div style={{ position:'relative', height:'200px', marginBottom:'4px' }}>
            <canvas ref={chartRef} />
          </div>
        </div>
      )}

      <div className="jm-card" style={{ marginBottom:'14px' }}>
        <h2 className="jm-card-title">Log a payout</h2>
        <div className="jm-g2">
          <div className="jm-field"><label>Date</label>
            <input type="date" className="jm-in" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="jm-field"><label>Prop firm / source</label>
            <input type="text" className="jm-in" placeholder="FTMO, Apex, MFF…" value={firm} onChange={e => setFirm(e.target.value)} /></div>
        </div>
        <div className="jm-field" style={{ marginBottom:'16px' }}>
          <label>Amount ($)</label>
          <input type="number" className="jm-in" placeholder="500.00" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div className="jm-field" style={{ marginBottom:'20px' }}>
          <label>Notes (optional)</label>
          <textarea className="jm-in" rows={2} placeholder="First payout from FTMO challenge…" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <button className="jm-btn" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Log payout'}
          </button>
          {msg && <span style={{ fontSize:'12px', color:'#E24B4A', fontWeight:500 }}>{msg}</span>}
        </div>
      </div>

      <div>
        {payouts.length === 0 && (
          <div className="jm-empty">
            <div className="jm-empty-icon">$</div>
            No payouts logged yet. Log your first withdrawal above.
          </div>
        )}
        {payouts.map(p => (
          <div key={p.id} className="jm-trade">
            <div className="jm-trade-head">
              <div>
                <strong style={{ fontSize:'15px', color:'#F5F3ED' }}>{p.firm}</strong>
                <span style={{ fontSize:'12px', color:'#6B6862', marginLeft:'10px' }}>{p.date}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'16px', fontWeight:600, color:'#5DCAA5' }}>{fmt(p.amount)}</span>
                <button onClick={() => setConfirmDel(p.id)} style={{ background:'transparent', border:'0.5px solid #2A2720', color:'#8B8882', padding:'4px 10px', borderRadius:'8px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(226,75,74,0.5)'; e.currentTarget.style.color='#F09595'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='#2A2720'; e.currentTarget.style.color='#8B8882'; }}>
                  Delete
                </button>
              </div>
            </div>
            {p.notes && <p style={{ fontSize:'13px', color:'#A8A49E', margin:'6px 0 0', lineHeight:1.55 }}>{p.notes}</p>}
          </div>
        ))}
      </div>

      {confirmDel && (
        <>
          <div className="edit-overlay" onClick={() => setConfirmDel(null)} />
          <div className="edit-modal">
            <div className="edit-card" style={{ maxWidth:'380px' }}>
              <h2 style={{ fontSize:'17px' }}>Delete this payout?</h2>
              <p style={{ fontSize:'13px', color:'#8B8882', margin:'0 0 20px', lineHeight:1.5 }}>This can't be undone.</p>
              <div className="edit-actions">
                <button className="btn-ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
                <button className="btn-danger" onClick={() => handleDelete(confirmDel)}>Delete</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
