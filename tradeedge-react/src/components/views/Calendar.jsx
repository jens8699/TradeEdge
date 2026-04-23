import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt } from '../../lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SESSION_COLORS = {
  Sydney: '#A89687', Tokyo: '#A78BFA', London: '#E07A3B',
  'New York': '#E07A3B', Premarket: '#EFC97A', 'After Hours': '#8B8882',
};
const RATING_COLORS = { A: '#E07A3B', B: '#A89687', C: '#EFC97A', D: '#F09595' };

export default function Calendar() {
  const { trades } = useApp();
  const [cursor, setCursor] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [selected, setSelected] = useState(null);

  const { y, m } = cursor;

  const dayMap = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      const d = new Date(t.date + 'T12:00:00');
      if (d.getFullYear() === y && d.getMonth() === m) {
        if (!map[t.date]) map[t.date] = { pnl: 0, count: 0, wins: 0, list: [] };
        map[t.date].pnl += t.pnl;
        map[t.date].count++;
        if (t.pnl > 0) map[t.date].wins++;
        map[t.date].list.push(t);
      }
    });
    return map;
  }, [trades, y, m]);

  const grid = useMemo(() => {
    const first = new Date(y, m, 1);
    const total = new Date(y, m + 1, 0).getDate();
    let startDow = first.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1; // Mon-first
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ d, key, ...(dayMap[key] || {}) });
    }
    return cells;
  }, [y, m, dayMap]);

  const summary = useMemo(() => {
    const days = Object.values(dayMap);
    const totalPnl = days.reduce((s, d) => s + d.pnl, 0);
    const green = days.filter(d => d.pnl > 0).length;
    const red = days.filter(d => d.pnl < 0).length;
    const trades_ = days.reduce((s, d) => s + d.count, 0);
    const bestPnl = days.reduce((b, d) => d.pnl > b ? d.pnl : b, -Infinity);
    const worstPnl = days.reduce((w, d) => d.pnl < w ? d.pnl : w, Infinity);
    return { totalPnl, green, red, trades: trades_, best: isFinite(bestPnl) ? bestPnl : 0, worst: isFinite(worstPnl) ? worstPnl : 0 };
  }, [dayMap]);

  const maxAbs = useMemo(() => {
    const vals = Object.values(dayMap).map(d => Math.abs(d.pnl));
    return vals.length ? Math.max(...vals, 1) : 1;
  }, [dayMap]);

  const monthLabel = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date().toISOString().slice(0, 10);

  const prev = () => setCursor(c => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 });
  const next = () => setCursor(c => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 });

  const selData = selected ? dayMap[selected] : null;

  function tileStyle(cell) {
    if (!cell || !cell.count) return {};
    const intensity = Math.min(0.9, 0.2 + (Math.abs(cell.pnl) / maxAbs) * 0.7);
    if (cell.pnl > 0) return { background: `rgba(224,122,59,${intensity})`, borderColor: `rgba(224,122,59,${intensity + 0.1})` };
    if (cell.pnl < 0) return { background: `rgba(226,75,74,${intensity})`, borderColor: `rgba(226,75,74,${intensity + 0.1})` };
    return { background: 'rgba(139,136,130,0.15)', borderColor: 'rgba(139,136,130,0.2)' };
  }

  return (
    <div className="jm-view">
      <div className="jm-greeting">
        <p className="jm-hello">Your trading history</p>
        <h1 className="jm-page-title">Trading <span>Calendar</span></h1>
      </div>

      {/* Month nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
        <button onClick={prev} style={{ background:'rgba(255,255,255,0.05)', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'#E8E6E1', fontSize:'18px', width:'36px', height:'36px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
        <h2 style={{ fontSize:'17px', fontWeight:700, color:'#E8E6E1', margin:0 }}>{monthLabel}</h2>
        <button onClick={next} style={{ background:'rgba(255,255,255,0.05)', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'#E8E6E1', fontSize:'18px', width:'36px', height:'36px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
      </div>

      {/* Summary chips */}
      {Object.keys(dayMap).length > 0 && (
        <div className="cal-chips-row" style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px', marginBottom:'16px' }}>
          {[
            { label: 'Month P/L', val: fmt(summary.totalPnl), color: summary.totalPnl >= 0 ? '#E07A3B' : '#F09595' },
            { label: 'Green days', val: summary.green, color: '#E07A3B' },
            { label: 'Red days', val: summary.red, color: '#F09595' },
            { label: 'Best day', val: fmt(summary.best), color: '#E07A3B' },
            { label: 'Worst day', val: fmt(summary.worst), color: '#F09595' },
          ].map(chip => (
            <div key={chip.label} className="jm-card" style={{ padding:'10px 12px', textAlign:'center' }}>
              <p style={{ fontSize:'10px', color:'#8B8882', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px' }}>{chip.label}</p>
              <p style={{ fontSize:'14px', fontWeight:800, color: chip.color }}>{chip.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div className="jm-card" style={{ padding:'16px' }}>
        {/* Weekday headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', marginBottom:'6px' }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:'10px', fontWeight:700, color:'#6B6760', textTransform:'uppercase', letterSpacing:'0.5px', padding:'4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px' }}>
          {grid.map((cell, i) => {
            if (!cell) return <div key={`e-${i}`} />;
            const isToday = cell.key === today;
            const isSelected = cell.key === selected;
            const hasTrades = !!cell.count;
            const style = tileStyle(cell);
            return (
              <div
                key={cell.key}
                onClick={() => hasTrades && setSelected(isSelected ? null : cell.key)}
                style={{
                  borderRadius: '8px',
                  border: isSelected ? '1.5px solid #E07A3B' : `0.5px solid ${style.borderColor || 'rgba(255,255,255,0.06)'}`,
                  background: style.background || 'rgba(255,255,255,0.02)',
                  padding: '6px 4px',
                  minHeight: '60px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  cursor: hasTrades ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  outline: isToday ? '1.5px solid rgba(224,122,59,0.5)' : 'none',
                }}
              >
                <span style={{ fontSize:'11px', fontWeight: isToday ? 800 : 500, color: isToday ? '#E07A3B' : hasTrades ? '#fff' : '#5F5C56', marginBottom:'3px' }}>{cell.d}</span>
                {hasTrades && (
                  <>
                    <span style={{ fontSize:'10px', fontWeight:800, color: cell.pnl > 0 ? '#fff' : cell.pnl < 0 ? '#fff' : '#E8E6E1', lineHeight:1.2, textAlign:'center' }}>
                      {cell.pnl >= 0 ? '+' : ''}{cell.pnl >= 1000 || cell.pnl <= -1000
                        ? (cell.pnl/1000).toFixed(1)+'k'
                        : cell.pnl.toFixed(0)}
                    </span>
                    <span style={{ fontSize:'9px', color:'rgba(255,255,255,0.6)', marginTop:'2px' }}>{cell.count}t</span>
                    {/* Session color dots */}
                    <div style={{ display:'flex', gap:'2px', marginTop:'2px', justifyContent:'center', flexWrap:'wrap' }}>
                      {[...new Set(cell.list.map(t => t.session).filter(Boolean))].slice(0,3).map(s => (
                        <div key={s} style={{ width:'5px', height:'5px', borderRadius:'50%', background: SESSION_COLORS[s] || '#8B8882' }} title={s} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selected && selData && (
        <div className="jm-card" style={{ marginTop:'12px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <div>
              <h2 className="jm-card-title" style={{ margin:0 }}>
                {new Date(selected + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
              </h2>
              <p style={{ fontSize:'12px', color:'#8B8882', marginTop:'3px' }}>{selData.count} trade{selData.count !== 1 ? 's' : ''} · {selData.wins}W / {selData.count - selData.wins}L</p>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ fontSize:'22px', fontWeight:900, color: selData.pnl >= 0 ? '#E07A3B' : '#F09595', margin:0 }}>
                {selData.pnl >= 0 ? '+' : ''}{fmt(selData.pnl)}
              </p>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {[...selData.list].sort((a,b) => (a.createdAt||'').localeCompare(b.createdAt||'')).map((t, i) => (
              <div key={t.id || i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderRadius:'8px', background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'3px', height:'32px', borderRadius:'2px', background: t.pnl > 0 ? '#E07A3B' : t.pnl < 0 ? '#E24B4A' : '#8B8882' }} />
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', margin:'0 0 2px', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'13px', fontWeight:700, color:'#E8E6E1' }}>{t.symbol}</span>
                      <span style={{ fontSize:'11px', fontWeight:400, color:'#8B8882', textTransform:'lowercase' }}>{t.direction}</span>
                      {t.session && (
                        <span style={{ fontSize:'9px', fontWeight:700, padding:'2px 5px', borderRadius:'4px', background:`${SESSION_COLORS[t.session]||'#8B8882'}22`, color:SESSION_COLORS[t.session]||'#8B8882' }}>● {t.session}</span>
                      )}
                      {t.rating && (
                        <span style={{ fontSize:'9px', fontWeight:700, padding:'2px 5px', borderRadius:'4px', background:`${RATING_COLORS[t.rating]}22`, color:RATING_COLORS[t.rating] }}>{t.rating}</span>
                      )}
                    </div>
                    <p style={{ fontSize:'11px', color:'#6B6760', margin:0 }}>{t.setup || 'No setup tagged'}</p>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontSize:'14px', fontWeight:800, color: t.pnl > 0 ? '#E07A3B' : t.pnl < 0 ? '#F09595' : '#8B8882', margin:'0 0 2px' }}>
                    {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
                  </p>
                  <p style={{ fontSize:'10px', color:'#6B6760', margin:0, textTransform:'uppercase' }}>{t.outcome}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(dayMap).length === 0 && (
        <div style={{ textAlign:'center', padding:'3rem 0', color:'#5F5C56', fontSize:'13px', lineHeight:1.8 }}>
          No trades logged in {monthLabel}.<br />Navigate to a month where you have trades.
        </div>
      )}
    </div>
  );
}
