import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt, fmtR } from '../../lib/utils';
import EditTradeModal from '../modals/EditTradeModal';

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_COLORS = {
  Sydney: '#A89687', Tokyo: '#A78BFA', London: '#E07A3B',
  'New York': '#E07A3B', Premarket: '#EFC97A', 'After Hours': '#8B8882',
};
const RATING_COLORS = { A: '#E07A3B', B: '#A89687', C: '#EFC97A', D: '#C65A45' };
const RATING_LABELS = { A: 'Perfect', B: 'Good', C: 'Average', D: 'Poor' };

// ── Trade Detail Modal ────────────────────────────────────────────────────────

function TradeDetailModal({ trade: t, onClose, onEdit, onDelete }) {
  const [imgOpen, setImgOpen] = useState(false);
  if (!t) return null;
  const isProfit = t.pnl > 0;
  const isLoss   = t.pnl < 0;
  const pnlColor = isProfit ? 'var(--c-accent)' : isLoss ? '#C65A45' : 'var(--c-text-2)';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--c-surface)', borderRadius: 20,
        border: '1px solid var(--c-border)', width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, color: 'var(--c-text)', letterSpacing: '-0.03em' }}>
                {t.symbol}
              </span>
              {t.direction && (
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 100, fontWeight: 600,
                  fontFamily: "'Inter', sans-serif",
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--c-text-2)', border: '1px solid var(--c-border)',
                }}>
                  {t.direction}
                </span>
              )}
              {(t.source === 'tradovate' || t.source === 'tradovate_csv') && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 100, background: 'rgba(0,194,224,0.1)', color: '#00C2E0', border: '1px solid rgba(0,194,224,0.2)' }}>
                  Tradovate
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginTop: 4 }}>{t.date}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--c-text-2)', cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        {/* P&L hero */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 40, fontWeight: 700, color: pnlColor, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {isProfit ? '+' : ''}{fmt(t.pnl)}
          </div>
          <div style={{ fontSize: 12, color: pnlColor, opacity: 0.8, fontStyle: 'italic', fontFamily: "'Fraunces', serif" }}>
            {isProfit ? 'win' : isLoss ? 'loss' : 'breakeven'}
          </div>
        </div>

        {/* Session + Rating badges */}
        {(t.session || t.rating) && (
          <div style={{ padding: '14px 24px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {t.session && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                background: `${SESSION_COLORS[t.session] || '#8B8882'}22`,
                color: SESSION_COLORS[t.session] || '#8B8882',
                border: `1px solid ${SESSION_COLORS[t.session] || '#8B8882'}44`,
              }}>
                {t.session}
              </span>
            )}
            {t.rating && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: `${RATING_COLORS[t.rating]}22`,
                color: RATING_COLORS[t.rating],
                border: `1px solid ${RATING_COLORS[t.rating]}44`,
              }}>
                {t.rating} · {RATING_LABELS[t.rating]}
              </span>
            )}
            {t.setup && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'var(--c-text-2)', border: '1px solid var(--c-border)' }}>
                {t.setup}
              </span>
            )}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--c-border)', margin: '18px 0' }} />

        {/* Details grid */}
        <div style={{ padding: '0 24px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Entry',  value: t.entry  ? `$${Number(t.entry).toFixed(2)}`  : '—' },
            { label: 'Exit',   value: t.exit   ? `$${Number(t.exit).toFixed(2)}`   : '—' },
            { label: 'Qty',    value: t.qty    || '—' },
            { label: 'Setup',  value: t.setup  || '—' },
            { label: 'Risk',   value: t.risk   ? fmt(t.risk)   : '—' },
            { label: 'Target', value: t.reward ? fmt(t.reward) : '—' },
            ...(fmtR(t.pnl, t.risk) ? [{ label: 'R-Multiple', value: fmtR(t.pnl, t.risk), highlight: true }] : []),
          ].map(d => (
            <div key={d.label} style={{
              padding: '10px 12px', border: `1px solid ${d.highlight ? `${isProfit ? 'rgba(224,122,59,0.3)' : 'rgba(198,90,69,0.3)'}` : 'var(--c-border)'}`, borderRadius: 8,
              background: d.highlight ? `${isProfit ? 'rgba(224,122,59,0.05)' : 'rgba(198,90,69,0.05)'}` : 'transparent',
            }}>
              <div style={{ fontSize: 10, color: 'var(--c-text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{d.label}</div>
              <div style={{ fontSize: 13, fontWeight: d.highlight ? 700 : 500, color: d.highlight ? pnlColor : 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{d.value}</div>
            </div>
          ))}
        </div>

        {/* Notes */}
        {t.notes && (
          <div style={{ margin: '0 24px 18px' }}>
            <div style={{ fontSize: 10, color: 'var(--c-text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Notes</div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--c-text)', lineHeight: 1.7, fontFamily: "'Inter', sans-serif" }}>{t.notes}</p>
          </div>
        )}

        {/* Chart screenshot */}
        {(t.imageUrl || (t.image && t.image.startsWith('data:'))) && (
          <div style={{ margin: '0 24px 18px' }}>
            <div style={{ fontSize: 10, color: 'var(--c-text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Chart</div>
            <img
              src={t.imageUrl || t.image} alt="chart"
              onClick={() => setImgOpen(true)}
              style={{ width: '100%', borderRadius: 10, cursor: 'zoom-in', border: '1px solid var(--c-border)' }}
            />
          </div>
        )}

        {/* Actions */}
        <div style={{ padding: '4px 24px 24px', display: 'flex', gap: 8 }}>
          <button
            onClick={() => { onEdit(t); onClose(); }}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(224,122,59,0.3)', background: 'rgba(224,122,59,0.08)', color: 'var(--c-accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Edit trade
          </button>
          <button
            onClick={() => { onDelete(t.id); onClose(); }}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(198,90,69,0.25)', background: 'transparent', color: '#C65A45', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Delete
          </button>
        </div>

        {/* Fullscreen image overlay */}
        {imgOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 20 }}
            onClick={() => setImgOpen(false)}
          >
            <button onClick={() => setImgOpen(false)} style={{ position: 'fixed', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: 18, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}>✕</button>
            <img src={t.imageUrl || t.image} alt="chart" style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 12, objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Trade Row ─────────────────────────────────────────────────────────────────

function TradeRow({ trade: t, onClick, isLast }) {
  const isProfit = t.pnl > 0;
  const isLoss   = t.pnl < 0;
  const isLong   = t.direction === 'Long' || t.direction === 'long';
  const pnlColor = isProfit ? 'var(--c-accent)' : isLoss ? '#C65A45' : 'var(--c-text-2)';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '22px 1fr auto',
        gap: 14, padding: '13px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--c-border)',
        cursor: 'pointer', alignItems: 'center',
        transition: 'opacity 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.72'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {/* Direction arrow */}
      <div style={{
        fontSize: 11, fontWeight: 700, color: isLong ? 'var(--c-accent)' : '#A89687',
        textAlign: 'center', paddingTop: 1,
      }}>
        {isLong ? '↑' : '↓'}
      </div>

      {/* Symbol + metadata */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>{t.symbol}</span>
          {t.setup && <span style={{ fontSize: 11, color: 'var(--c-text-2)' }}>{t.setup}</span>}
          {t.session && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
              background: `${SESSION_COLORS[t.session] || '#8B8882'}20`,
              color: SESSION_COLORS[t.session] || '#8B8882',
            }}>
              {t.session}
            </span>
          )}
          {t.rating && (
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 6,
              background: `${RATING_COLORS[t.rating]}20`,
              color: RATING_COLORS[t.rating],
            }}>
              {t.rating}
            </span>
          )}
          {t.checklistPassed === true && (
            <span title="Pre-trade checklist passed" style={{
              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6,
              background: 'rgba(93,202,165,0.12)', color: '#5DCAA5',
            }}>✓ Plan</span>
          )}
          {t.checklistPassed === false && (
            <span title="Pre-trade checklist not passed that day" style={{
              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6,
              background: 'rgba(239,201,122,0.12)', color: '#EFC97A',
            }}>⚠ Off plan</span>
          )}
          {t.notes && <span style={{ fontSize: 11, color: 'var(--c-text-2)', opacity: 0.4 }}>✎</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 2, opacity: 0.7, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.02em' }}>
          {t.entry && t.exit ? `${Number(t.entry).toFixed(2)} → ${Number(t.exit).toFixed(2)}` : t.date}
          {t.qty ? ` · ${t.qty}` : ''}
        </div>
      </div>

      {/* P&L + R */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: pnlColor, fontVariantNumeric: 'tabular-nums', fontFamily: "'Inter', sans-serif" }}>
          {isProfit ? '+' : ''}{fmt(t.pnl)}
        </div>
        {fmtR(t.pnl, t.risk) && (
          <div style={{ fontSize: 11, color: pnlColor, opacity: 0.6, marginTop: 1, fontVariantNumeric: 'tabular-nums', fontFamily: "'JetBrains Mono', monospace" }}>
            {fmtR(t.pnl, t.risk)}
          </div>
        )}
        {t.entry && t.exit && (
          <div style={{ fontSize: 10, color: 'var(--c-text-2)', marginTop: 1, opacity: 0.6 }}>{t.date}</div>
        )}
      </div>
    </div>
  );
}

// ── Date Group ────────────────────────────────────────────────────────────────

function DateGroup({ date, trades, onSelect }) {
  const dayPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const wins   = trades.filter(t => t.pnl > 0).length;
  const label  = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Day header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{label}</span>
          <span style={{ fontSize: 11, color: 'var(--c-text-2)', opacity: 0.7 }}>
            {trades.length} trade{trades.length !== 1 ? 's' : ''} · {wins}W/{trades.length - wins}L
          </span>
        </div>
        <span style={{
          fontSize: 14, fontWeight: 700,
          color: dayPnl >= 0 ? 'var(--c-accent)' : '#C65A45',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {dayPnl >= 0 ? '+' : ''}{fmt(dayPnl)}
        </span>
      </div>
      {/* Hairline */}
      <div style={{ height: 1, background: 'var(--c-border)', marginBottom: 0 }} />
      {/* Trade rows */}
      {trades.map((t, i) => (
        <TradeRow key={t.id} trade={t} onClick={() => onSelect(t)} isLast={i === trades.length - 1} />
      ))}
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function History({ showToast }) {
  const { trades, deleteTrade } = useApp();
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [editTrade,     setEditTrade]     = useState(null);
  const [confirmDel,    setConfirmDel]    = useState(null);
  const [setupFilter,   setSetupFilter]   = useState('');
  const [symbolFilter,  setSymbolFilter]  = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [sourceFilter,  setSourceFilter]  = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [ratingFilter,  setRatingFilter]  = useState('');
  const [search,        setSearch]        = useState('');
  const [sortBy,        setSortBy]        = useState('date_desc');
  const [filtersOpen,   setFiltersOpen]   = useState(false);

  const setups    = [...new Set(trades.map(t => t.setup).filter(Boolean))].sort();
  const symbols   = [...new Set(trades.map(t => t.symbol))].sort();
  const sessions  = [...new Set(trades.map(t => t.session).filter(Boolean))].sort();
  const hasSynced = trades.some(t => t.source === 'tradovate' || t.source === 'tradovate_csv');

  const activeFilterCount = [symbolFilter, setupFilter, outcomeFilter, sourceFilter, sessionFilter, ratingFilter].filter(Boolean).length;

  const filtered = useMemo(() => {
    let list = trades.filter(t => {
      if (setupFilter   && t.setup   !== setupFilter)  return false;
      if (symbolFilter  && t.symbol  !== symbolFilter)  return false;
      if (sourceFilter === 'manual'    && (t.source === 'tradovate' || t.source === 'tradovate_csv')) return false;
      if (sourceFilter === 'tradovate' && t.source !== 'tradovate' && t.source !== 'tradovate_csv') return false;
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
      case 'date_desc': list = list.sort((a, b) => new Date(b.date) - new Date(a.date)); break;
      case 'date_asc':  list = list.sort((a, b) => new Date(a.date) - new Date(b.date)); break;
      case 'pnl_desc':  list = list.sort((a, b) => b.pnl - a.pnl); break;
      case 'pnl_asc':   list = list.sort((a, b) => a.pnl - b.pnl); break;
    }
    return list;
  }, [trades, setupFilter, symbolFilter, outcomeFilter, sourceFilter, sessionFilter, ratingFilter, search, sortBy]);

  const grouped = useMemo(() => {
    if (!sortBy.startsWith('date')) return null;
    const map = {};
    filtered.forEach(t => {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });
    return Object.entries(map).sort((a, b) =>
      sortBy === 'date_desc' ? new Date(b[0]) - new Date(a[0]) : new Date(a[0]) - new Date(b[0])
    );
  }, [filtered, sortBy]);

  const handleDelete = async (id) => {
    await deleteTrade(id);
    setConfirmDel(null);
    showToast('Trade deleted');
  };

  const totalPnl = filtered.reduce((s, t) => s + t.pnl, 0);
  const wins     = filtered.filter(t => t.pnl > 0).length;
  const tradesWithR = filtered.filter(t => t.risk > 0);
  const avgR = tradesWithR.length
    ? tradesWithR.reduce((s, t) => s + t.pnl / t.risk, 0) / tradesWithR.length
    : null;

  const handleExport = () => {
    const headers = ['Date','Symbol','Direction','Session','Setup','Rating','Entry','Exit','Qty','P&L','Outcome','Accounts','Risk','Reward','Notes'];
    const rows = filtered.map(t => [
      t.date, t.symbol, t.direction, t.session||'', t.setup||'', t.rating||'',
      t.entry||'', t.exit||'', t.qty||'', t.pnl?.toFixed(2)||'0', t.outcome||'',
      t.accounts||1, t.risk||'', t.reward||'',
      (t.notes||'').replace(/"/g, '""'),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `tradeedge_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast('CSV exported');
  };

  const inputStyle = {
    background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 8,
    padding: '8px 12px', fontSize: 12, color: 'var(--c-text)', fontFamily: "'Inter', sans-serif",
    outline: 'none', flex: 1, minWidth: 100,
  };

  return (
    <div style={{ padding: 'clamp(20px, 5vw, 36px) clamp(16px, 4.5vw, 44px) 64px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
            History
          </div>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.1 }}>
            All trades<span style={{ color: 'var(--c-accent)' }}>.</span>
          </div>
        </div>

        {/* Search + filter toggle */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 180 }}
          />
          <button
            onClick={() => setFiltersOpen(o => !o)}
            style={{
              height: 36, padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              fontFamily: "'Inter', sans-serif", cursor: 'pointer', whiteSpace: 'nowrap',
              border: filtersOpen || activeFilterCount > 0 ? '1px solid rgba(224,122,59,0.4)' : '1px solid var(--c-border)',
              background: filtersOpen ? 'rgba(224,122,59,0.08)' : 'transparent',
              color: filtersOpen || activeFilterCount > 0 ? 'var(--c-accent)' : 'var(--c-text-2)',
              transition: 'all 0.15s',
            }}
          >
            Filter{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
          </button>
        </div>
      </div>

      {/* ── Filter panel ── */}
      {filtersOpen && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20,
          padding: '16px 18px', border: '1px solid var(--c-border)', borderRadius: 12,
          background: 'rgba(255,255,255,0.02)',
        }}>
          <select style={inputStyle} value={symbolFilter} onChange={e => setSymbolFilter(e.target.value)}>
            <option value="">All symbols</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={inputStyle} value={setupFilter} onChange={e => setSetupFilter(e.target.value)}>
            <option value="">All setups</option>
            {setups.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={inputStyle} value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}>
            <option value="">Wins &amp; losses</option>
            <option value="win">Wins only</option>
            <option value="loss">Losses only</option>
            <option value="breakeven">Breakeven</option>
          </select>
          {hasSynced && (
            <select style={inputStyle} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
              <option value="">All sources</option>
              <option value="manual">Manual</option>
              <option value="tradovate">Tradovate</option>
            </select>
          )}
          {sessions.length > 0 && (
            <select style={inputStyle} value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}>
              <option value="">All sessions</option>
              {sessions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select style={inputStyle} value={ratingFilter} onChange={e => setRatingFilter(e.target.value)}>
            <option value="">All ratings</option>
            {['A','B','C','D'].map(r => <option key={r} value={r}>{r} — {RATING_LABELS[r]}</option>)}
          </select>
          <select style={inputStyle} value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="pnl_desc">Biggest wins first</option>
            <option value="pnl_asc">Biggest losses first</option>
          </select>
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setSymbolFilter(''); setSetupFilter(''); setOutcomeFilter(''); setSourceFilter(''); setSessionFilter(''); setRatingFilter(''); }}
              style={{ ...inputStyle, flex: 'none', color: '#C65A45', borderColor: 'rgba(198,90,69,0.3)', cursor: 'pointer', background: 'transparent' }}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Summary row ── */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--c-text-2)', marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>
            {totalPnl >= 0 ? 'Up' : 'Down'}{' '}
            <span style={{ color: totalPnl >= 0 ? 'var(--c-accent)' : '#C65A45', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(totalPnl)}
            </span>
          </span>
          <span style={{ color: 'var(--c-border)' }}>·</span>
          <span>{filtered.length} trade{filtered.length !== 1 ? 's' : ''}</span>
          <span style={{ color: 'var(--c-border)' }}>·</span>
          <span>{filtered.length ? (wins / filtered.length * 100).toFixed(0) : 0}% win rate</span>
          {avgR !== null && (
            <>
              <span style={{ color: 'var(--c-border)' }}>·</span>
              <span>
                avg{' '}
                <span style={{ color: avgR >= 0 ? 'var(--c-accent)' : '#C65A45', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {avgR >= 0 ? '+' : ''}{avgR.toFixed(2)}R
                </span>
              </span>
            </>
          )}
          <button
            onClick={handleExport}
            style={{
              marginLeft: 'auto', background: 'transparent',
              border: '1px solid var(--c-border)', color: 'var(--c-text-2)',
              padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            }}
          >
            Export CSV
          </button>
        </div>
      )}

      {/* ── Trade list ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--c-text-2)', fontSize: 13, lineHeight: 1.8 }}>
          {trades.length === 0
            ? 'No trades yet — log your first trade or import from Connections.'
            : 'No trades match your filters.'}
          <br />
          <span style={{ opacity: 0.5 }}>
            {trades.length > 0 ? 'Try adjusting or clearing your filters.' : ''}
          </span>
        </div>
      ) : grouped ? (
        grouped.map(([date, dayTrades]) => (
          <DateGroup key={date} date={date} trades={dayTrades} onSelect={setSelectedTrade} />
        ))
      ) : (
        <div>
          {filtered.map((t, i) => (
            <TradeRow key={t.id} trade={t} onClick={() => setSelectedTrade(t)} isLast={i === filtered.length - 1} />
          ))}
        </div>
      )}

      {/* ── Trade detail modal ── */}
      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onEdit={t => { setSelectedTrade(null); setEditTrade(t); }}
          onDelete={id => { setConfirmDel(id); setSelectedTrade(null); }}
        />
      )}

      {/* ── Delete confirmation ── */}
      {confirmDel && (
        <>
          <div
            onClick={() => setConfirmDel(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9998 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: 16, padding: '28px 28px 24px', maxWidth: 360, width: '90%', zIndex: 9999,
          }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: 'var(--c-text)', marginBottom: 10, letterSpacing: '-0.02em' }}>
              Delete this trade?
            </div>
            <p style={{ fontSize: 13, color: 'var(--c-text-2)', margin: '0 0 22px', lineHeight: 1.6 }}>
              This can't be undone.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmDel(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--c-border)', background: 'transparent', color: 'var(--c-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDel)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(198,90,69,0.35)', background: 'rgba(198,90,69,0.08)', color: '#C65A45', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Delete
              </button>
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
