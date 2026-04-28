import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { filterPeriod, computeStats, fmt, animateCount } from '../../lib/utils';

// ── helpers ───────────────────────────────────────────────────────────────────

function getStreak(list) {
  if (!list.length) return { current: 0, type: 'none', longest: 0, longestLoss: 0 };
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  let current = 0, type = 'none';
  for (const t of sorted) {
    if (t.pnl > 0)      { if (type === 'none' || type === 'win')  { type = 'win';  current++; } else break; }
    else if (t.pnl < 0) { if (type === 'none' || type === 'loss') { type = 'loss'; current++; } else break; }
    else break;
  }
  let longestW = 0, longestL = 0, runW = 0, runL = 0;
  const asc = [...list].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of asc) {
    if (t.pnl > 0)      { runW++; runL = 0; longestW = Math.max(longestW, runW); }
    else if (t.pnl < 0) { runL++; runW = 0; longestL = Math.max(longestL, runL); }
    else                 { runW = 0; runL = 0; }
  }
  return { current, type, longest: longestW, longestLoss: longestL };
}

function getSetupStats(list) {
  const map = {};
  list.filter(t => t.setup).forEach(t => {
    if (!map[t.setup]) map[t.setup] = { pnl: 0, count: 0, wins: 0, losses: 0 };
    map[t.setup].pnl += t.pnl;
    map[t.setup].count++;
    if (t.pnl > 0) map[t.setup].wins++;
    else if (t.pnl < 0) map[t.setup].losses++;
  });
  return Object.entries(map)
    .map(([name, v]) => ({ name, ...v, wr: v.count ? Math.round(v.wins / v.count * 100) : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
}

function getDayOfWeekStats(list) {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const map = {};
  DAYS.forEach((d, i) => { map[i] = { label: d, pnl: 0, count: 0, wins: 0 }; });
  list.forEach(t => {
    const dow = new Date(t.date + 'T12:00:00').getDay();
    map[dow].pnl += t.pnl;
    map[dow].count++;
    if (t.pnl > 0) map[dow].wins++;
  });
  return Object.values(map).filter(d => d.count > 0);
}

function getConsistencyScore(s) {
  if (s.count < 3) return null;
  let score = 50;
  score += Math.min(20, (s.winRate - 40) * 0.8);
  if (s.pf >= 2) score += 15; else if (s.pf >= 1.5) score += 10; else if (s.pf >= 1) score += 5; else score -= 10;
  if (s.rr >= 2) score += 10; else if (s.rr >= 1.5) score += 6;  else if (s.rr >= 1) score += 2; else score -= 5;
  if (s.count >= 20) score += 5; else if (s.count >= 10) score += 2;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreLabel(n) {
  if (n >= 85) return { label: 'Elite',       color: '#E07A3B' };
  if (n >= 70) return { label: 'Strong',      color: '#E07A3B' };
  if (n >= 55) return { label: 'Developing',  color: '#EFC97A' };
  if (n >= 40) return { label: 'Inconsistent',color: '#A89687' };
  return              { label: 'Needs work',  color: '#C65A45' };
}

// ── layout helpers ─────────────────────────────────────────────────────────────

function HR() {
  return <div style={{ height: 1, background: 'var(--c-border)', margin: '28px 0' }} />;
}

function Eyebrow({ children }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

const PERIODS = [
  { key: 'week',  label: '1W'  },
  { key: 'month', label: '1M'  },
  { key: 'all',   label: 'All' },
];

export default function Stats() {
  const { trades } = useApp();
  const [period, setPeriod] = useState('month');
  const heroRef  = useRef(null);
  const dowRef   = useRef(null);
  const dowChart = useRef(null);

  const list = filterPeriod(trades, period);
  const s    = computeStats(list);

  const streak      = useMemo(() => getStreak(list), [list]);
  const setups      = useMemo(() => getSetupStats(list), [list]);
  const dowStats    = useMemo(() => getDayOfWeekStats(list), [list]);
  const consistency = useMemo(() => getConsistencyScore(s), [s]);
  const consistencyInfo = consistency !== null ? scoreLabel(consistency) : null;

  const topWins   = useMemo(() => [...list].filter(t => t.pnl > 0).sort((a, b) => b.pnl - a.pnl).slice(0, 3), [list]);
  const topLosses = useMemo(() => [...list].filter(t => t.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 3), [list]);

  // Animate hero P&L
  useEffect(() => {
    if (heroRef.current) animateCount(heroRef.current, s.totalPnl);
  }, [s.totalPnl, period]);

  // Day-of-week bar chart
  useEffect(() => {
    if (typeof window === 'undefined') return;
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      if (dowChart.current) { dowChart.current.destroy(); dowChart.current = null; }
      const ctx = dowRef.current;
      if (!ctx || !dowStats.length) return;
      const colors = dowStats.map(d => d.pnl >= 0 ? 'rgba(224,122,59,0.80)' : 'rgba(198,90,69,0.75)');
      dowChart.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: dowStats.map(d => d.label),
          datasets: [{
            data: dowStats.map(d => +(d.pnl.toFixed(2))),
            backgroundColor: colors,
            borderRadius: 6,
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'var(--c-surface)', titleColor: 'var(--c-text)', bodyColor: 'var(--c-text-2)',
              borderColor: 'var(--c-border)', borderWidth: 1, padding: 10, cornerRadius: 8,
              callbacks: {
                label: c => {
                  const entry = dowStats.find(d => d.label === c.label);
                  return `${c.raw < 0 ? '-$' : '+$'}${Math.abs(c.raw).toFixed(2)} · ${entry?.count || 0} trades`;
                },
              },
            },
          },
          scales: {
            y: { ticks: { color: 'var(--c-text-2)', callback: v => (v < 0 ? '-$' : '$') + Math.abs(v) }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false } },
            x: { ticks: { color: 'var(--c-text-2)' }, grid: { display: false }, border: { display: false } },
          },
        },
      });
    });
  }, [list, period, dowStats]);

  useEffect(() => () => {
    if (dowChart.current) dowChart.current.destroy();
  }, []);

  const maxSetupPnl = setups.length ? Math.max(...setups.map(ss => Math.abs(ss.pnl))) : 1;
  const isProfit = s.totalPnl >= 0;

  // Win rate ring values
  const ringR = 38, ringCirc = 2 * Math.PI * ringR;
  const ringDash = (Math.max(0, Math.min(100, s.winRate)) / 100) * ringCirc;

  return (
    <div style={{ padding: '36px 44px', paddingBottom: 64 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <Eyebrow>Stats</Eyebrow>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 34, fontWeight: 700,
            color: 'var(--c-text)', letterSpacing: '-0.03em', lineHeight: 1.1,
          }}>
            The numbers.
          </div>
          {consistencyInfo && list.length >= 3 && (
            <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginTop: 8 }}>
              Consistency score:{' '}
              <span style={{ color: consistencyInfo.color, fontWeight: 600 }}>
                {consistency} — {consistencyInfo.label}
              </span>
            </div>
          )}
        </div>

        {/* Period tabs */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-border)', borderRadius: 8, padding: 4 }}>
          {PERIODS.map(({ key, label }) => {
            const active = period === key;
            return (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                style={{
                  all: 'unset', cursor: 'pointer',
                  padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em',
                  background: active ? 'var(--c-accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--c-text-2)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <HR />

      {/* ── Flat hero stats ── */}
      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--c-text-2)', fontSize: 13, lineHeight: 1.8 }}>
          No trades logged for this period.<br />
          <span style={{ opacity: 0.6 }}>Log some trades to see your stats.</span>
        </div>
      ) : (
        <>
          {/* 4-up hero */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginBottom: 36 }}>
            <HeroStat
              label="Net P&L"
              valueRef={heroRef}
              rawValue={s.totalPnl}
              display="$0.00"
              color={isProfit ? 'var(--c-accent)' : '#C65A45'}
              size={48}
              sub={`${s.count} trade${s.count !== 1 ? 's' : ''} · ${s.wins}W / ${s.losses}L`}
            />
            <HeroStat
              label="Win Rate"
              display={`${s.winRate.toFixed(1)}%`}
              color="var(--c-text)"
              size={38}
              sub={s.winRate >= 60 ? 'Above threshold' : s.winRate >= 40 ? 'In the zone' : 'Below threshold'}
            />
            <HeroStat
              label="Profit Factor"
              display={isFinite(s.pf) ? s.pf.toFixed(2) : '∞'}
              color="var(--c-text)"
              size={38}
              sub={s.pf >= 1.5 ? 'Solid edge' : s.pf >= 1 ? 'Breakeven zone' : 'Negative edge'}
            />
            <HeroStat
              label="Avg R:R"
              display={s.losses === 0 ? '—' : s.rr.toFixed(2)}
              color="var(--c-text)"
              size={38}
              sub={s.losses === 0 ? 'No losses yet' : s.rr >= 1.5 ? 'Healthy ratio' : s.rr >= 1 ? 'Needs work' : 'Risk > reward'}
            />
          </div>

          {/* ── Secondary stat cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
            <SecondaryCard label="Avg Win"      value={fmt(s.avgWin)}  color="var(--c-accent)" />
            <SecondaryCard label="Avg Loss"     value={fmt(s.avgLoss)} color="#C65A45" />
            <SecondaryCard label="Largest Win"  value={fmt(s.best)}    color="var(--c-accent)" />
            <SecondaryCard label="Max Drawdown" value={fmt(s.worst)}   color="#C65A45" />
          </div>
          {/* ── R-multiple cards (only when risk data exists) ── */}
          {(s.avgRWin !== null || s.expectancy !== null) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 4 }}>
              {s.avgRWin !== null && (
                <SecondaryCard label="Avg R (Wins)" value={`+${s.avgRWin.toFixed(2)}R`} color="var(--c-accent)" />
              )}
              {s.avgRLoss !== null && (
                <SecondaryCard label="Avg R (Losses)" value={`${s.avgRLoss.toFixed(2)}R`} color="#C65A45" />
              )}
              {s.expectancy !== null && (
                <SecondaryCard
                  label="Expectancy"
                  value={`${s.expectancy >= 0 ? '+' : ''}${s.expectancy.toFixed(2)}R`}
                  color={s.expectancy >= 0 ? 'var(--c-accent)' : '#C65A45'}
                />
              )}
            </div>
          )}

          <HR />

          {/* ── Day-of-week chart + Win Rate ring ── */}
          {dowStats.length > 1 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 36, alignItems: 'start', marginBottom: 4 }}>

                {/* Bar chart */}
                <div>
                  <Eyebrow>P/L by Day of Week</Eyebrow>
                  <div style={{ position: 'relative', height: 160 }}>
                    <canvas ref={dowRef} />
                  </div>
                  {(() => {
                    const best  = [...dowStats].sort((a, b) => b.pnl - a.pnl)[0];
                    const worst = [...dowStats].sort((a, b) => a.pnl - b.pnl)[0];
                    return best && best !== worst ? (
                      <p style={{ fontSize: 12, color: 'var(--c-text-2)', marginTop: 12, lineHeight: 1.7 }}>
                        <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>{best.label}</span> is your best day ({fmt(best.pnl)}) ·{' '}
                        <span style={{ color: '#C65A45', fontWeight: 600 }}>{worst.label}</span> is your worst ({fmt(worst.pnl)})
                      </p>
                    ) : null;
                  })()}
                </div>

                {/* Win rate ring */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 28 }}>
                  <div style={{ position: 'relative', width: 100, height: 100 }}>
                    <svg width="100" height="100" style={{ display: 'block', overflow: 'visible' }}>
                      <circle cx="50" cy="50" r={ringR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                      <circle cx="50" cy="50" r={ringR} fill="none" stroke="var(--c-accent)" strokeWidth="6"
                        strokeDasharray={`${ringDash} ${ringCirc}`} strokeLinecap="round"
                        transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
                    </svg>
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text)', fontFamily: "'Inter', sans-serif", letterSpacing: '-0.02em' }}>
                        {s.winRate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 10, textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Win Rate
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginTop: 6, textAlign: 'center', lineHeight: 1.5, opacity: 0.7 }}>
                    {s.wins}W · {s.losses}L · {s.count - s.wins - s.losses > 0 ? `${s.count - s.wins - s.losses} B/E` : ''}
                  </div>

                  {/* Streak numbers */}
                  <div style={{ marginTop: 22, width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <StreakRow label="Current streak"  value={streak.current}    type={streak.type} />
                    <StreakRow label="Longest win run" value={streak.longest}    type="win" />
                    <StreakRow label="Longest loss run" value={streak.longestLoss} type="loss" />
                  </div>
                </div>
              </div>

              <HR />
            </>
          )}

          {/* ── Setups ranked list ── */}
          {setups.length > 0 && (
            <>
              <div style={{ marginBottom: 4 }}>
                <Eyebrow>Setup Breakdown</Eyebrow>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {setups.map((ss, i) => (
                    <div key={ss.name} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto',
                      gap: 20, padding: '14px 0', alignItems: 'center',
                      borderBottom: i < setups.length - 1 ? '1px solid var(--c-border)' : 'none',
                    }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 6 }}>
                          {ss.name}
                        </div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', maxWidth: 280 }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            width: `${(Math.abs(ss.pnl) / maxSetupPnl) * 100}%`,
                            background: ss.pnl >= 0 ? 'var(--c-accent)' : '#C65A45',
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--c-text-2)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {ss.count} trade{ss.count !== 1 ? 's' : ''} · {ss.wr}% WR
                      </div>
                      <div style={{
                        fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        color: ss.pnl >= 0 ? 'var(--c-accent)' : '#C65A45',
                        whiteSpace: 'nowrap', minWidth: 72, textAlign: 'right',
                      }}>
                        {ss.pnl >= 0 ? '+' : ''}{fmt(ss.pnl)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <HR />
            </>
          )}

          {/* ── Top trades ── */}
          {(topWins.length > 0 || topLosses.length > 0) && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginBottom: 4 }}>
                {topWins.length > 0 && (
                  <div>
                    <Eyebrow>Top Wins</Eyebrow>
                    {topWins.map((t, i) => (
                      <div key={t.id || i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                        padding: '11px 0',
                        borderBottom: i < topWins.length - 1 ? '1px solid var(--c-border)' : 'none',
                      }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>{t.symbol || '—'}</span>
                          {t.setup && <span style={{ fontSize: 11, color: 'var(--c-text-2)', marginLeft: 8 }}>{t.setup}</span>}
                          <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 1 }}>{t.date}</div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-accent)', fontVariantNumeric: 'tabular-nums' }}>
                          +{fmt(t.pnl)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {topLosses.length > 0 && (
                  <div>
                    <Eyebrow>Biggest Losses</Eyebrow>
                    {topLosses.map((t, i) => (
                      <div key={t.id || i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                        padding: '11px 0',
                        borderBottom: i < topLosses.length - 1 ? '1px solid var(--c-border)' : 'none',
                      }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>{t.symbol || '—'}</span>
                          {t.setup && <span style={{ fontSize: 11, color: 'var(--c-text-2)', marginLeft: 8 }}>{t.setup}</span>}
                          <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 1 }}>{t.date}</div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#C65A45', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(t.pnl)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <HR />
            </>
          )}

          {/* ── Monthly P&L ── */}
          <MonthlyBars trades={list} />

          {/* ── Session breakdown ── */}
          <SessionBreakdown trades={list} />

          {/* ── Rating breakdown ── */}
          <RatingBreakdown trades={list} />

          {/* ── Day of week tiles ── */}
          <DayOfWeekTiles trades={list} />
        </>
      )}
    </div>
  );
}

// ── hero stat (flat, no box) ──────────────────────────────────────────────────

function HeroStat({ label, valueRef, rawValue, display, color, size, sub }) {
  return (
    <div style={{ paddingRight: 24 }}>
      <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div
        ref={valueRef}
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: size, fontWeight: 700, color,
          letterSpacing: '-0.03em', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {display}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 8, lineHeight: 1.5 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── secondary card (boxed) ────────────────────────────────────────────────────

function SecondaryCard({ label, value, color }) {
  return (
    <div style={{
      border: '1px solid var(--c-border)', borderRadius: 10,
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 10, color: 'var(--c-text-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 17, fontWeight: 700, color: color || 'var(--c-text)',
        letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
    </div>
  );
}

// ── streak row (inside ring panel) ───────────────────────────────────────────

function StreakRow({ label, value, type }) {
  const color = type === 'win' ? 'var(--c-accent)' : type === 'loss' ? '#C65A45' : 'var(--c-text-2)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 10, color: 'var(--c-text-2)', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

// ── monthly bars ──────────────────────────────────────────────────────────────

function MonthlyBars({ trades }) {
  const months = useMemo(() => {
    const map = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      map[key] = { label, pnl: 0, count: 0, wins: 0 };
    }
    trades.forEach(t => {
      const key = t.date.slice(0, 7);
      if (map[key]) { map[key].pnl += t.pnl; map[key].count++; if (t.pnl > 0) map[key].wins++; }
    });
    return Object.values(map);
  }, [trades]);

  const maxAbs = Math.max(...months.map(m => Math.abs(m.pnl)), 1);
  if (!months.some(m => m.count > 0)) return null;

  return (
    <>
      <div style={{ marginBottom: 4 }}>
        <Eyebrow>Monthly P&L</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110 }}>
          {months.map((m, i) => {
            const pct    = Math.abs(m.pnl) / maxAbs;
            const isPos  = m.pnl >= 0;
            const barH   = Math.max(4, pct * 80);
            const color  = isPos ? 'var(--c-accent)' : '#C65A45';
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color, opacity: m.count ? 1 : 0, fontVariantNumeric: 'tabular-nums' }}>
                  {m.pnl >= 0 ? '+' : ''}{Math.abs(m.pnl) >= 1000 ? (m.pnl / 1000).toFixed(1) + 'k' : m.pnl.toFixed(0)}
                </span>
                <div style={{ width: '100%', height: `${barH}px`, borderRadius: '4px 4px 0 0', background: m.count ? color : 'rgba(255,255,255,0.04)', opacity: m.count ? 0.85 : 0.3, transition: 'height 0.4s ease' }} />
                <span style={{ fontSize: 9, color: 'var(--c-text-2)', letterSpacing: '0.04em' }}>{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <HR />
    </>
  );
}

// ── session breakdown ─────────────────────────────────────────────────────────

const SESSION_COLORS = { Sydney: '#A89687', Tokyo: '#A78BFA', London: '#E07A3B', 'New York': '#E07A3B', Premarket: '#EFC97A', 'After Hours': '#A89687' };

function SessionBreakdown({ trades }) {
  const stats = useMemo(() => {
    const map = {};
    trades.filter(t => t.session).forEach(t => {
      if (!map[t.session]) map[t.session] = { pnl: 0, count: 0, wins: 0 };
      map[t.session].pnl += t.pnl; map[t.session].count++; if (t.pnl > 0) map[t.session].wins++;
    });
    return Object.entries(map)
      .map(([name, s]) => ({ name, ...s, wr: s.count ? s.wins / s.count * 100 : 0 }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  if (!stats.length) return null;
  const maxPnl = Math.max(...stats.map(s => Math.abs(s.pnl)), 1);

  return (
    <>
      <div style={{ marginBottom: 4 }}>
        <Eyebrow>Session Breakdown</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {stats.map((s, i) => {
            const color = SESSION_COLORS[s.name] || 'var(--c-text-2)';
            const pct   = Math.abs(s.pnl) / maxPnl;
            return (
              <div key={i} style={{ padding: '13px 0', borderBottom: i < stats.length - 1 ? '1px solid var(--c-border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block', boxShadow: `0 0 4px ${color}88` }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>{s.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{s.count} trade{s.count !== 1 ? 's' : ''} · {s.wr.toFixed(0)}% WR</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: s.pnl >= 0 ? 'var(--c-accent)' : '#C65A45', fontVariantNumeric: 'tabular-nums' }}>
                      {s.pnl >= 0 ? '+' : ''}{fmt(s.pnl)}
                    </span>
                  </div>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct * 100}%`, opacity: 0.7, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <HR />
    </>
  );
}

// ── rating breakdown ──────────────────────────────────────────────────────────

const RATING_COLORS_STATS  = { A: '#E07A3B', B: '#A89687', C: '#EFC97A', D: '#C65A45' };
const RATING_LABELS_STATS  = { A: 'Perfect execution', B: 'Good trade', C: 'Average', D: 'Poor execution' };

function RatingBreakdown({ trades }) {
  const stats = useMemo(() => {
    const map = {};
    trades.filter(t => t.rating).forEach(t => {
      if (!map[t.rating]) map[t.rating] = { pnl: 0, count: 0, wins: 0 };
      map[t.rating].pnl += t.pnl; map[t.rating].count++; if (t.pnl > 0) map[t.rating].wins++;
    });
    return ['A', 'B', 'C', 'D']
      .filter(r => map[r])
      .map(r => ({ rating: r, ...map[r], wr: map[r].wins / map[r].count * 100 }));
  }, [trades]);

  if (!stats.length) return null;
  const maxPnl = Math.max(...stats.map(s => Math.abs(s.pnl)), 1);

  return (
    <>
      <div style={{ marginBottom: 4 }}>
        <Eyebrow>Rating Breakdown</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {stats.map((s, i) => {
            const color = RATING_COLORS_STATS[s.rating];
            const pct   = Math.abs(s.pnl) / maxPnl;
            return (
              <div key={s.rating} style={{ padding: '13px 0', borderBottom: i < stats.length - 1 ? '1px solid var(--c-border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color, width: 18 }}>{s.rating}</span>
                    <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{RATING_LABELS_STATS[s.rating]}</span>
                    <span style={{ fontSize: 11, color: 'var(--c-text-2)', opacity: 0.6 }}>{s.count} trade{s.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{s.wr.toFixed(0)}% WR</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: s.pnl >= 0 ? 'var(--c-accent)' : '#C65A45', fontVariantNumeric: 'tabular-nums' }}>
                      {s.pnl >= 0 ? '+' : ''}{fmt(s.pnl)}
                    </span>
                  </div>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct * 100}%`, opacity: 0.75, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <HR />
    </>
  );
}

// ── day-of-week tile grid ─────────────────────────────────────────────────────

function DayOfWeekTiles({ trades }) {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const stats = useMemo(() => {
    const map = { 1: null, 2: null, 3: null, 4: null, 5: null };
    trades.forEach(t => {
      const d   = new Date(t.date + 'T12:00:00').getDay();
      const idx = d === 0 ? 7 : d;
      if (idx >= 1 && idx <= 5) {
        if (!map[idx]) map[idx] = { pnl: 0, count: 0, wins: 0 };
        map[idx].pnl += t.pnl; map[idx].count++; if (t.pnl > 0) map[idx].wins++;
      }
    });
    return [1, 2, 3, 4, 5].map(i => map[i]
      ? { ...map[i], wr: map[i].wins / map[i].count * 100, avgPnl: map[i].pnl / map[i].count }
      : null);
  }, [trades]);

  if (!stats.some(Boolean)) return null;

  const maxAbsAvg = Math.max(...stats.filter(Boolean).map(s => Math.abs(s.avgPnl)), 1);

  return (
    <div style={{ marginBottom: 4 }}>
      <Eyebrow>Day of Week</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {stats.map((s, i) => {
          const isPos  = s && s.avgPnl >= 0;
          const color  = s ? (isPos ? 'var(--c-accent)' : '#C65A45') : 'var(--c-border)';
          const bg     = s ? (isPos ? 'rgba(224,122,59,0.07)' : 'rgba(198,90,69,0.07)') : 'transparent';
          return (
            <div key={i} style={{
              background: bg,
              border: `1px solid ${s ? (isPos ? 'rgba(224,122,59,0.2)' : 'rgba(198,90,69,0.2)') : 'var(--c-border)'}`,
              borderRadius: 10, padding: '12px 10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                {DAYS[i]}
              </div>
              {s ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 4 }}>
                    {isPos ? '+' : ''}{Math.abs(s.avgPnl) >= 1000 ? (s.avgPnl / 1000).toFixed(1) + 'k' : s.avgPnl.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--c-text-2)', fontWeight: 600 }}>{s.wr.toFixed(0)}%</div>
                  <div style={{ fontSize: 9, color: 'var(--c-text-2)', marginTop: 2, opacity: 0.6 }}>{s.count}t</div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--c-text-2)', opacity: 0.3, padding: '8px 0' }}>—</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: 'var(--c-text-2)', marginTop: 8, opacity: 0.6 }}>Avg P&L per day · Win rate · Trade count</div>
    </div>
  );
}
