import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getGreeting, getMilestone, getStreak } from '../../lib/utils';
import { sb } from '../../lib/supabase';

const NAV_MAIN = [
  { id: 'dashboard', label: 'Today'       },
  { id: 'entry',    label: 'Log a trade'  },
  { id: 'calendar', label: 'Calendar'     },
  { id: 'history',  label: 'History'      },
  { id: 'stats',    label: 'Stats'        },
  { id: 'payouts',  label: 'Payouts'      },
];

const NAV_INTEL = [
  { id: 'insights', label: 'AI Insights'  },
  { id: 'brief',    label: 'Market Brief' },
];

const NAV_SOCIAL = [
  { id: 'social',      label: 'Community'   },
  { id: 'connections', label: 'Connections' },
];

const NAV_ACCOUNT = [
  { id: 'settings', label: 'Settings' },
];

// ── Session indicator ────────────────────────────────────────────────────────
const SESSIONS = [
  { id: 'sydney',  label: 'Sydney',   open: 21, close: 6  },
  { id: 'tokyo',   label: 'Tokyo',    open: 0,  close: 9  },
  { id: 'london',  label: 'London',   open: 7,  close: 16 },
  { id: 'newyork', label: 'New York', open: 13, close: 21 },
];
const SESSION_COLORS = { sydney: '#A89687', tokyo: '#C4A882', london: '#E07A3B', newyork: '#F0904E' };

function isSessionActive(s) {
  const h = new Date().getUTCHours();
  return s.open < s.close ? (h >= s.open && h < s.close) : (h >= s.open || h < s.close);
}

function getNextSession() {
  const now = new Date();
  const totalMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  let minDiff = Infinity, next = null;
  for (const s of SESSIONS) {
    let diff = s.open * 60 - totalMins;
    if (diff <= 0) diff += 1440;
    if (diff < minDiff) { minDiff = diff; next = s; }
  }
  return { session: next, h: Math.floor(minDiff / 60), m: minDiff % 60 };
}

function SessionPill() {
  const [active, setActive] = useState(SESSIONS.filter(isSessionActive));
  const [next,   setNext]   = useState(getNextSession());
  useEffect(() => {
    const tick = () => { setActive(SESSIONS.filter(isSessionActive)); setNext(getNextSession()); };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (active.length > 0) {
    const s = active[0];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: SESSION_COLORS[s.id], display: 'inline-block', boxShadow: `0 0 4px ${SESSION_COLORS[s.id]}` }} />
        <span style={{ fontSize: 10, color: SESSION_COLORS[s.id], fontWeight: 500 }}>{s.label} open</span>
      </div>
    );
  }
  return (
    <div style={{ fontSize: 10, color: 'var(--c-text-2)', marginTop: 6 }}>
      Next: <span style={{ color: SESSION_COLORS[next.session?.id] }}>{next.session?.label}</span> in {next.h}h {next.m}m
    </div>
  );
}

// ── Nav section ──────────────────────────────────────────────────────────────
function NavSection({ items, activeTab, setActiveTab }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map(({ id, label }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            id={`tab-${id}`}
            onClick={() => setActiveTab(id)}
            style={{
              all: 'unset',
              display: 'block',
              padding: '8px 0 8px 14px',
              borderLeft: isActive ? '2px solid var(--c-accent)' : '2px solid transparent',
              fontFamily: isActive ? "'Fraunces', Georgia, serif" : "'Inter', sans-serif",
              fontStyle: isActive ? 'italic' : 'normal',
              fontSize: isActive ? 16 : 13,
              color: isActive ? 'var(--c-text)' : 'var(--c-text-2)',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              lineHeight: 1.3,
              boxSizing: 'border-box',
              width: '100%',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--c-text)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--c-text-2)'; }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Nav group label ──────────────────────────────────────────────────────────
function NavLabel({ children }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
      color: 'var(--c-text-2)', opacity: 0.6, marginBottom: 6, paddingLeft: 14,
      fontFamily: "'Inter', sans-serif",
    }}>
      {children}
    </div>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 28 }) {
  const initials = (name || 'T').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, var(--c-accent), #C65A45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.38, fontWeight: 600, fontFamily: "'Inter', sans-serif",
    }}>
      {initials}
    </div>
  );
}

// ── Main Sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar({ user, profile, onUpgrade }) {
  const { trades, activeTab, setActiveTab } = useApp();
  const name    = (profile?.name) || user?.user_metadata?.name || user?.email || 'Trader';
  const firstName = name.split(' ')[0];
  const plan    = profile?.plan || 'free';
  const streak  = getStreak(trades);

  // Monthly goal progress for sidebar card
  const GOAL_KEY = 'te_monthly_goal';
  const [goal] = useState(() => parseFloat(localStorage.getItem(GOAL_KEY) || '0') || 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTrades = trades.filter(t => t.date >= monthStart.toISOString().slice(0, 10));
  const monthPnl = monthTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const goalPct = goal > 0 ? Math.min(1, Math.max(0, monthPnl / goal)) : 0;
  const monthLabel = now.toLocaleString('default', { month: 'long' });

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: 'var(--c-sidebar, var(--c-surface))',
      borderRight: '1px solid var(--c-border)',
      display: 'flex', flexDirection: 'column',
      padding: '28px 0 22px',
      height: '100%', overflow: 'hidden',
    }}>

      {/* ── Wordmark ── */}
      <div style={{ padding: '0 22px', marginBottom: 28 }}>
        <div style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 22, letterSpacing: '-0.04em',
          color: 'var(--c-text)', lineHeight: 1,
        }}>
          tradeedge<span style={{ color: 'var(--c-accent)' }}>.</span>
        </div>
        <div style={{
          fontSize: 10, color: 'var(--c-text-2)', marginTop: 4,
          fontStyle: 'italic', letterSpacing: '0.02em', fontFamily: "'Inter', sans-serif",
        }}>
          journal · Vol. IV
        </div>
        <SessionPill />
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, overflow: 'auto', padding: '0 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <NavLabel>Journal</NavLabel>
          <NavSection items={NAV_MAIN} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
        <div>
          <NavLabel>Intelligence</NavLabel>
          <NavSection items={NAV_INTEL} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
        <div>
          <NavLabel>Social</NavLabel>
          <NavSection items={NAV_SOCIAL} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
        <div>
          <NavLabel>Account</NavLabel>
          <NavSection items={NAV_ACCOUNT} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      </nav>

      {/* ── Goal card ── */}
      {goal > 0 && (
        <div style={{ padding: '0 16px', margin: '20px 0 16px' }}>
          <div style={{
            padding: '12px 14px',
            background: 'rgba(var(--c-accent-rgb, 224,122,59), 0.08)',
            border: '1px solid var(--c-border)',
            borderRadius: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--c-text-2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {monthLabel} goal
              </span>
              <span style={{ fontSize: 11, color: 'var(--c-accent)', fontWeight: 600 }}>
                {(goalPct * 100).toFixed(0)}%
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--c-border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${goalPct * 100}%`, height: '100%', background: 'var(--c-accent)', transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--c-text-2)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              ${monthPnl.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} of ${goal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer: user + sign out ── */}
      <div style={{ padding: '0 16px', borderTop: '1px solid var(--c-border)', paddingTop: 14, marginTop: goal > 0 ? 0 : 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar name={name} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--c-text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {firstName}
            </div>
            <div style={{ fontSize: 10, color: 'var(--c-text-2)' }}>
              {plan === 'pro' ? '⚡ Pro' : 'Free'}{streak >= 2 ? ` · 🔥 ${streak}` : ''}
            </div>
          </div>
          {plan !== 'pro' && (
            <button onClick={onUpgrade} style={{
              fontSize: 10, fontWeight: 600, color: 'var(--c-accent)',
              background: 'rgba(224,122,59,0.1)', border: '1px solid rgba(224,122,59,0.25)',
              borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}>
              Go Pro
            </button>
          )}
        </div>
        <button onClick={() => sb.auth.signOut()} style={{
          all: 'unset', fontSize: 11, color: 'var(--c-text-2)', cursor: 'pointer',
          fontFamily: "'Inter', sans-serif", display: 'block', width: '100%',
          paddingLeft: 4, opacity: 0.7,
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
        >
          Sign out →
        </button>
      </div>
    </aside>
  );
}
