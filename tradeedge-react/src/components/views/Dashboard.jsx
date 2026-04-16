import { useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { filterPeriod, computeStats, fmt, getGreeting, getStreak, animateCount } from '../../lib/utils';

export default function Dashboard({ user, profile }) {
  const { trades, setActiveTab } = useApp();
  const heroRef = useRef(null);

  const name = (profile?.name) || user?.user_metadata?.name || user?.email || 'Trader';
  const { time, firstName } = getGreeting(name);

  const todayTrades  = filterPeriod(trades, 'day');
  const weekTrades   = filterPeriod(trades, 'week');
  const monthTrades  = filterPeriod(trades, 'month');

  const today  = computeStats(todayTrades);
  const week   = computeStats(weekTrades);
  const month  = computeStats(monthTrades);
  const streak = getStreak(trades);

  // Animate today's P&L
  useEffect(() => {
    if (heroRef.current) animateCount(heroRef.current, today.totalPnl);
  }, [today.totalPnl]);

  const recentTrades = [...trades].slice(0, 5);

  // Motivational insight
  function getInsight() {
    if (!trades.length) return { msg: "Log your first trade to get started. Every pro started at zero.", icon: '✦' };
    if (streak >= 5)    return { msg: `${streak} win streak — you're locked in. Stay disciplined.`, icon: '🔥' };
    if (week.winRate >= 70) return { msg: `${week.winRate.toFixed(0)}% win rate this week. Keep that edge sharp.`, icon: '📈' };
    if (week.winRate > 0 && week.winRate < 40) return { msg: "Tough week. Review your setups — protect the capital.", icon: '🛡' };
    if (today.count === 0 && new Date().getHours() >= 9) return { msg: "No trades today yet. Wait for the right setup.", icon: '⏳' };
    return { msg: `${month.count} trades this month. Win rate: ${month.winRate.toFixed(0)}%. Keep building consistency.`, icon: '◈' };
  }

  const insight = getInsight();
  const todayPos = today.totalPnl >= 0;

  return (
    <div className="jm-view">
      {/* Greeting */}
      <div className="jm-greeting">
        <p className="jm-hello">{time}</p>
        <h1 className="jm-page-title">Welcome back, <span>{firstName}</span></h1>
      </div>

      {/* Today's P&L Hero */}
      <div
        className="jm-hero"
        style={!todayPos ? {
          background: 'radial-gradient(ellipse at top right, rgba(226,75,74,0.22) 0%, rgba(226,75,74,0.04) 50%, var(--c-bg) 100%)',
          borderColor: 'rgba(226,75,74,0.4)',
        } : {}}
      >
        <p className="jm-hero-label">Today's P/L</p>
        <p
          className="jm-hero-val"
          ref={heroRef}
          style={{ color: todayPos ? '#FAECE7' : '#F7C1C1' }}
        >
          $0.00
        </p>
        {todayTrades.length === 0
          ? <p className="jm-hero-meta">No trades logged today</p>
          : <p className="jm-hero-meta">{today.count} trade{today.count === 1 ? '' : 's'} · {today.wins}W / {today.losses}L · {today.winRate.toFixed(0)}% win rate</p>
        }
      </div>

      {/* Quick stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'10px', marginBottom:'14px' }}>
        <QuickCard
          label="This week"
          val={fmt(week.totalPnl)}
          sub={`${week.count} trades · ${week.winRate.toFixed(0)}% WR`}
          positive={week.totalPnl >= 0}
          onClick={() => setActiveTab('stats')}
        />
        <QuickCard
          label="This month"
          val={fmt(month.totalPnl)}
          sub={`${month.count} trades · ${month.winRate.toFixed(0)}% WR`}
          positive={month.totalPnl >= 0}
          onClick={() => setActiveTab('stats')}
        />
        <QuickCard
          label="Win streak"
          val={streak >= 1 ? `${streak} 🔥` : '—'}
          sub={streak >= 1 ? 'consecutive wins' : 'no active streak'}
          positive={streak >= 3}
          neutral={streak < 1}
        />
      </div>

      {/* Insight card */}
      <div className="jm-card" style={{ marginBottom:'14px', borderLeft:'3px solid #E8724A', paddingLeft:'16px' }}>
        <div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
          <span style={{ fontSize:'18px', lineHeight:1 }}>{insight.icon}</span>
          <p style={{ margin:0, fontSize:'13px', color:'var(--c-text)', lineHeight:1.6 }}>{insight.msg}</p>
        </div>
      </div>

      {/* Recent trades */}
      <div className="jm-card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <h2 className="jm-card-title" style={{ margin:0 }}>Recent Trades</h2>
          <button
            onClick={() => setActiveTab('history')}
            style={{ fontSize:'12px', color:'#E8724A', background:'none', border:'none', cursor:'pointer', padding:0 }}
          >
            View all →
          </button>
        </div>

        {recentTrades.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px 0' }}>
            <p style={{ color:'var(--c-text-2)', fontSize:'13px', margin:'0 0 12px' }}>No trades logged yet.</p>
            <button
              className="jm-btn"
              onClick={() => setActiveTab('entry')}
              style={{ fontSize:'13px', padding:'8px 20px' }}
            >
              Log your first trade
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {recentTrades.map(t => (
              <div key={t.id} className="dash-trade-row">
                <div className="dash-trade-dot" style={{ background: t.pnl > 0 ? '#5DCAA5' : t.pnl < 0 ? '#E24B4A' : '#8B8882' }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontWeight:600, fontSize:'13px', color:'var(--c-text)' }}>
                      {t.ticker || '—'}
                    </span>
                    {t.direction && (
                      <span style={{
                        fontSize:'10px', fontWeight:600, padding:'2px 6px', borderRadius:'4px',
                        background: t.direction === 'Long' ? 'rgba(93,202,165,0.15)' : 'rgba(226,75,74,0.15)',
                        color: t.direction === 'Long' ? '#5DCAA5' : '#E8724A',
                        textTransform:'uppercase', letterSpacing:'0.5px'
                      }}>
                        {t.direction}
                      </span>
                    )}
                    {t.setup && (
                      <span style={{ fontSize:'11px', color:'var(--c-text-2)' }}>{t.setup}</span>
                    )}
                  </div>
                  <p style={{ margin:'2px 0 0', fontSize:'11px', color:'var(--c-text-2)' }}>{t.date}</p>
                </div>
                <span style={{
                  fontWeight:700, fontSize:'14px', fontVariantNumeric:'tabular-nums',
                  color: t.pnl > 0 ? '#5DCAA5' : t.pnl < 0 ? '#E24B4A' : 'var(--c-text-2)'
                }}>
                  {t.pnl > 0 ? '+' : ''}{fmt(t.pnl)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick action buttons */}
      <div style={{ display:'flex', gap:'10px', marginTop:'14px' }}>
        <button
          className="jm-btn"
          onClick={() => setActiveTab('entry')}
          style={{ flex:1, justifyContent:'center', display:'flex', alignItems:'center' }}
        >
          ✦ Log Trade
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          style={{
            flex:1, padding:'10px', borderRadius:'10px', border:'1px solid var(--c-border)',
            background:'var(--c-surface)', color:'var(--c-text)', fontSize:'13px',
            fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center',
            justifyContent:'center', gap:'6px'
          }}
        >
          ◈ View Stats
        </button>
      </div>
    </div>
  );
}

function QuickCard({ label, val, sub, positive, neutral, onClick }) {
  return (
    <div
      className="jm-metric"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <p className="jm-metric-label">{label}</p>
      <p className="jm-metric-val" style={{
        color: neutral ? 'var(--c-text-2)' : positive ? '#5DCAA5' : '#E24B4A',
        fontSize:'15px'
      }}>
        {val}
      </p>
      <p style={{ margin:'4px 0 0', fontSize:'11px', color:'var(--c-text-2)', lineHeight:1.4 }}>{sub}</p>
    </div>
  );
}
