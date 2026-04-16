import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt } from '../../lib/utils';
import EditTradeModal from '../modals/EditTradeModal';

export default function History({ showToast }) {
  const { trades, deleteTrade } = useApp();
  const [editTrade,     setEditTrade]     = useState(null);
  const [setupFilter,   setSetupFilter]   = useState('');
  const [symbolFilter,  setSymbolFilter]  = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [search,        setSearch]        = useState('');
  const [confirmDel,    setConfirmDel]    = useState(null);

  const setups  = [...new Set(trades.map(t => t.setup).filter(Boolean))].sort();
  const symbols = [...new Set(trades.map(t => t.symbol))].sort();

  const filtered = trades.filter(t => {
    if (setupFilter   && t.setup   !== setupFilter)   return false;
    if (symbolFilter  && t.symbol  !== symbolFilter)  return false;
    if (outcomeFilter && t.outcome !== outcomeFilter)  return false;
    if (search) {
      const q = search.toLowerCase();
      return t.symbol.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q) || (t.setup || '').toLowerCase().includes(q);
    }
    return true;
  });

  const handleDelete = async (id) => {
    await deleteTrade(id);
    setConfirmDel(null);
    showToast('Trade deleted', 'success');
  };

  return (
    <div className="jm-view">
      <div className="jm-greeting">
        <p className="jm-hello">Review your trades</p>
        <h1 className="jm-page-title">Trade <span>History</span></h1>
      </div>

      <div className="jm-filter-row">
        <label>Filter:</label>
        <select className="jm-in" value={setupFilter} onChange={e => setSetupFilter(e.target.value)}>
          <option value="">All setups</option>
          {setups.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="jm-in" value={symbolFilter} onChange={e => setSymbolFilter(e.target.value)}>
          <option value="">All symbols</option>
          {symbols.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="jm-in" value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}>
          <option value="">All outcomes</option>
          <option value="win">Win</option>
          <option value="loss">Loss</option>
          <option value="breakeven">Breakeven</option>
        </select>
        <input type="text" className="jm-in" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:0 }} />
      </div>

      <div className="history-list">
        {filtered.length === 0 && (
          <div className="jm-empty">
            <div className="jm-empty-icon">◎</div>
            {trades.length === 0 ? "No trades yet. Log your first trade!" : "No trades match your filters."}
          </div>
        )}
        {filtered.map((t, i) => (
          <TradeCard key={t.id} trade={t} index={i}
            onEdit={() => setEditTrade(t)}
            onDelete={() => setConfirmDel(t.id)} />
        ))}
      </div>

      {/* Delete confirmation */}
      {confirmDel && (
        <>
          <div className="edit-overlay" onClick={() => setConfirmDel(null)} />
          <div className="edit-modal">
            <div className="edit-card" style={{ maxWidth:'380px' }}>
              <h2 style={{ fontSize:'17px' }}>Delete this trade?</h2>
              <p style={{ fontSize:'13px', color:'#8B8882', margin:'0 0 20px', lineHeight:1.5 }}>
                This can't be undone.
              </p>
              <div className="edit-actions">
                <button className="btn-ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
                <button className="btn-danger" onClick={() => handleDelete(confirmDel)}>Delete</button>
              </div>
            </div>
          </div>
        </>
      )}

      {editTrade && (
        <EditTradeModal trade={editTrade} onClose={() => setEditTrade(null)} showToast={showToast} />
      )}
    </div>
  );
}

function TradeCard({ trade: t, index, onEdit, onDelete }) {
  const [imgOpen, setImgOpen] = useState(false);
  const pnlColor = t.pnl > 0 ? '#5DCAA5' : t.pnl < 0 ? '#F09595' : '#8B8882';

  return (
    <div className="jm-trade" style={{ animationDelay: `${Math.min(index, 5) * 0.04}s` }}>
      <div className="jm-trade-head">
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          <strong style={{ fontSize:'15px', color:'#F5F3ED', letterSpacing:'-0.2px' }}>{t.symbol}</strong>
          <span className={`jm-pill ${t.direction === 'long' ? 'jm-pill-long' : 'jm-pill-short'}`}>
            {t.direction}
          </span>
          {t.accounts > 1 && (
            <span className="jm-pill jm-pill-accounts">{t.accounts}x</span>
          )}
          {t.setup && (
            <span className="jm-pill" style={{ background:'rgba(139,136,130,0.12)', color:'#8B8882' }}>{t.setup}</span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
          <span style={{ fontSize:'16px', fontWeight:600, color:pnlColor, letterSpacing:'-0.2px' }}>
            {fmt(t.pnl)}
          </span>
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
        <div style={{ display:'flex', gap:'16px', fontSize:'12px', color:'#6B6862' }}>
          <span>{t.date}</span>
          {t.riskPer > 0 && <span>Risk: {fmt(t.risk)}</span>}
          {t.rewardPer > 0 && <span>Target: {fmt(t.reward)}</span>}
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          <button onClick={onEdit} style={{ background:'transparent', border:'0.5px solid #2A2720', color:'#8B8882', padding:'4px 10px', borderRadius:'8px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#E8724A'; e.currentTarget.style.color='#E8724A'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='#2A2720'; e.currentTarget.style.color='#8B8882'; }}>
            Edit
          </button>
          <button onClick={onDelete} style={{ background:'transparent', border:'0.5px solid #2A2720', color:'#8B8882', padding:'4px 10px', borderRadius:'8px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(226,75,74,0.5)'; e.currentTarget.style.color='#F09595'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='#2A2720'; e.currentTarget.style.color='#8B8882'; }}>
            Delete
          </button>
        </div>
      </div>

      {t.notes && (
        <p style={{ fontSize:'13px', color:'#A8A49E', margin:'8px 0 0', lineHeight:1.55 }}>{t.notes}</p>
      )}
      {(t.imageUrl || (t.image && t.image.startsWith('data:'))) && (
        <>
          <img
            src={t.imageUrl || t.image}
            alt="chart screenshot"
            className="jm-thumb"
            onClick={() => setImgOpen(true)}
          />
          {imgOpen && (
            <>
              <div className="edit-overlay" onClick={() => setImgOpen(false)} />
              <div className="edit-modal" onClick={() => setImgOpen(false)}>
                <img src={t.imageUrl || t.image} alt="chart" style={{ maxWidth:'90vw', maxHeight:'85vh', borderRadius:'12px', boxShadow:'0 24px 60px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
