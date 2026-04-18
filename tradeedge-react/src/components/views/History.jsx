import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt } from '../../lib/utils';
import EditTradeModal from '../modals/EditTradeModal';

// ── Constants ─────────────────────────────────────────────────────────────────
const SESSION_COLORS = {
  Sydney: '#85B7EB', Tokyo: '#A78BFA', London: '#5DCAA5',
  'New York': '#E8724A', Premarket: '#EFC97A', 'After Hours': '#8B8882',
};
const RATING_COLORS = { A: '#5DCAA5', B: '#85B7EB', C: '#EFC97A', D: '#F09595' };
const RATING_LABELS = { A: 'Perfect', B: 'Good', C: 'Average', D: 'Poor' };

// ── Trade Detail Modal ────────────────────────────────────────────────────────

function TradeDetailModal({ trade: t, onClose, onEdit, onDelete }) {
  const [imgOpen, setImgOpen] = useState(false);
  if (!t) return null;
  const pnlColor = t.pnl > 0 ? '#5DCAA5' : t.pnl < 0 ? '#E8724A' : 'var(--c-text-2)';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '16px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--c-surface)', borderRadius: '20px',
        border: '1px solid var(--c-border)', width: '100%', maxWidth: '480px',
        maxHeight: '90vh', overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--c-text)' }}>{t.symbol}</span>
              <span style={{
                fontSize: '11px', padding: '2px 8px', borderRadius: '100px', fontWeight: 600,
                background: (t.direction === 'Long' || t.direction === 'long') ? 'rgba(93,202,165,0.12)' : 'rgba(232,114,74,0.12)',
                color:       (t.direction === 'Long' || t.direction === 'long') ? '#5DCAA5' : '#E8724A',
              }}>
                {t.direction}
              </span>
              {t.source === 'tradovate' || t.source === 'tradovate_csv' ? (
                <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '100px', background: 'rgba(0,194,224,0.1)', color: '#00C2E0', border: '1px solid rgba(0,194,224,0.2)' }}>
                  Tradovate
                </span>
              ) : null}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--c-text-2)' }}>{t.date}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--c-text-2)', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
        </div>

        {/* P&L hero */}
        <div style={{ padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', fontWeight: 700, color: pnlColor, letterSpacing: '-1px' }}>
            {t.pnl > 0 ? '+' : ''}{fmt(t.pnl)}
          </div>
          {t.pnl > 0
            ? <div style={{ fontSize: '12px', color: '#5DCAA5', marginTop: '2px' }}>Win</div>
            : t.pnl < 0
            ? <div style={{ fontSize: '12px', color: '#E8724A', marginTop: '2px' }}>Loss</div>
            : <div style={{ fontSize: '12px', color: 'var(--c-text-2)', marginTop: '2px' }}>Breakeven</div>}
        </div>

        {/* Session + Rating badges */}
        {(t.session || t.rating) && (
          <div style={{ padding: '0 20px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {t.session && (
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                background: `${SESSION_COLORS[t.session] || '#8B8882'}22`,
                color: SESSION_COLORS[t.session] || '#8B8882',
                border: `1px solid ${SESSION_COLORS[t.session] || '#8B8882'}44`,
              }}>
                ● {t.session}
              </span>
            )}
            {t.rating && (
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                background: `${RATING_COLORS[t.rating]}22`,
                color: RATING_COLORS[t.rating],
                border: `1px solid ${RATING_COLORS[t.rating]}44`,
              }}>
                {t.rating} · {RATING_LABELS[t.rating]}
              </span>
            )}
          </div>
        )}

        {/* Details grid */}
        <div style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { label: 'Entry', value: t.entry ? `$${Number(t.entry).toFixed(2)}` : '—' },
            { label: 'Exit',  value: t.exit  ? `$${Number(t.exit).toFixed(2)}`  : '—' },
            { label: 'Qty',   value: t.qty || '—' },
            { label: 'Setup', value: t.setup || '—' },
            { label: 'Risk',  value: t.risk  ? fmt(t.risk)   : '—' },
            { label: 'Target', value: t.reward ? fmt(t.reward) : '—' },
          ].map(d => (
            <div key={d.label} style={{ background: 'var(--c-bg)', borderRadius: '8px', padding: '8px 12px' }}>
              <div style={{ fontSize: '10px', color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{d.label}</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--c-text)' }}>{d.value}</div>
            </div>
          ))}
        </div>

        {/* Notes */}
        {t.notes && (
          <div style={{ margin: '0 20px 16px', background: 'var(--c-bg)', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Notes</div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--c-text)', lineHeight: 1.6 }}>{t.notes}</p>
          </div>
        )}

        {/* Chart screenshot */}
        {(t.imageUrl || (t.image && t.image.startsWith('data:'))) && (
          <div style={{ margin: '0 20px 16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Chart</div>
            <img
              src={t.imageUrl || t.image} alt="chart"
              onClick={() => setImgOpen(true)}
              style={{ width: '100%', borderRadius: '10px', cursor: 'zoom-in', border: '1px solid var(--c-border)' }}
            />
          </div>
        )}

        {/* Actions */}
        <div style={{ padding: '0 20px 20px', display: 'flex', gap: '8px' }}>
          <button onClick={() => { onEdit(t); onClose(); }} style={btnStyle('#E8724A', 'rgba(232,114,74,0.08)')}>
            Edit Trade
          </button>
          <button onClick={() => { onDelete(t.id); onClose(); }} style={btnStyle('#EF4444', 'rgba(239,68,68,0.06)')}>
            Delete
          </button>
        </div>

        {/* Fullscreen image */}
        {imgOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
            onClick={() => setImgOpen(false)}>
            <img src={t.imageUrl || t.image} alt="chart" style={{ maxWidth: '92vw', maxHeight: '90vh', borderRadius: '12px' }} onClick={e => e.stopPropagation()} />
          </div>
        )}
      </div>
    </div>
  );
}

function btnStyle(color, bg) {
  return {
    flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${color}40`,
    background: bg, color, fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  };
}

// ── Trade Row Card ────────────────────────────────────────────────────────────

function TradeRow({ trade: t, onClick }) {
  const pnlColor = t.pnl > 0 ? '#5DCAA5' : t.pnl < 0 ? '#E8724A' : 'var(--c-text-2)';
  const isLong   = t.direction === 'Long' || t.direction === 'long';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '1fr auto auto',
        alignItems: 'center', gap: '12px',
        padding: '12px 14px', cursor: 'pointer',
        borderBottom: '1px solid var(--c-border)',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Left: symbol + tags */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
          background: isLong ? 'rgba(93,202,165,0.1)' : 'rgba(232,114,74,0.1)',
          color: isLong ? '#5DCAA5' : '#E8724A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700,
        }}>
          {isLong ? '↑' : '↓'}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text)', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <span style={{ whiteSpace: 'nowrap' }}>{t.symbol}</span>
            {t.setup && <span style={{ fontSize: '11px', color: 'var(--c-text-2)', fontWeight: 400, whiteSpace: 'nowrap' }}>· {t.setup}</span>}
            {t.session && (
              <span style={{
                fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px',
                background: `${SESSION_COLORS[t.session] || '#8B8882'}20`,
                color: SESSION_COLORS[t.session] || '#8B8882',
                whiteSpace: 'nowrap',
              }}>
                {t.session}
              </span>
            )}
            {t.rating && (
              <span style={{
                fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '6px',
                background: `${RATING_COLORS[t.rating]}20`,
                color: RATING_COLORS[t.rating],
              }}>
                {t.rating}
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--c-text-2)', marginTop: '1px' }}>
            {t.date}
            {t.qty ? ` · ${t.qty} contract${t.qty !== 1 ? 's' : ''}` : ''}
            {(t.source === 'tradovate' || t.source === 'tradovate_csv') ? ' · Tradovate' : ''}
          </div>
        </div>
      </div>

      {/* Notes indicator */}
      {t.notes && (
        <div style={{ fontSize: '13px', color: 'var(--c-text-2)', opacity: 0.5, flexShrink: 0 }} title={t.notes}>💬</div>
      )}

      {/* P&L */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: pnlColor }}>
          {t.pnl > 0 ? '+' : ''}{fmt(t.pnl)}
        </div>
        {t.entry && t.exit && (
          <div style={{ fontSize: '10px', color: 'var(--c-text-2)', marginTop: '1px' }}>
            {Number(t.entry).toFixed(2)} → {Number(t.exit).toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Date Group ────────────────────────────────────────────────────────────────

function DateGroup({ date, trades, onSelect }) {
  const dayPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const wins = trades.filter(t => t.pnl > 0).length;
  return (
    <div style={{ marginBottom: '8px', background: 'var(--c-surface)', borderRadius: '14px', border: '1px solid var(--c-border)', overflow: 'hidden' }}>
      {/* Day header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--c-border)', background: 'var(--c-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text)' }}>
            {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--c-text-2)' }}>{trades.length} trade{trades.length !== 1 ? 's' : ''} · {wins}W/{trades.length - wins}L</span>
        </div>
        <span style={{ fontSize: '13px', fontWeight: 700, color: dayPnl >= 0 ? '#5DCAA5' : '#E8724A' }}>
          {dayPnl >= 0 ? '+' : ''}{fmt(dayPnl)}
        </span>
      </div>
      {/* Trades */}
      {trades.map(t => (
        <TradeRow key={t.id} trade={t} onClick={() => onSelect(t)} />
      ))}
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function History({ showToast }) {
  const { trades, deleteTrade } = useApp();
  const [selectedTrade,  setSelectedTrade]  = useState(null);
  const [editTrade,      setEditTrade]      = useState(null);
  const [confirmDel,     setConfirmDel]     = useState(null);
  const [setupFilter,    setSetupFilter]    = useState('');
  const [symbolFilter,   setSymbolFilter]   = useState('');
  const [outcomeFilter,  setOutcomeFilter]  = useState('');
  const [sourceFilter,   setSourceFilter]   = useState('');
  const [sessionFilter,  setSessionFilter]  = useState('');
  const [ratingFilter,   setRatingFilter]   = useState('');
  const [search,         setSearch]         = useState('');
  const [sortBy,         setSortBy]         = useState('date_desc');
  const [filtersOpen,    setFiltersOpen]    = useState(false);

  const setups    = [...new Set(trades.map(t => t.setup).filter(Boolean))].sort();
  const symbols   = [...new Set(trades.map(t => t.symbol))].sort();
  const sessions  = [...new Set(trades.map(t => t.session).filter(Boolean))].sort();
  const hasSynced = trades.some(t => t.source === 'tradovate' || t.source === 'tradovate_csv');

  const filtered = useMemo(() => {
    let list = trades.filter(t => {
      if (setupFilter   && t.setup   !== setupFilter) return false;
      if (symbolFilter  && t.symbol  !== symbolFilter) return false;
      if (sourceFilter  === 'manual'   && (t.source === 'tradovate' || t.source === 'tradovate_csv')) return false;
      if (sourceFilter  === 'tradovate' && t.source !== 'tradovate' && t.source !== 'tradovate_csv') return false;
      if (outcomeFilter === 'win'       && t.pnl <= 0) return false;
      if (outcomeFilter === 'loss'      && t.pnl >= 0) return false;
      if (outcomeFilter === 'breakeven' && t.pnl !== 0) return false;
      if (sessionFilter && t.session !== sessionFilter) return false;
      if (ratingFilter  && t.rating  !== ratingFilter)  return false;
      if (search) {
        const q = search.toLowerCase();
        return t.symbol?.toLowerCase().includes(q) ||
               (t.notes || '').toLowerCase().includes(q) ||
               (t.setup || '').toLowerCase().includes(q);
      }
      return true;
    });

    switch (sortBy) {
      case 'date_desc': list = list.sort((a,b) => new Date(b.date) - new Date(a.date)); break;
      case 'date_asc':  list = list.sort((a,b) => new Date(a.date) - new Date(b.date)); break;
      case 'pnl_desc':  list = list.sort((a,b) => b.pnl - a.pnl); break;
      case 'pnl_asc':   list = list.sort((a,b) => a.pnl - b.pnl); break;
    }
    return list;
  }, [trades, setupFilter, symbolFilter, outcomeFilter, sourceFilter, sessionFilter, ratingFilter, search, sortBy]);

  // Group by date (only when sorted by date)
  const grouped = useMemo(() => {
    if (!sortBy.startsWith('date')) return null;
    const map = {};
    filtered.forEach(t => {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });
    return Object.entries(map).sort((a,b) =>
      sortBy === 'date_desc' ? new Date(b[0]) - new Date(a[0]) : new Date(a[0]) - new Date(b[0])
    );
  }, [filtered, sortBy]);

  const handleDelete = async (id) => {
    await deleteTrade(id);
    setConfirmDel(null);
    showToast('Trade deleted');
  };

  // Summary stats for filtered set
  const totalPnl = filtered.reduce((s,t) => s + t.pnl, 0);
  const wins = filtered.filter(t => t.pnl > 0).length;

  return (
    <div className="jm-view">
      <div className="jm-greeting">
        <p className="jm-hello">Review your trades</p>
        <h1 className="jm-page-title">Trade <span>History</span></h1>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input type="text" className="jm-in" placeholder="Search symbol, setup, notes…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: '1', minWidth: '160px' }} />
        <button
          className="jm-filter-toggle"
          onClick={() => setFiltersOpen(o => !o)}
          style={{
            background: filtersOpen ? 'rgba(232,114,74,0.12)' : 'var(--c-surface)',
            border: `1px solid ${filtersOpen ? 'rgba(232,114,74,0.3)' : 'var(--c-border)'}`,
            color: filtersOpen ? '#E8724A' : 'var(--c-text-2)',
            padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {filtersOpen ? '✕ Close' : '⊞ Filters'}
          {(symbolFilter || setupFilter || outcomeFilter || sourceFilter || sessionFilter || ratingFilter)
            ? <span style={{ marginLeft: '6px', background: '#E8724A', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
                {[symbolFilter, setupFilter, outcomeFilter, sourceFilter, sessionFilter, ratingFilter].filter(Boolean).length}
              </span>
            : null}
        </button>
      </div>

      {filtersOpen && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px', padding: '12px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '12px' }}>
          <select className="jm-in" value={symbolFilter} onChange={e => setSymbolFilter(e.target.value)} style={{ flex: '1', minWidth: '120px' }}>
            <option value="">All symbols</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="jm-in" value={setupFilter} onChange={e => setSetupFilter(e.target.value)} style={{ flex: '1', minWidth: '120px' }}>
            <option value="">All setups</option>
            {setups.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="jm-in" value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)} style={{ flex: '1', minWidth: '120px' }}>
            <option value="">Win &amp; Loss</option>
            <option value="win">Wins only</option>
            <option value="loss">Losses only</option>
            <option value="breakeven">Breakeven</option>
          </select>
          {hasSynced && (
            <select className="jm-in" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ flex: '1', minWidth: '120px' }}>
              <option value="">All sources</option>
              <option value="manual">Manual</option>
              <option value="tradovate">Tradovate</option>
            </select>
          )}
          {sessions.length > 0 && (
            <select className="jm-in" value={sessionFilter} onChange={e => setSessionFilter(e.target.value)} style={{ flex: '1', minWidth: '120px' }}>
              <option value="">All sessions</option>
              {sessions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select className="jm-in" value={ratingFilter} onChange={e => setRatingFilter(e.target.value)} style={{ flex: '1', minWidth: '120px' }}>
            <option value="">All ratings</option>
            {['A','B','C','D'].map(r => (
              <option key={r} value={r}>{r} — {RATING_LABELS[r]}</option>
            ))}
          </select>
          <select className="jm-in" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ flex: '1', minWidth: '140px' }}>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="pnl_desc">Biggest wins first</option>
            <option value="pnl_asc">Biggest losses first</option>
          </select>
          {(symbolFilter || setupFilter || outcomeFilter || sourceFilter || sessionFilter || ratingFilter) && (
            <button onClick={() => { setSymbolFilter(''); setSetupFilter(''); setOutcomeFilter(''); setSourceFilter(''); setSessionFilter(''); setRatingFilter(''); }}
              style={{ background: 'transparent', border: '1px solid rgba(226,75,74,0.3)', color: '#F09595', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Summary strip */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: 'Trades', value: filtered.length },
            { label: 'Win Rate', value: `${filtered.length ? (wins/filtered.length*100).toFixed(0) : 0}%` },
            { label: 'Net P&L', value: fmt(totalPnl), color: totalPnl >= 0 ? '#5DCAA5' : '#E8724A' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '10px', padding: '8px 14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: s.color || 'var(--c-text)' }}>{s.value}</span>
              <span style={{ fontSize: '11px', color: 'var(--c-text-2)' }}>{s.label}</span>
            </div>
          ))}
          <button
            onClick={() => {
              const headers = ['Date','Symbol','Direction','Session','Setup','Rating','Entry','Exit','Qty','P&L','Outcome','Accounts','Risk','Reward','Notes'];
              const rows = filtered.map(t => [
                t.date, t.symbol, t.direction, t.session||'', t.setup||'', t.rating||'',
                t.entry||'', t.exit||'', t.qty||'', t.pnl?.toFixed(2)||'0', t.outcome||'',
                t.accounts||1, t.risk||'', t.reward||'',
                (t.notes||'').replace(/"/g, '""')
              ]);
              const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `tradeedge_export_${new Date().toISOString().slice(0,10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              showToast('CSV exported');
            }}
            style={{
              background: 'transparent', border: '1px solid var(--c-border)',
              color: 'var(--c-text-2)', padding: '8px 14px', borderRadius: '10px',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              marginLeft: 'auto', whiteSpace: 'nowrap',
            }}
          >
            ↓ Export CSV
          </button>
        </div>
      )}

      {/* Trade list */}
      {filtered.length === 0 ? (
        <div className="jm-empty">
          <div className="jm-empty-icon">◎</div>
          {trades.length === 0
            ? 'No trades yet — log your first trade or import from Connections.'
            : 'No trades match your filters.'}
        </div>
      ) : grouped ? (
        grouped.map(([date, dayTrades]) => (
          <DateGroup key={date} date={date} trades={dayTrades} onSelect={setSelectedTrade} />
        ))
      ) : (
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '14px', overflow: 'hidden' }}>
          {filtered.map(t => (
            <TradeRow key={t.id} trade={t} onClick={() => setSelectedTrade(t)} />
          ))}
        </div>
      )}

      {/* Trade detail modal */}
      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onEdit={t => { setSelectedTrade(null); setEditTrade(t); }}
          onDelete={id => { setConfirmDel(id); setSelectedTrade(null); }}
        />
      )}

      {/* Delete confirmation */}
      {confirmDel && (
        <>
          <div className="edit-overlay" onClick={() => setConfirmDel(null)} />
          <div className="edit-modal">
            <div className="edit-card" style={{ maxWidth: '380px' }}>
              <h2 style={{ fontSize: '17px' }}>Delete this trade?</h2>
              <p style={{ fontSize: '13px', color: 'var(--c-text-2)', margin: '0 0 20px', lineHeight: 1.5 }}>
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
