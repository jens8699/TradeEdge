import { useRef, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { filterPeriod, computeStats, fmt, getGreeting, getStreak, animateCount } from '../../lib/utils';

// ── Monthly goal helpers ──────────────────────────────────────────────────────
const GOAL_KEY = 'te_monthly_goal';
function loadGoal() { return parseFloat(localStorage.getItem(GOAL_KEY) || '0') || 0; }
function saveGoal(v) { localStorage.setItem(GOAL_KEY, String(v)); }

export default function Dashboard({ user, profile }) {
  const { trades, setActiveTab } = useApp();
  const heroRef = useRef(null);
  const [goal,       setGoal]       = useState(loadGoal);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput,  setGoalInput]  = useState('');

  const name = (profile?.name) || user?.user_metadata?.name || user?.email || 'Trader';
  const { time, firstName } = getGreeting(name);

  const todayTrades  = filterPeriod(trades, 'day');
  const weekTrades   = filterPeriod(trades, 'week');
  const monthTrades  = filterPeriod(trades, 'month');

  const today  = computeStats(todayTrades);
  const week   = computeStats(weekTrades);
  const month  = computeStats(monthTrades);
  const streak = getStreak(trades);

  useEffect(() => {
    if (heroRef.current) animateCount(heroRef.current, today.totalPnl);
  }, [today.totalPnl]);

  const recentTrades = [...trades].slice(0, 5);

  // Sparkline from last 14 trades
  const sparkData = useMemo(() => {
    const last = [...trades].slice(0, 14).reverse();
    if (last.length < 2) return null;
    const vals = last.map(t => t.pnl || 0);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const w = 180, h = 44;
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const isUp = vals[vals.length - 1] >= vals[0];
    return { points: pts.join(' '), isUp };
  }, [trades]);

  // Win rate ring
  const ringRadius = 30;
  const circumference = 2 * Math.PI * ringRadius;
  const winRateDash = (month.winRate / 100) * circumference;

  function getInsight() {
    if (!trades.length) return { msg: "Log your first trade to get started. Every pro started at zero.", icon: '✦', color: '#E8724A' };
    if (streak >= 5)    return { msg: `${streak}-trade win streak — you're locked in. Stay disciplined.`, icon: '🔥', color: '#F4A460' };
    if (week.winRate >= 70) return { msg: `${week.winRate.toFixed(0)}% win rate this week. That edge is sharp.`, icon: '📈', color: '#5DCAA5' };
    if (week.winRate > 0 && week.winRate < 40) return { msg: "Tough week. Review your setups — protect the capital first.", icon: '🛡', color: '#E24B4A' };
    if (today.count === 0 && new Date().getHours() >= 9) return { msg: "No trades yet today. Wait for your setup — patience is alpha.", icon: '⏳', color: '#8B8882' };
    return { msg: `${month.count} trades this month. Win rate: ${month.winRate.toFixed(0)}%. Keep building consistency.`, icon: '◈', color: '#E8724A' };
  }

  const insight = getInsight();
  const todayPos = today.totalPnl >= 0;
  const todayColor = todayPos ? '#5DCAA5' : '#E24B4A';

  return (
    <div className="jm-view" style={{ paddingBottom: '24px' }}>

      {/* ── Greeting bar ─────────────────────────────── */}
      <div className="dash-greeting-bar" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--c-text-2)', marginBottom: '2px' }}>{time}</p>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            Hey, <span style={{ color: '#E8724A' }}>{firstName}</span> 👋
          </h1>
        </div>
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: '12px', padding: '8px 14px', textAlign: 'center'
        }}>
          <p style={{ margin: 0, fontSize: '10px', color: 'var(--c-text-2)', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }}>Streak</p>
          <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 800, color: streak >= 3 ? '#F4A460' : 'var(--c-text)' }}>
            {streak >= 1 ? `${streak} 🔥` : '—'}
          </p>
        </div>
      </div>

      {/* ── ROW 1: Hero + Week + Win Ring ─────────────── */}
      <div className="dash-row1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>

        {/* Today P&L hero */}
        <div style={{
          background: todayPos
            ? 'radial-gradient(ellipse at top left, rgba(93,202,165,0.18) 0%, rgba(93,202,165,0.04) 55%, var(--c-surface) 100%)'
            : 'radial-gradient(ellipse at top left, rgba(226,75,74,0.22) 0%, rgba(226,75,74,0.04) 55%, var(--c-surface) 100%)',
          border: `1px solid ${todayPos ? 'rgba(93,202,165,0.35)' : 'rgba(226,75,74,0.35)'}`,
          borderRadius: '16px', padding: '18px', position: 'relative', overflow: 'hidden',
          gridColumn: '1 / 2'
        }}>
          {/* Decorative glow blob */}
          <div style={{
            position: 'absolute', top: '-20px', right: '-20px',
            width: '80px', height: '80px', borderRadius: '50%',
            background: todayPos ? 'rgba(93,202,165,0.2)' : 'rgba(226,75,74,0.2)',
            filter: 'blur(24px)', pointerEvents: 'none'
          }} />

          <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--c-text-2)' }}>
            Today's P&L
          </p>
          <p ref={heroRef} style={{
            margin: '0 0 6px', fontSize: '28px', fontWeight: 900,
            color: todayColor, letterSpacing: '-1px', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums'
          }}>
            $0.00
          </p>
          <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--c-text-2)' }}>
            {todayTrades.length === 0
              ? 'No trades logged today'
              : `${today.count} trade${today.count === 1 ? '' : 's'} · ${today.wins}W ${today.losses}L`}
          </p>

          {/* Sparkline */}
          {sparkData && (
            <svg width="180" height="44" viewBox="0 0 180 44" style={{ display: 'block', overflow: 'visible' }}>
              <defs>
                <linearGradient id="spark-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={sparkData.isUp ? '#5DCAA5' : '#E24B4A'} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={sparkData.isUp ? '#5DCAA5' : '#E24B4A'} stopOpacity="1" />
                </linearGradient>
              </defs>
              <polyline
                points={sparkData.points}
                fill="none"
                stroke="url(#spark-grad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        {/* Right column: Week + Win Ring stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Week card */}
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: '16px', padding: '16px', flex: 1
          }}>
            <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--c-text-2)' }}>This Week</p>
            <p style={{
              margin: '0 0 4px', fontSize: '22px', fontWeight: 800,
              color: week.totalPnl >= 0 ? '#5DCAA5' : '#E24B4A',
              letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums'
            }}>
              {fmt(week.totalPnl)}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Tag color="#5DCAA5">{week.wins}W</Tag>
              <Tag color="#E24B4A">{week.losses}L</Tag>
              <Tag color="#E8724A">{week.winRate.toFixed(0)}% WR</Tag>
            </div>
          </div>

          {/* Win rate ring */}
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: '16px', padding: '14px', flex: 1,
            display: 'flex', alignItems: 'center', gap: '14px'
          }}>
            <svg width="72" height="72" viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
              <circle cx="36" cy="36" r={ringRadius} fill="none" stroke="var(--c-border)" strokeWidth="6" />
              <circle
                cx="36" cy="36" r={ringRadius} fill="none"
                stroke={month.winRate >= 60 ? '#5DCAA5' : month.winRate >= 40 ? '#E8724A' : '#E24B4A'}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${winRateDash} ${circumference}`}
                transform="rotate(-90 36 36)"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
              <text x="36" y="36" textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: '13px', fontWeight: 800, fill: 'var(--c-text)', fontFamily: 'inherit' }}>
                {month.winRate.toFixed(0)}%
              </text>
            </svg>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--c-text-2)' }}>Month WR</p>
              <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--c-text)', fontWeight: 600 }}>{month.count} trades</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-text-2)' }}>{fmt(month.totalPnl)} P&L</p>
            </div>
          </div>

        </div>
      </div>

      {/* ── ROW 2: Insight ────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, rgba(232,114,74,0.12) 0%, var(--c-surface) 60%)`,
        border: '1px solid rgba(232,114,74,0.3)',
        borderRadius: '16px', padding: '16px 18px', marginBottom: '10px',
        display: 'flex', alignItems: 'center', gap: '14px'
      }}>
        <span style={{ fontSize: '28px', lineHeight: 1, flexShrink: 0 }}>{insight.icon}</span>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#E8724A' }}>Today's Insight</p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--c-text)', lineHeight: 1.6, fontWeight: 500 }}>{insight.msg}</p>
        </div>
      </div>

      {/* ── ROW 3: Recent Trades ───────────────────────── */}
      <div style={{
        background: 'var(--c-surface)', border: '1px solid var(--c-border)',
        borderRadius: '16px', padding: '18px', marginBottom: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--c-text)', letterSpacing: '-0.2px' }}>Recent Trades</h2>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--c-text-2)' }}>Last {recentTrades.length} logged</p>
          </div>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              fontSize: '11px', fontWeight: 600, color: '#E8724A', background: 'rgba(232,114,74,0.1)',
              border: '1px solid rgba(232,114,74,0.25)', borderRadius: '8px',
              cursor: 'pointer', padding: '5px 10px', letterSpacing: '0.3px'
            }}
          >
            View all →
          </button>
        </div>

        {recentTrades.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <p style={{ fontSize: '32px', margin: '0 0 8px' }}>📋</p>
            <p style={{ color: 'var(--c-text-2)', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 }}>No trades logged yet.<br />Start building your edge.</p>
            <button className="jm-btn" onClick={() => setActiveTab('entry')} style={{ fontSize: '13px', padding: '9px 22px' }}>
              ✦ Log First Trade
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentTrades.map((t, i) => {
              const isWin = t.pnl > 0;
              const isLoss = t.pnl < 0;
              const barColor = isWin ? '#5DCAA5' : isLoss ? '#E24B4A' : '#8B8882';
              return (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  border: '1px solid transparent',
                  transition: 'background 0.15s, border-color 0.15s',
                }}>
                  {/* Color bar */}
                  <div style={{ width: '3px', height: '32px', borderRadius: '2px', background: barColor, flexShrink: 0 }} />

                  {/* Ticker + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--c-text)' }}>
                        {t.symbol || t.ticker || '—'}
                      </span>
                      {t.direction && (
                        <span style={{
                          fontSize: '9px', fontWeight: 700, padding: '2px 5px', borderRadius: '4px', letterSpacing: '0.8px',
                          background: t.direction === 'Long' ? 'rgba(93,202,165,0.15)' : 'rgba(232,114,74,0.15)',
                          color: t.direction === 'Long' ? '#5DCAA5' : '#E8724A', textTransform: 'uppercase'
                        }}>
                          {t.direction}
                        </span>
                      )}
                      {t.setup && (
                        <span style={{ fontSize: '10px', color: 'var(--c-text-2)', fontStyle: 'italic' }}>{t.setup}</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '10px', color: 'var(--c-text-2)' }}>{t.date}</p>
                  </div>

                  {/* P&L */}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontWeight: 800, fontSize: '14px', fontVariantNumeric: 'tabular-nums',
                      color: barColor, letterSpacing: '-0.3px'
                    }}>
                      {t.pnl > 0 ? '+' : ''}{fmt(t.pnl)}
                    </span>
                    <p style={{ margin: '2px 0 0', fontSize: '9px', color: 'var(--c-text-2)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      {isWin ? 'WIN' : isLoss ? 'LOSS' : 'B/E'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ROW 4: Action buttons ─────────────────────── */}
      <div className="dash-action-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <ActionBtn
          icon="✦"
          label="Log Trade"
          desc="New entry"
          accent="#E8724A"
          onClick={() => setActiveTab('entry')}
          primary
        />
        <ActionBtn
          icon="◈"
          label="Stats"
          desc="Analytics"
          accent="#5DCAA5"
          onClick={() => setActiveTab('stats')}
        />
        <ActionBtn
          icon="☰"
          label="History"
          desc="All trades"
          accent="#8B8882"
          onClick={() => setActiveTab('history')}
        />
      </div>

      {/* ── ROW 5: Monthly Goal ───────────────────────── */}
      {(() => {
        const monthPnl = month.totalPnl;
        const now = new Date();
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const paceMultiplier = daysInMonth / Math.max(dayOfMonth, 1);
        const projectedPnl = monthPnl * paceMultiplier;
        const goalSet = goal > 0;
        const pct = goalSet ? Math.min(1, Math.max(0, monthPnl / goal)) : 0;
        const smashed = goalSet && monthPnl >= goal;
        const onPace = goalSet && !smashed && projectedPnl >= goal;
        const barColor = smashed ? '#F4A460' : onPace ? '#5DCAA5' : '#E8724A';

        return (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: '16px', padding: '16px 18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--c-text-2)' }}>Monthly Goal</p>
                {smashed
                  ? <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#F4A460' }}>🏆 Goal smashed!</p>
                  : onPace
                    ? <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#5DCAA5' }}>✓ On pace</p>
                    : goalSet
                      ? <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--c-text-2)' }}>Behind pace — keep pushing</p>
                      : <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-text-2)' }}>Set a goal to track progress</p>}
              </div>
              {editingGoal ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--c-text-2)' }}>$</span>
                  <input
                    autoFocus
                    type="number"
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const v = parseFloat(goalInput) || 0;
                        saveGoal(v); setGoal(v); setEditingGoal(false);
                      }
                      if (e.key === 'Escape') setEditingGoal(false);
                    }}
                    placeholder="0"
                    style={{
                      width: '80px', padding: '5px 8px', borderRadius: '8px', fontSize: '13px',
                      background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text)',
                      outline: 'none', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums'
                    }}
                  />
                  <button
                    onClick={() => { const v = parseFloat(goalInput) || 0; saveGoal(v); setGoal(v); setEditingGoal(false); }}
                    style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, background: '#E8724A', color: '#fff', border: 'none', cursor: 'pointer' }}
                  >Save</button>
                </div>
              ) : (
                <button
                  onClick={() => { setGoalInput(goal > 0 ? String(goal) : ''); setEditingGoal(true); }}
                  style={{
                    padding: '6px 12px', borderRadius: '9px', fontSize: '11px', fontWeight: 600,
                    background: 'rgba(232,114,74,0.12)', color: '#E8724A',
                    border: '1px solid rgba(232,114,74,0.25)', cursor: 'pointer', letterSpacing: '0.3px'
                  }}
                >
                  {goalSet ? 'Edit' : '+ Set Goal'}
                </button>
              )}
            </div>

            {goalSet && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: monthPnl >= 0 ? '#5DCAA5' : '#E24B4A', fontVariantNumeric: 'tabular-nums' }}>
                    {monthPnl >= 0 ? '+' : ''}{fmt(monthPnl)}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-2)', fontVariantNumeric: 'tabular-nums' }}>
                    / {fmt(goal)}
                  </span>
                </div>
                <div style={{ background: 'var(--c-bg)', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '6px',
                    width: `${(pct * 100).toFixed(1)}%`,
                    background: smashed
                      ? 'linear-gradient(90deg, #E8724A, #F4A460)'
                      : `linear-gradient(90deg, ${barColor}99, ${barColor})`,
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '10px', color: 'var(--c-text-2)', textAlign: 'right' }}>
                  {(pct * 100).toFixed(0)}% · projected {fmt(projectedPnl)} this month
                </p>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function Tag({ color, children }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px',
      background: `${color}18`, color, letterSpacing: '0.3px'
    }}>
      {children}
    </span>
  );
}

function ActionBtn({ icon, label, desc, accent, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '14px 10px', borderRadius: '14px',
        border: `1px solid ${primary ? accent : 'var(--c-border)'}`,
        background: primary
          ? `linear-gradient(135deg, ${accent}22 0%, ${accent}08 100%)`
          : 'var(--c-surface)',
        cursor: 'pointer', textAlign: 'center',
        transition: 'transform 0.12s, border-color 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = accent; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = primary ? accent : 'var(--c-border)'; }}
    >
      <p style={{ margin: '0 0 4px', fontSize: '20px', lineHeight: 1 }}>{icon}</p>
      <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: 700, color: primary ? accent : 'var(--c-text)' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '10px', color: 'var(--c-text-2)', letterSpacing: '0.3px' }}>{desc}</p>
    </button>
  );
}
