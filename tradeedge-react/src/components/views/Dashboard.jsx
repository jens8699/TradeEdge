import { useRef, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { filterPeriod, computeStats, fmt, getGreeting, getStreak, animateCount } from '../../lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────
const RATING_COLORS = { A: '#E07A3B', B: '#A89687', C: '#EFC97A', D: '#C65A45' };
const GOAL_KEY = 'te_monthly_goal';
function loadGoal() { return parseFloat(localStorage.getItem(GOAL_KEY) || '0') || 0; }
function saveGoal(v) { localStorage.setItem(GOAL_KEY, String(v)); }

// ── Live clock ────────────────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ── Hairline rule ─────────────────────────────────────────────────────────────
function HR({ my = 28 }) {
  return <div style={{ height: 1, background: 'var(--c-border)', margin: `${my}px 0` }} />;
}

// ── Eyebrow label ─────────────────────────────────────────────────────────────
function Eyebrow({ children }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </div>
  );
}

// ── Stat card (boxed) ─────────────────────────────────────────────────────────
function StatCard({ label, children, badge, badgeColor }) {
  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      borderRadius: 14, padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <Eyebrow>{label}</Eyebrow>
        {badge && <span style={{ fontSize: 11, color: badgeColor || 'var(--c-text-2)', fontWeight: 600 }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard({ user, profile }) {
  const { trades, setActiveTab } = useApp();
  const heroRef   = useRef(null);
  const now       = useClock();
  const [goal,       setGoal]       = useState(loadGoal);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput,  setGoalInput]  = useState('');

  const name      = (profile?.name) || user?.user_metadata?.name || user?.email || 'Trader';
  const { time, firstName } = getGreeting(name);

  const todayTrades = filterPeriod(trades, 'day');
  const weekTrades  = filterPeriod(trades, 'week');
  const monthTrades = filterPeriod(trades, 'month');

  const today  = computeStats(todayTrades);
  const week   = computeStats(weekTrades);
  const month  = computeStats(monthTrades);
  const streak = getStreak(trades);

  useEffect(() => {
    if (heroRef.current) animateCount(heroRef.current, today.totalPnl);
  }, [today.totalPnl]);

  const recentTrades = [...trades].slice(0, 5);

  // ── Cumulative equity sparkline ──────────────────────────────────────────────
  const { sparkPath, sparkArea, sparkIsUp, sparkCumPnl, sparkW, sparkH } = useMemo(() => {
    const sorted = [...trades].reverse();
    if (sorted.length < 2) return { sparkPath: null };
    let cum = 0;
    const pts = sorted.map(t => { cum += (t.pnl || 0); return cum; });
    const min = Math.min(...pts, 0);
    const max = Math.max(...pts, 0);
    const range = max - min || 1;
    const w = 460, h = 110, padY = 8;
    const coords = pts.map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = (h - padY) - ((v - min) / range) * (h - padY * 2);
      return { x: x.toFixed(1), y: y.toFixed(1) };
    });
    const path = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area = `${path} L ${w} ${h} L 0 ${h} Z`;
    return {
      sparkPath: path, sparkArea: area, sparkIsUp: cum >= 0,
      sparkCumPnl: cum, sparkW: w, sparkH: h,
    };
  }, [trades]);

  // ── Date & clock strings ─────────────────────────────────────────────────────
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  // ── Insight ──────────────────────────────────────────────────────────────────
  function getInsight() {
    if (!trades.length)       return "Log your first trade to get started — every edge starts with data.";
    if (streak >= 5)          return `${streak}-trade win streak — you're locked in. Stay disciplined and protect the capital.`;
    if (week.winRate >= 70)   return `${week.winRate.toFixed(0)}% win rate this week. That edge is sharp — scale only if size feels comfortable.`;
    if (week.winRate > 0 && week.winRate < 40) return "Tough week. Review your setups and reduce size — protecting capital is trading.";
    if (today.count === 0 && new Date().getHours() >= 9) return "No trades yet today. Wait for your setup — patience is alpha.";
    return `${month.count} trades this month · ${month.winRate.toFixed(0)}% win rate. Keep building consistency.`;
  }

  // ── Monthly goal ─────────────────────────────────────────────────────────────
  const monthPnl = month.totalPnl;
  const now2 = new Date();
  const dayOfMonth   = now2.getDate();
  const daysInMonth  = new Date(now2.getFullYear(), now2.getMonth() + 1, 0).getDate();
  const projectedPnl = monthPnl * (daysInMonth / Math.max(dayOfMonth, 1));
  const goalSet  = goal > 0;
  const goalPct  = goalSet ? Math.min(1, Math.max(0, monthPnl / goal)) : 0;
  const smashed  = goalSet && monthPnl >= goal;
  const onPace   = goalSet && !smashed && projectedPnl >= goal;

  const todayColor = today.totalPnl >= 0 ? '#E07A3B' : '#C65A45';
  const stroke     = sparkIsUp ? '#E07A3B' : '#C65A45';

  return (
    <div style={{ padding: '36px 44px', paddingBottom: 48 }}>

      {/* ── Editorial header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          {dateStr}
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em' }}>
          {timeStr}
        </div>
      </div>

      {/* ── Greeting ── */}
      <div style={{ fontSize: 30, fontWeight: 600, color: 'var(--c-text)', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 8 }}>
        {time}, <span style={{ color: '#E07A3B' }}>{firstName}</span>.
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--c-text-2)', lineHeight: 1.55, maxWidth: 540 }}>
        {today.count === 0
          ? "No trades logged yet today — your edge is in the waiting."
          : <>You're {today.totalPnl >= 0 ? 'up' : 'down'}{' '}
              <span style={{ color: 'var(--c-text)', fontWeight: 500 }}>{fmt(today.totalPnl)}</span>
              {' '}across {today.count} trade{today.count === 1 ? '' : 's'} —{' '}
              {today.winRate >= 60 ? 'win rate is sharp. Keep position sizing tight through the close.' : 'stay disciplined and wait for your setup.'}
            </>
        }
      </div>

      <HR my={30} />

      {/* ── Three-up hero stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 36 }}>

        {/* Today P&L */}
        <div>
          <Eyebrow>Today's P&L</Eyebrow>
          <div ref={heroRef} style={{
            fontSize: 52, fontWeight: 600, letterSpacing: '-0.03em',
            color: todayColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            marginBottom: 14,
          }}>
            $0.00
          </div>
          {sparkPath && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width={140} height={32} viewBox={`0 0 ${sparkW} ${sparkH}`}
                preserveAspectRatio="none" style={{ width: 140, height: 32 }}>
                <defs>
                  <linearGradient id="dash-spark-grad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={sparkArea} fill="url(#dash-spark-grad)" />
                <path d={sparkPath} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 11, color: 'var(--c-text-2)' }}>
                {sparkIsUp ? '+' : ''}{fmt(sparkCumPnl)} all time
              </span>
            </div>
          )}
        </div>

        {/* Win rate */}
        <div>
          <Eyebrow>Win rate</Eyebrow>
          <div style={{
            fontSize: 42, fontWeight: 600, letterSpacing: '-0.02em',
            color: 'var(--c-text)', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            marginBottom: 10,
          }}>
            {month.winRate.toFixed(0)}
            <span style={{ fontSize: 20, color: 'var(--c-text-2)', fontWeight: 400 }}>%</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)' }}>Last 30 days · {month.count} trade{month.count === 1 ? '' : 's'}</div>
        </div>

        {/* Streak */}
        <div>
          <Eyebrow>Win streak</Eyebrow>
          <div style={{
            fontSize: 42, fontWeight: 600, letterSpacing: '-0.02em',
            color: 'var(--c-text)', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            marginBottom: 10,
          }}>
            {streak}
            <span style={{ fontSize: 15, color: 'var(--c-text-2)', fontWeight: 400, marginLeft: 8 }}>
              {streak === 1 ? 'win' : 'wins'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)' }}>
            {streak >= 3 ? 'Stay locked in.' : streak > 0 ? 'Build on it.' : 'Start the streak.'}
          </div>
        </div>
      </div>

      <HR my={32} />

      {/* ── Equity curve + insight pull-quote ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 44 }}>

        {/* Sparkline */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-text)', letterSpacing: '-0.01em' }}>
              Equity curve
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text-2)' }}>
              {trades.length} trades total
            </div>
          </div>
          {sparkPath ? (
            <svg width="100%" viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none"
              style={{ display: 'block', height: 110 }}>
              <defs>
                <linearGradient id="dash-curve-grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={sparkArea} fill="url(#dash-curve-grad)" />
              <path d={sparkPath} fill="none" stroke={stroke} strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px dashed var(--c-border)', borderRadius: 10,
              fontSize: 12, color: 'var(--c-text-2)' }}>
              Log trades to see your equity curve
            </div>
          )}
        </div>

        {/* Pull-quote / insight */}
        <div style={{ borderLeft: '2px solid #E07A3B', paddingLeft: 22 }}>
          <Eyebrow>Today's note</Eyebrow>
          <div style={{
            fontSize: 15, color: 'var(--c-text)', lineHeight: 1.5,
            letterSpacing: '-0.005em', fontWeight: 500,
          }}>
            {getInsight()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 12 }}>
            — pattern engine, {month.count > 0 ? '30-day window' : 'no data yet'}
          </div>
        </div>
      </div>

      <HR my={32} />

      {/* ── Three stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

        {/* Win streak card */}
        <StatCard label="Win streak" badge={streak >= 3 ? '🔥' : undefined}>
          <div style={{
            fontSize: 30, fontWeight: 600, color: 'var(--c-text)',
            letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            marginBottom: 4,
          }}>
            {streak}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginBottom: 14 }}>
            This month: {month.wins}W / {month.losses}L
          </div>
          {/* Streak dots — last 7 trades */}
          <div style={{ display: 'flex', gap: 3 }}>
            {[...trades].slice(0, 7).reverse().map((t, i) => (
              <div key={i} style={{
                flex: 1, height: 5, borderRadius: 3,
                background: t.pnl >= 0 ? '#E07A3B' : 'var(--c-border)',
              }} />
            ))}
            {trades.length < 7 && Array.from({ length: 7 - Math.min(trades.length, 7) }).map((_, i) => (
              <div key={`e-${i}`} style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--c-border)' }} />
            ))}
          </div>
        </StatCard>

        {/* Monthly goal card */}
        <StatCard
          label="Monthly goal"
          badge={smashed ? '🏆 Smashed' : onPace ? '✓ On pace' : goalSet ? 'Behind pace' : undefined}
          badgeColor={smashed ? '#F4A460' : onPace ? '#E07A3B' : 'var(--c-text-2)'}
        >
          {goalSet ? (
            <>
              <div style={{
                fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em',
                color: monthPnl >= 0 ? '#E07A3B' : '#C65A45',
                fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 4,
              }}>
                {fmt(monthPnl)}
                <span style={{ fontSize: 13, color: 'var(--c-text-2)', fontWeight: 400 }}> of {fmt(goal)}</span>
              </div>
              <div style={{ height: 5, background: 'var(--c-border)', borderRadius: 3, marginTop: 12, marginBottom: 6, overflow: 'hidden' }}>
                <div style={{
                  width: `${(goalPct * 100).toFixed(1)}%`, height: '100%',
                  background: smashed ? 'linear-gradient(90deg, #E07A3B, #F4A460)' : '#E07A3B',
                  borderRadius: 3, transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--c-text-2)' }}>{(goalPct * 100).toFixed(0)}% complete</span>
                {editingGoal ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input autoFocus type="number" value={goalInput}
                      onChange={e => setGoalInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { const v = parseFloat(goalInput) || 0; saveGoal(v); setGoal(v); setEditingGoal(false); }
                        if (e.key === 'Escape') setEditingGoal(false);
                      }}
                      style={{
                        width: 70, padding: '3px 6px', borderRadius: 6, fontSize: 11,
                        background: 'var(--c-bg)', border: '1px solid var(--c-border)',
                        color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit',
                      }} />
                    <button onClick={() => { const v = parseFloat(goalInput) || 0; saveGoal(v); setGoal(v); setEditingGoal(false); }}
                      style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: '#E07A3B', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      Save
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setGoalInput(String(goal)); setEditingGoal(true); }}
                    style={{ fontSize: 10, color: '#E07A3B', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                    Edit
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--c-text-2)', marginBottom: 12, lineHeight: 1.5 }}>
                Set a monthly target to track your progress.
              </div>
              {editingGoal ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input autoFocus type="number" value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { const v = parseFloat(goalInput) || 0; saveGoal(v); setGoal(v); setEditingGoal(false); }
                      if (e.key === 'Escape') setEditingGoal(false);
                    }}
                    placeholder="e.g. 5000"
                    style={{
                      flex: 1, padding: '5px 8px', borderRadius: 8, fontSize: 12,
                      background: 'var(--c-bg)', border: '1px solid var(--c-border)',
                      color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit',
                    }} />
                  <button onClick={() => { const v = parseFloat(goalInput) || 0; saveGoal(v); setGoal(v); setEditingGoal(false); }}
                    style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#E07A3B', color: '#fff', border: 'none', cursor: 'pointer' }}>
                    Set
                  </button>
                </div>
              ) : (
                <button onClick={() => { setGoalInput(''); setEditingGoal(true); }}
                  style={{
                    fontSize: 12, fontWeight: 500, color: '#E07A3B',
                    background: 'rgba(224,122,59,0.08)', border: '1px solid rgba(224,122,59,0.2)',
                    borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  + Set a goal
                </button>
              )}
            </>
          )}
        </StatCard>

        {/* Week card */}
        <StatCard label="This week" badge={week.winRate >= 60 ? 'Sharp' : week.winRate > 0 ? 'Building' : undefined} badgeColor="#E07A3B">
          <div style={{
            fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em',
            color: week.totalPnl >= 0 ? '#E07A3B' : '#C65A45',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 8,
          }}>
            {fmt(week.totalPnl)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginBottom: 14 }}>
            {week.wins}W · {week.losses}L · {week.winRate.toFixed(0)}% win rate
          </div>
          <div style={{ height: 5, background: 'var(--c-border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${week.winRate}%`, height: '100%',
              background: week.winRate >= 60 ? '#E07A3B' : '#C65A45',
              borderRadius: 3,
            }} />
          </div>
        </StatCard>
      </div>

      <HR my={32} />

      {/* ── Recent trades ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-text)', letterSpacing: '-0.01em' }}>Recent trades</div>
        <button onClick={() => setActiveTab('history')}
          style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.08em', textTransform: 'uppercase',
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          See all →
        </button>
      </div>

      {recentTrades.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 0',
          border: '1px dashed var(--c-border)', borderRadius: 12,
        }}>
          <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginBottom: 16, lineHeight: 1.6 }}>
            No trades logged yet.<br />Every edge starts with data.
          </div>
          <button onClick={() => setActiveTab('entry')}
            style={{
              fontSize: 13, fontWeight: 500, color: '#E07A3B',
              background: 'rgba(224,122,59,0.1)', border: '1px solid rgba(224,122,59,0.25)',
              borderRadius: 10, padding: '8px 20px', cursor: 'pointer', fontFamily: 'inherit',
            }}>
            Log first trade →
          </button>
        </div>
      ) : (
        <div>
          {recentTrades.map((t, i) => {
            const isWin  = t.pnl > 0;
            const pnlColor = isWin ? '#E07A3B' : '#C65A45';
            const sym    = t.symbol || t.ticker || '—';
            const desc   = [t.direction, t.setup, t.date].filter(Boolean).join(' · ');
            return (
              <div key={t.id || i} style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr auto 32px',
                gap: 20,
                padding: '14px 0',
                borderBottom: i < recentTrades.length - 1 ? '1px solid var(--c-border)' : 'none',
                alignItems: 'baseline',
              }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                  {sym}
                </span>
                <span style={{ fontSize: 13, color: 'var(--c-text-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {desc || '—'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: pnlColor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {t.pnl > 0 ? '+' : ''}{fmt(t.pnl)}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 600, textAlign: 'right',
                  color: t.rating === 'A' ? '#E07A3B' : 'var(--c-text-2)',
                }}>
                  {t.rating || '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
