import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { filterPeriod, computeStats, fmt, animateCount } from '../../lib/utils';

// ── helpers ──────────────────────────────────────────────────────────────────

function getStreak(list) {
  if (!list.length) return { current: 0, type: 'none', longest: 0, longestLoss: 0 };
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  let current = 0, type = 'none';
  for (const t of sorted) {
    if (t.pnl > 0) { if (type === 'none' || type === 'win') { type = 'win'; current++; } else break; }
    else if (t.pnl < 0) { if (type === 'none' || type === 'loss') { type = 'loss'; current++; } else break; }
    else break;
  }
  // Longest win streak
  let longestW = 0, longestL = 0, runW = 0, runL = 0;
  const asc = [...list].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of asc) {
    if (t.pnl > 0) { runW++; runL = 0; longestW = Math.max(longestW, runW); }
    else if (t.pnl < 0) { runL++; runW = 0; longestL = Math.max(longestL, runL); }
    else { runW = 0; runL = 0; }
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
  if (s.rr >= 2) score += 10; else if (s.rr >= 1.5) score += 6; else if (s.rr >= 1) score += 2; else score -= 5;
  if (s.count >= 20) score += 5; else if (s.count >= 10) score += 2;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreLabel(n) {
  if (n >= 85) return { label: 'Elite', color: '#5DCAA5' };
  if (n >= 70) return { label: 'Strong', color: '#E8724A' };
  if (n >= 55) return { label: 'Developing', color: '#EFC97A' };
  if (n >= 40) return { label: 'Inconsistent', color: '#85B7EB' };
  return { label: 'Needs work', color: '#F09595' };
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Stats() {
  const { trades } = useApp();
  const [period, setPeriod] = useState('month');
  const heroRef  = useRef(null);
  const chartRef = useRef(null);
  const wlRef    = useRef(null);
  const dowRef   = useRef(null);
  const pnlChart = useRef(null);
  const wlChart  = useRef(null);
  const dowChart = useRef(null);

  const list = filterPeriod(trades, period);
  const s    = computeStats(list);

  const streak   = useMemo(() => getStreak(list), [list]);
  const setups   = useMemo(() => getSetupStats(list), [list]);
  const dowStats = useMemo(() => getDayOfWeekStats(list), [list]);
  const consistency = useMemo(() => getConsistencyScore(s), [s]);
  const consistencyInfo = consistency !== null ? scoreLabel(consistency) : null;

  const topWins   = useMemo(() => [...list].filter(t => t.pnl > 0).sort((a,b) => b.pnl - a.pnl).slice(0, 3), [list]);
  const topLosses = useMemo(() => [...list].filter(t => t.pnl < 0).sort((a,b) => a.pnl - b.pnl).slice(0, 3), [list]);

  // Animate hero
  useEffect(() => {
    if (heroRef.current) animateCount(heroRef.current, s.totalPnl);
  }, [s.totalPnl, period]);

  // Cumulative P/L chart
  useEffect(() => {
    if (typeof window === 'undefined') return;
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      const sorted = [...list].sort((a,b) => a.date.localeCompare(b.date) || (a.createdAt||'').localeCompare(b.createdAt||''));
      if (pnlChart.current) { pnlChart.current.destroy(); pnlChart.current = null; }
      const ctx = chartRef.current;
      if (!ctx || !sorted.length) return;
      let cum = 0;
      const labels = [], data = [];
      sorted.forEach(t => { cum += t.pnl; labels.push(t.date.slice(5)); data.push(+(cum.toFixed(2))); });
      const lineColor = cum >= 0 ? '#E8724A' : '#E24B4A';
      const fillColor = cum >= 0 ? 'rgba(232,114,74,0.15)' : 'rgba(226,75,74,0.12)';
      pnlChart.current = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ data, borderColor: lineColor, backgroundColor: fillColor, fill: true, tension: 0.35, pointRadius: sorted.length < 20 ? 4 : 0, pointBackgroundColor: lineColor, pointBorderColor: '#17150F', pointBorderWidth: 2, borderWidth: 2.5 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0E0C08', titleColor: '#F5F3ED', bodyColor: '#E8E6E1', borderColor: '#2A2720', borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: c => (c.raw < 0 ? '-$' : '$') + Math.abs(c.raw).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) } } }, scales: { y: { ticks: { color: '#8B8882', callback: v => (v < 0 ? '-$' : '$') + Math.abs(v) }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false } }, x: { ticks: { color: '#8B8882', maxTicksLimit: 8 }, grid: { display: false }, border: { display: false } } } },
      });

      // W/L bar
      if (wlChart.current) { wlChart.current.destroy(); wlChart.current = null; }
      const wlCtx = wlRef.current;
      if (wlCtx) {
        const be = s.count - s.wins - s.losses;
        wlChart.current = new Chart(wlCtx, {
          type: 'bar',
          data: { labels: ['Wins', 'Losses', 'B/E'], datasets: [{ data: [s.wins, s.losses, be], backgroundColor: ['rgba(93,202,165,0.75)', 'rgba(226,75,74,0.75)', 'rgba(139,136,130,0.4)'], borderRadius: 8, borderWidth: 0 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0E0C08', titleColor: '#F5F3ED', bodyColor: '#E8E6E1', borderColor: '#2A2720', borderWidth: 1, padding: 10, cornerRadius: 8 } }, scales: { y: { ticks: { color: '#8B8882' }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false } }, x: { ticks: { color: '#E8E6E1' }, grid: { display: false }, border: { display: false } } } },
        });
      }

      // Day of week bar
      if (dowChart.current) { dowChart.current.destroy(); dowChart.current = null; }
      const dowCtx = dowRef.current;
      if (dowCtx && dowStats.length) {
        const colors = dowStats.map(d => d.pnl >= 0 ? 'rgba(232,114,74,0.75)' : 'rgba(226,75,74,0.7)');
        dowChart.current = new Chart(dowCtx, {
          type: 'bar',
          data: { labels: dowStats.map(d => d.label), datasets: [{ data: dowStats.map(d => +(d.pnl.toFixed(2))), backgroundColor: colors, borderRadius: 8, borderWidth: 0 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0E0C08', titleColor: '#F5F3ED', bodyColor: '#E8E6E1', borderColor: '#2A2720', borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: c => (c.raw < 0 ? '-$' : '+$') + Math.abs(c.raw).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) + ` (${dowStats.find(d => d.label === c.label)?.count || 0} trades)` } } }, scales: { y: { ticks: { color: '#8B8882', callback: v => (v < 0 ? '-$' : '$') + Math.abs(v) }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false } }, x: { ticks: { color: '#E8E6E1' }, grid: { display: false }, border: { display: false } } } },
        });
      }
    });
  }, [list, period, dowStats, s.count, s.wins, s.losses]);

  useEffect(() => () => {
    if (pnlChart.current) pnlChart.current.destroy();
    if (wlChart.current)  wlChart.current.destroy();
    if (dowChart.current) dowChart.current.destroy();
  }, []);

  const maxSetupPnl = setups.length ? Math.max(...setups.map(ss => Math.abs(ss.pnl))) : 1;

  return (
    <div className="jm-view">
      <div className="jm-greeting">
        <p className="jm-hello">Know your edge</p>
        <h1 className="jm-page-title">Performance <span>Stats</span></h1>
      </div>

      {/* Period selector */}
      <div className="jm-seg">
        {[['day','Today'],['week','This week'],['month','This month'],['all','All time']].map(([p,l]) => (
          <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>{l}</button>
        ))}
      </div>

      {/* Hero */}
      <div className="jm-hero" style={s.totalPnl < 0 ? {
        background: 'radial-gradient(ellipse at top right, rgba(226,75,74,0.22) 0%, rgba(226,75,74,0.04) 50%, #1E1C16 100%)',
        borderColor: 'rgba(226,75,74,0.4)',
      } : {}}>
        <p className="jm-hero-label">Realized P/L</p>
        <p className="jm-hero-val" style={{ color: s.totalPnl < 0 ? '#F7C1C1' : '#FAECE7' }} ref={heroRef}>$0.00</p>
        {list.length === 0
          ? <p className="jm-hero-meta">No trades in this period</p>
          : <p className="jm-hero-meta">{s.count} trade{s.count !== 1 ? 's' : ''} · {s.wins}W / {s.losses}L{consistencyInfo ? ` · ` : ''}
              {consistencyInfo && <span style={{ color: consistencyInfo.color, fontWeight: 600 }}>{consistency} consistency score</span>}
            </p>
        }
      </div>

      {list.length === 0 ? (
        <div style={{ textAlign:'center', padding:'3rem 0', color:'#5F5C56', fontSize:'13px', lineHeight:1.8 }}>
          No trades logged for this period.<br />Log some trades to see your stats.
        </div>
      ) : (<>

        {/* Core metrics row */}
        <div className="stats-rings-row" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'10px' }}>
          <MetricRing label="Win Rate" value={s.winRate.toFixed(1) + '%'} pct={s.winRate} color="#E8724A" foot={`${s.wins}W / ${s.losses}L`} />
          <MetricRing label="Profit Factor" value={isFinite(s.pf) ? s.pf.toFixed(2) : '∞'} pct={Math.min((isFinite(s.pf)?s.pf:3)/3*100,100)} color="#5DCAA5" foot={s.pf >= 1.5 ? '✓ Good edge' : s.pf >= 1 ? 'Breakeven zone' : '⚠ Below B/E'} />
          <MetricRing label="Avg R:R" value={s.rr.toFixed(2)} pct={Math.min(s.rr/3*100,100)} color="#85B7EB" foot={s.rr >= 1.5 ? '✓ Healthy R:R' : s.rr >= 1 ? 'Needs improvement' : '⚠ Risk > Reward'} />
        </div>

        {/* Secondary metrics */}
        <div className="stats-small-cards" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'10px' }}>
          <SmallCard label="Avg Win" val={fmt(s.avgWin)} color="#5DCAA5" />
          <SmallCard label="Avg Loss" val={fmt(s.avgLoss)} color="#F09595" />
          <SmallCard label="Best Trade" val={fmt(s.best)} color="#5DCAA5" />
          <SmallCard label="Worst Trade" val={fmt(s.worst)} color="#F09595" />
        </div>

        {/* Streak card */}
        <div className="jm-card stats-streak-card" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'10px', padding:'16px 20px' }}>
          <StreakCol
            label="Current streak"
            value={streak.current}
            type={streak.type}
            icon={streak.type === 'win' ? '🔥' : streak.type === 'loss' ? '🧊' : '—'}
            sub={streak.current === 0 ? 'Start trading' : streak.type === 'win' ? `${streak.current} green in a row` : `${streak.current} red in a row`}
          />
          <StreakCol label="Longest win run" value={streak.longest} type="win" icon="⭐" sub="consecutive wins" />
          <StreakCol label="Longest loss run" value={streak.longestLoss} type="loss" icon="❄️" sub="consecutive losses" />
        </div>

        {/* Setup breakdown */}
        {setups.length > 0 && (
          <div className="jm-card" style={{ marginBottom:'10px' }}>
            <h2 className="jm-card-title" style={{ marginBottom:'14px' }}>Setup Breakdown</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {setups.map(ss => (
                <div key={ss.name} style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                    <span style={{ fontSize:'13px', fontWeight:600, color:'#E8E6E1' }}>{ss.name}</span>
                    <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                      <span style={{ fontSize:'11px', color:'#8B8882' }}>{ss.count} trades · {ss.wr}% WR</span>
                      <span style={{ fontSize:'13px', fontWeight:700, color: ss.pnl >= 0 ? '#5DCAA5' : '#F09595' }}>{fmt(ss.pnl)}</span>
                    </div>
                  </div>
                  <div style={{ height:'5px', borderRadius:'3�x', background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                    <div style={{
                      height:'100%', borderRadius:'3�x',
                      width: `${Math.abs(ss.pnl) / maxSetupPnl * 100}%`,
                      background: ss.pnl >= 0 ? 'linear-gradient(90deg,#E8724A,#F0A67A)' : 'linear-gradient(90deg,#E24B4A,#F09595)',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts row */}
        <div className="stats-charts-row" style={{ display:'grid', gridTemplateColumns:'~fr 1fr', gap:'10px', marginBottom:'10px' }}>
          <div className="jm-card">
            <h2 className="jm-card-title" style={{ marginBottom:'12px' }}>Cumulative P/L</h2>
            <div style={{ position:'relative', height:'200px' }}>
              <canvas ref={chartRef} />
            </div>
          </div>
          <div className="jm-card">
            <h2 className="jm-card-title" style={{ marginBottom:'12px' }}>Win / Loss Split</h2>
            <div style={{ position:'relative', height:'200px' }}>
              <canvas ref={wlRef} />
            </div>
          </div>
        </div>

        {/* Day of week chart */}
        {dowStats.length > 1 && (
          <div className="jm-card" style={{ marginBottom:'10px' }}>
            <h2 className="jm-card-title" style={{ marginBottom:'12px' }}>P/L by Day of Week</h2>
            <div style={{ position:'relative', height:'180px' }}>
              <canvas ref={dowRef} />
            </div>
            {(() => {
              const best = [...dowStats].sort((a,b) => b.pnl - a.pnl)[0];
              const worst = [...dowStats].sort((a,b) => a.pnl - b.pnl)[0];
              return best && best !== worst ? (
                <p style={{ fontSize:'12px', color:'#8B8882', margin:'10px 0 0', lineHeight:1.6 }}>
                  <span style={{ color:'#5DCAA5', fontWeight:600 }}>{best.label}</span> is your best day ({fmt(best.pnl)}) ·&nbsp;
                  <span style={{ color:'#F09595', fontWeight:600 }}>{worst.label}</span> is your worst day ({fmt(worst.pnl)})
                </p>
              ) : null;
            })()}
          </div>
        )}

        {/* Top trades */}
        {(topWins.length > 0 || topLosses.length > 0) && (
          <div className="stats-charts-row" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            {topWins.length > 0 && (
              <div className="jm-card">
                <h2 className="jm-card-title" style={{ marginBottom:'12px', color:'#5DCAA5' }}>🏆 Top Wins</h2>
                {topWins.map((t, i) => (
                  <div key={t.id || i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom: i < topWins.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div>
                      <span style={{ fontSize:'13px', fontWeight:700, color:'#E8E6E1' }}>{t.symbol}</span>
                      <span style={{ fontSize:'11px', color:'#8B8882', marginLeft:'8px' }}>{t.date}</span>
                      {t.setup && <span style={{ fontSize:'10px', color:'#6B6760', marginLeft:'6px' }}>{t.setup}</span>}
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:700, color:'#5DCAA5' }}>{fmt(t.pnl)}</span>
                  </div>
                ))}
              </div>
            )}
            {topLosses.length > 0 && (
              <div className="jm-card">
                <h2 className="jm-card-title" style={{ marginBottom:'12px', color:'#F09595' }}>📚 Biggest Lessons</h2>
                {topLosses.map((t, i) => (
                  <div key={t.id || i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom: i < topLosses.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div>
                      <span style={{ fontSize:'13px', fontWeight:700, color:'#E8E6E1' }}>{t.symbol}</span>
                      <span style={{ fontSize:'11px', color:'#8B8882', marginLeft:'8px' }}>{t.date}</span>
                      {t.setup && <span style={{ fontSize:'10px', color:'#6B6760', marginLeft:'��x' }}>{t.setup}</span>}
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:700, color:'#F09595' }}>{fmt(t.pnl)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </>)}
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function MetricRing({ label, value, pct, color, foot }) {
  const r = 26, circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * circ;
  return (
    <div className="jm-card" style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'18px 12px', gap:'6px' }}>
      <svg width="68" height="68" style={{ overflow:'visible' }}>
        <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="butt"
          transform="rotate(-90 34 34)" style={{ transition:'stroke-dasharray 0.6s ease' }} />
      </svg>
      <p style={{ fontSize:'20px', fontWeight:800, color, margin:'-48px 0 0', letterSpacing:'-0.5px' }}>{value}</p>
      <p style={{ fontSize:'11px', color:'#8B8882', margin:'46px 0 0', textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</p>
      {foot && <p style={{ fontSize:'11px', color:'#6B6760', textAlign:'center', lineHeight:1.4 }}>{foot}</p>}
    </div>
  );
}

function SmallCard({ label, val, color }) {
  return (
    <div className="jm-card" style={{ padding:'14px 16px' }}>
      <p style={{ fontSize:'11px', color:'#8B8882', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>{label}</p>
      <p style={{ fontSize:'17px', fontWeight:800, color: color || '#E8E6E1' }}>{val}</p>
    </div>
  );
}

function StreakCol({ label, value, type, icon, sub }) {
  const color = type === 'win' ? '#5DCAA5' : type === 'loss' ? '#F09595' : '#8B8882';
  return (
    <div style={{ textAlign:'center' }}>
      <p style={{ fontSize:'11px', color:'#8B8882', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>{label}</p>
      <p style={{ fontSize:'28px', fontWeight:900, color, lineHeight:1 }}>{value}</p>
      <p style={{ fontSize:'12px', color:'#6B6760', marginTop:'4px' }}>{icon} {sub}</p>
    </div>
  );
}
