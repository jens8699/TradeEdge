import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt } from '../../lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const RATING_COLORS = { A: '#E07A3B', B: '#A89687', C: '#EFC97A', D: '#C65A45' };

export default function Calendar() {
  const { trades } = useApp();
  const [cursor, setCursor] = useState(() => {
    const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [selected, setSelected] = useState(null);
  const { y, m } = cursor;

  // ── Data ───────────────────────────────────────────────────────────────────
  const dayMap = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      const d = new Date(t.date + 'T12:00:00');
      if (d.getFullYear() === y && d.getMonth() === m) {
        if (!map[t.date]) map[t.date] = { pnl: 0, count: 0, wins: 0, list: [] };
        map[t.date].pnl   += t.pnl;
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
    // Pad to fill last row
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [y, m, dayMap]);

  const summary = useMemo(() => {
    const days  = Object.values(dayMap);
    const totalPnl = days.reduce((s, d) => s + d.pnl, 0);
    const green = days.filter(d => d.pnl > 0).length;
    const totalTrades = days.reduce((s, d) => s + d.count, 0);
    const wins  = days.reduce((s, d) => s + d.wins, 0);
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    return { totalPnl, green, tradingDays: days.length, totalTrades, winRate };
  }, [dayMap]);

  const today   = new Date().toISOString().slice(0, 10);
  const selData = selected ? dayMap[selected] : null;

  const prev = () => setCursor(c => c.m === 0  ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 });
  const next = () => setCursor(c => c.m === 11 ? { y: c.y + 1, m: 0  } : { y: c.y, m: c.m + 1 });

  // ── Month label ────────────────────────────────────────────────────────────
  const monthName = new Date(y, m, 1).toLocaleString('en-US', { month: 'long' });

  // ── Shared styles ──────────────────────────────────────────────────────────
  const navBtn = {
    width: 34, height: 34, border: '1px solid var(--c-border)', borderRadius: 8,
    background: 'transparent', color: 'var(--c-text-2)', fontSize: 18,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'border-color 0.15s, color 0.15s',
  };

  return (
    <div style={{ padding: '36px 44px', maxWidth: 980, paddingBottom: 48 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
            Calendar
          </div>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.1 }}>
            {monthName}, <em style={{ fontStyle: 'italic', color: 'var(--c-accent)' }}>{y}</em>.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <button style={navBtn} onClick={prev}>‹</button>
          <span style={{ fontSize: 12, color: 'var(--c-text-2)', fontFamily: "'JetBrains Mono', monospace", padding: '0 6px', letterSpacing: '0.04em' }}>
            {monthName.slice(0, 3).toUpperCase()} {y}
          </span>
          <button style={navBtn} onClick={next}>›</button>
        </div>
      </div>

      {/* ── Summary row ── */}
      {summary.totalTrades > 0 && (
        <div style={{ display: 'flex', gap: 28, fontSize: 13, color: 'var(--c-text-2)', marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>
            {summary.totalPnl >= 0 ? 'Up' : 'Down'}{' '}
            <span style={{ color: summary.totalPnl >= 0 ? 'var(--c-accent)' : '#C65A45', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(summary.totalPnl)}
            </span>{' '}month-to-date
          </span>
          <span style={{ color: 'var(--c-border)' }}>·</span>
          <span>{summary.totalTrades} trade{summary.totalTrades === 1 ? '' : 's'}</span>
          <span style={{ color: 'var(--c-border)' }}>·</span>
          <span>{summary.winRate.toFixed(0)}% win rate</span>
          <span style={{ color: 'var(--c-border)' }}>·</span>
          <span>{summary.tradingDays} trading day{summary.tradingDays === 1 ? '' : 's'}</span>
        </div>
      )}

      {/* ── Hairline ── */}
      <div style={{ height: 1, background: 'var(--c-border)', marginBottom: 20 }} />

      {/* ── Day headers ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
        {DAYS.map(d => (
          <div key={d} style={{
            fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--c-text-2)', padding: '4px 8px', opacity: 0.7,
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* ── Day grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {grid.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} style={{ minHeight: 80 }} />;

          const isToday    = cell.key === today;
          const isSelected = cell.key === selected;
          const hasTrades  = !!cell.count;
          const isWeekend  = (i % 7) >= 5;
          const isProfit   = cell.pnl > 0;
          const isLoss     = cell.pnl < 0;

          const bg = hasTrades
            ? isProfit ? 'rgba(224,122,59,0.10)' : isLoss ? 'rgba(198,90,69,0.10)' : 'transparent'
            : 'transparent';

          const borderColor = isSelected
            ? 'var(--c-accent)'
            : isToday
            ? 'var(--c-accent)'
            : 'var(--c-border)';

          return (
            <div
              key={cell.key}
              onClick={() => hasTrades && setSelected(isSelected ? null : cell.key)}
              style={{
                minHeight: 82, borderRadius: 6,
                border: `1px solid ${borderColor}`,
                background: bg,
                padding: '10px 10px 8px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                cursor: hasTrades ? 'pointer' : 'default',
                opacity: !hasTrades && isWeekend ? 0.35 : 1,
                transition: 'border-color 0.15s, background 0.15s',
                boxSizing: 'border-box',
              }}
            >
              {/* Day number */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{
                  fontSize: 11, fontWeight: isToday ? 700 : 400,
                  color: isToday ? 'var(--c-accent)' : 'var(--c-text-2)',
                }}>
                  {cell.d}
                </span>
                {isToday && (
                  <span style={{ fontSize: 9, color: 'var(--c-accent)', fontStyle: 'italic', fontFamily: "'Fraunces', serif" }}>
                    today
                  </span>
                )}
              </div>

              {/* P&L + trade count */}
              {hasTrades && (
                <div>
                  <div style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13, fontWeight: 600,
                    color: isProfit ? 'var(--c-accent)' : '#C65A45',
                    letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.2,
                  }}>
                    {isProfit ? '+' : ''}{cell.pnl >= 1000 || cell.pnl <= -1000
                      ? (cell.pnl / 1000).toFixed(1) + 'k'
                      : fmt(cell.pnl)}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--c-text-2)', marginTop: 2, letterSpacing: '0.04em' }}>
                    {cell.count} trade{cell.count === 1 ? '' : 's'}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Selected day detail ── */}
      {selected && selData && (
        <div style={{ marginTop: 24, border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-text)', letterSpacing: '-0.01em' }}>
                {new Date(selected + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginTop: 3 }}>
                {selData.count} trade{selData.count !== 1 ? 's' : ''} · {selData.wins}W / {selData.count - selData.wins}L
              </div>
            </div>
            <div style={{
              fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
              color: selData.pnl >= 0 ? 'var(--c-accent)' : '#C65A45',
              letterSpacing: '-0.02em',
            }}>
              {selData.pnl >= 0 ? '+' : ''}{fmt(selData.pnl)}
            </div>
          </div>

          {/* Trade list */}
          <div>
            {[...selData.list].map((t, i) => (
              <div key={t.id || i} style={{
                display: 'grid', gridTemplateColumns: '72px 1fr auto 32px',
                gap: 20, padding: '13px 24px', alignItems: 'baseline',
                borderBottom: i < selData.list.length - 1 ? '1px solid var(--c-border)' : 'none',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>
                  {t.symbol || '—'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
                  {[t.direction, t.setup].filter(Boolean).join(' · ') || '—'}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                  color: t.pnl >= 0 ? 'var(--c-accent)' : '#C65A45', whiteSpace: 'nowrap',
                }}>
                  {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 600, textAlign: 'right',
                  color: t.rating === 'A' ? 'var(--c-accent)' : 'var(--c-text-2)',
                }}>
                  {t.rating || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {Object.keys(dayMap).length === 0 && (
        <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--c-text-2)', fontSize: 13, lineHeight: 1.8 }}>
          No trades in {monthName} {y}.<br />
          <span style={{ opacity: 0.6 }}>Navigate to a month where you have trades.</span>
        </div>
      )}

    </div>
  );
}
