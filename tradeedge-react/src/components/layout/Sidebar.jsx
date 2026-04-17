import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getGreeting, getMilestone, getStreak } from '../../lib/utils';
import { sb } from '../../lib/supabase';

const NAV = [
  { id: 'dashboard', icon: '⌂', label: 'Dashboard' },
  { id: 'entry',    icon: '✦', label: 'Log Trade' },
  { id: 'stats',    icon: '◈', label: 'Stats' },
  { id: 'history',  icon: '≡', label: 'History' },
  { id: 'calendar', icon: '▦', label: 'Calendar' },
  { id: 'payouts',  icon: '$', label: 'Payouts' },
];

const NAV2 = [
  { id: 'brief',    icon: '◎', label: 'Market Brief' },
  { id: 'insights', icon: '◇', label: 'AI Insights' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
];

const NAV3 = [
  { id: 'social', icon: '◉', label: 'Social' },
];

const NAV4 = [
  { id: 'connections', icon: '⬡', label: 'Connections' },
];

// ── Session logic ────────────────────────────────────────────────────────────
const SESSIONS = [
  { id: 'sydney',  label: 'Sydney',   open: 21, close: 6  },
  { id: 'tokyo',   label: 'Tokyo',    open: 0,  close: 9  },
  { id: 'london',  label: 'London',   open: 7,  close: 16 },
  { id: 'newyork', label: 'New York', open: 13, close: 21 },
];

const SESSION_COLORS = {
  sydney:  '#85B7EB',
  tokyo:   '#A78BFA',
  london:  '#5DCAA5',
  newyork: '#E8724A',
};

function isActive(s) {
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

function SessionChip() {
  const [active, setActive]   = useState(SESSIONS.filter(isActive));
  const [next,   setNext]     = useState(getNextSession());

  useEffect(() => {
    const tick = () => {
      setActive(SESSIONS.filter(isActive));
      setNext(getNextSession());
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const hasActive = active.length > 0;

  return (
    <div style={{
      margin: '10px 0 4px',
      padding: '8px 10px',
      borderRadius: '10px',
      background: hasActive ? 'rgba(93,202,165,0.08)' : 'rgba(107,103,96,0.08)',
      border: `1px solid ${hasActive ? 'rgba(93,202,165,0.2)' : 'rgba(107,103,96,0.18)'}`,
      fontSize: '11px',
      transition: 'all 0.3s',
    }}>
      {hasActive ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          {active.map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'7px' }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: SESSION_COLORS[s.id],
                boxShadow: `0 0 5px ${SESSION_COLORS[s.id]}99`,
              }} />
              <span style={{ color: SESSION_COLORS[s.id], fontWeight: 700 }}>{s.label}</span>
              <span style={{ color: '#6B6760', marginLeft:'auto' }}>Open</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
          <span style={{ color:'#6B6760' }}>⏱</span>
          <div>
            <span style={{ color:'#6B6760' }}>Next: </span>
            <span style={{ color: SESSION_COLORS[next.session?.id], fontWeight:700 }}>
              {next.session?.label}
            </span>
            <span style={{ color:'#6B6760' }}> in {next.h}h {next.m}m</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar({ user, profile, onUpgrade }) {
  const { trades, activeTab, setActiveTab } = useApp();
  const name    = (profile?.name) || user?.user_metadata?.name || user?.email || 'Trader';
  const plan    = profile?.plan || 'free';
  const { full: greet } = getGreeting(name);
  const streak  = getStreak(trades);
  const milestone = getMilestone(trades.length);

  return (
    <aside className="jm-side">
      <div className="jm-brand">
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
          <div className="tp-logo-mark">TE</div>
          <div>
            <p className="jm-brand-name">TradeEdge</p>
            <p className="jm-brand-sub">Trading Journal</p>
          </div>
        </div>
        {plan === 'pro' ? (
          <div className="tp-plan-badge tp-badge-pro">⚡ Pro</div>
        ) : (
          <button
            onClick={onUpgrade}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'rgba(232,114,74,0.1)', border: '1px solid rgba(232,114,74,0.3)',
              borderRadius: '8px', padding: '5px 10px', cursor: 'pointer',
              fontSize: '11px', fontWeight: 700, color: '#E8724A',
              marginBottom: '8px', transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,114,74,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(232,114,74,0.1)'}
          >
            ⚡ Go Pro
          </button>
        )}
        <div className="tp-user-chip">{name}</div>

        {/* Session indicator — always visible top-left */}
        <SessionChip />
      </div>

      <nav className="jm-nav">
        <div className="jm-nav-label">Journal</div>
        {NAV.map(n => (
          <button key={n.id} id={`tab-${n.id}`} className={activeTab === n.id ? 'on' : ''}
            onClick={() => setActiveTab(n.id)}>
            <span className="jm-dot" />
            {n.label}
          </button>
        ))}

        <div className="jm-nav-label" style={{ marginTop:'8px' }}>Intelligence</div>
        {NAV2.map(n => (
          <button key={n.id} id={`tab-${n.id}`} className={activeTab === n.id ? 'on' : ''}
            onClick={() => setActiveTab(n.id)}>
            <span className="jm-dot" />
            {n.label}
          </button>
        ))}

        <div className="jm-nav-label" style={{ marginTop:'8px' }}>Social</div>
        {NAV3.map(n => (
          <button key={n.id} id={`tab-${n.id}`} className={activeTab === n.id ? 'on' : ''}
            onClick={() => setActiveTab(n.id)}>
            <span className="jm-dot" />
            {n.label}
          </button>
        ))}

        <div className="jm-nav-label" style={{ marginTop:'8px' }}>Accounts</div>
        {NAV4.map(n => (
          <button key={n.id} id={`tab-${n.id}`} className={activeTab === n.id ? 'on' : ''}
            onClick={() => setActiveTab(n.id)}>
            <span className="jm-dot" />
            {n.label}
          </button>
        ))}
      </nav>

      <div className="jm-side-foot">
        {streak >= 2 && (
          <div className="jm-streak">
            <div className="jm-streak-dot" />
            🔥 {streak} win streak
          </div>
        )}
        {streak < 2 && (
          <div className="jm-streak">
            <div className="jm-streak-dot" />
            {trades.length} trades logged
          </div>
        )}
        {milestone && (
          <div className="jm-milestone">{milestone.emoji} {milestone.label}</div>
        )}
        <button className="tp-signout-btn" style={{ marginTop:'12px' }} onClick={() => sb.auth.signOut()}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
