import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { filterPeriod, computeStats, fmt, animateCount } from '../../lib/utils';

export default function Stats() {
  const { trades } = useApp();
  const [period, setPeriod] = useState('day');
  const heroRef  = useRef(null);
  const chartRef = useRef(null);
  const wlRef    = useRef(null);
  const pnlChart = useRef(null);
  const wlChart  = useRef(null);

  const list = filterPeriod(trades, period);
  const s    = computeStats(list);

  // Animate hero value
  useEffect(() => {
    if (heroRef.current) animateCount(heroRef.current, s.totalPnl);
  }, [s.totalPnl, period]);

  // Render P/L chart
  useEffect(() => {
    if (typeof window === 'undefined') return;
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);

      const sorted = [...list].sort((a,b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
      let cum = 0;
      const labels = [], data = [];
      sorted.forEach(t => { cum += t.pnl; labels.push(t.date); data.push(Math.round(cum * 100) / 100); });

      if (pnlChart.current) { pnlChart.current.destroy(); pnlChart.current = null; }
      const ctx = chartRef.current;
      if (!ctx) return;
      if (sorted.length === 0) return;
      const lineColor = cum >= 0 ? '#E8724A' : '#E24B4A';
      const fillColor = cum >= 0 ? 'rgba(232,114,74,0.18)' : 'rgba(226,75,74,0.15)';
      pnlChart.current = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ data, borderColor: lineColor, backgroundColor: fillColor, fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: lineColor, pointBorderColor: '#17150F', pointBorderWidth: 2, borderWidth: 2.5 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0E0C08', titleColor: '#F5F3ED', bodyColor: '#E8E6E1', borderColor: '#2A2720', borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: ctx => (ctx.raw < 0 ? '-$' : '$') + Math.abs(ctx.raw).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) } } }, scales: { y: { ticks: { color: '#8B8882', callback: v => (v < 0 ? '-$' : '$') + Math.abs(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { ticks: { color: '#8B8882' }, grid: { display: false } } } }
      });

      // W/L chart
      if (wlChart.current) { wlChart.current.destroy(); wlChart.current = null; }
      const wlCtx = wlRef.current;
      if (wlCtx) {
        wlChart.current = new Chart(wlCtx, {
          type: 'bar',
          data: { labels: ['Wins', 'Losses', 'B/E'], datasets: [{ data: [s.wins, s.losses, s.count - s.wins - s.losses], backgroundColor: ['rgba(93,202,165,0.7)', 'rgba(226,75,74,0.7)', 'rgba(139,136,130,0.5)'], borderRadius: 6, borderWidth: 0 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0E0C08', titleColor: '#F5F3ED', bodyColor: '#E8E6E1', borderColor: '#2A2720', borderWidth: 1, padding: 10, cornerRadius: 8 } }, scales: { y: { ticks: { color: '#8B8882' }, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { ticks: { color: '#8B8882' }, grid: { display: false } } } }
        });
      }
    });
  }, [list, period]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (pnlChart.current) pnlChart.current.destroy();
    if (wlChart.current)  wlChart.current.destroy();
  }, []);

  const heroPos = s.totalPnl >= 0;

  return (
    <div className="jm-view">
      <div className="jm-greeting">
        <p className="jm-hello">How are you doing?</p>
        <h1 className="jm-page-title">Performance <span>Stats</span></h1>
      </div>

      <div className="jm-seg">
        {['day','week','month','all'].map(p => (
          <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>
            {p === 'day' ? 'Today' : p === 'week' ? 'This week' : p === 'month' ? 'This month' : 'All time'}
          </button>
        ))}
      </div>

      <div className="jm-hero" style={s.totalPnl < 0 ? {
        background: 'radial-gradient(ellipse at top right, rgba(226,75,74,0.22) 0%, rgba(226,75,74,0.04) 50%, #1E1C16 100%)',
        borderColor: 'rgba(226,75,74,0.4)',
      } : {}}>
        <p className="jm-hero-label">Realized P/L</p>
        <p className="jm-hero-val" style={{ color: s.totalPnl < 0 ? '#F7C1C1' : '#FAECE7' }}
           ref={heroRef}>$0.00</p>
        {list.length === 0
          ? <p className="jm-hero-meta">No trades in this period</p>
          : <p className="jm-hero-meta">{s.count} trade{s.count === 1 ? '' : 's'} · {s.wins}W / {s.losses}L</p>
        }
      </div>

      {list.length === 0 ? (
        <div style={{ textAlign:'center', padding:'2rem 0', color:'#5F5C56', fontSize:'13px', lineHeight:1.7 }}>
          No trades logged for this period.
        </div>
      ) : (
        <>
          <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'10px', marginBottom:'14px' }}>
            <MetricCard label="Win rate"     val={s.winRate.toFixed(1)+'%'}       pct={s.winRate}  barColor="#E8724A"  foot={`${s.wins} wins, ${s.losses} losses`} />
            <MetricCard label="Realized R:R" val={s.rr.toFixed(2)}                pct={Math.min(s.rr*33,100)} barColor="#5DCAA5" foot="avg win ÷ avg loss" />
            <MetricCard label="Profit factor" val={isFinite(s.pf) ? s.pf.toFixed(2) : '∞'} pct={Math.min((isFinite(s.pf)?s.pf:3)*33,100)} barColor="#85B7EB" foot={s.pf >= 1 ? 'Profitable' : 'Below breakeven'} />
            <MetricCard label="Avg win"      val={fmt(s.avgWin)}                  color="#5DCAA5" />
            <MetricCard label="Avg loss"     val={fmt(-s.avgLoss)}                color="#F09595" />
            <MetricCard label="Best trade"   val={fmt(s.best)}                    color="#5DCAA5" />
            <MetricCard label="Worst trade"  val={fmt(s.worst)}                   color="#F09595" />
            <MetricCard label="Total trades" val={s.count} />
          </div>

          <div className="jm-card" style={{ marginBottom:'14px' }}>
            <h2 className="jm-card-title">Cumulative P/L</h2>
            <div className="chart-wrap" style={{ position:'relative', height:'240px' }}>
              <canvas ref={chartRef} />
            </div>
          </div>

          <div className="jm-card">
            <h2 className="jm-card-title">Win / Loss Distribution</h2>
            <div className="chart-wrap" style={{ position:'relative', height:'180px' }}>
              <canvas ref={wlRef} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, val, pct, barColor, foot, color }) {
  return (
    <div className="jm-metric">
      <p className="jm-metric-label">{label}</p>
      <p className="jm-metric-val" style={color ? { color } : {}}>{val}</p>
      {pct != null && (
        <div className="jm-metric-bar">
          <div className="jm-metric-bar-fill" style={{ width: `${Math.max(0,Math.min(100,pct))}%`, background: barColor || '#E8724A' }} />
        </div>
      )}
      {foot && <p className="jm-metric-foot">{foot}</p>}
    </div>
  );
}
