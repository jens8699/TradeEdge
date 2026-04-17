import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { sb } from '../../lib/supabase';

// ── Session logic ────────────────────────────────────────────────────────────
const SESSIONS = [
  { id: 'sydney',  label: 'Sydney',   open: 21, close: 6  },
  { id: 'tokyo',   label: 'Tokyo',    open: 0,  close: 9  },
  { id: 'london',  label: 'London',   open: 7,  close: 16 },
  { id: 'newyork', label: 'New York', open: 13, close: 21 },
];
const SESSION_COLORS = {
  sydney: '#85B7EB', tokyo: '#A78BFA', london: '#5DCAA5', newyork: '#E8724A',
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

export default function MobileNav() {
  const { activeTab, setActiveTab } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);
  const [active, setActive] = useState(SESSIONS.filter(isActive));
  const [next,   setNext]   = useState(getNextSession());

  useEffect(() => {
    const tick = () => {
      setActive(SESSIONS.filter(isActive));
      setNext(getNextSession());
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const nav = [
    { id: 'dashboard', icon: '⌂', label: 'Home' },
    { id: 'entry',    icon: '✦', label: 'Log' },
    { id: 'stats',    icon: '◈', label: 'Stats' },
    { id: 'social',   icon: '◉', label: 'Social' },
  ];
  const more = [
    { id: 'calendar', icon: '▦', label: 'Calendar' },
    { id: 'history',  icon: '≡', label: 'History' },
    { id: 'payouts',  icon: '$', label: 'Payouts' },
    { id: 'brief',    icon: '◎', label: 'Market Brief' },
    { id: 'insights', icon: '◇', label: 'AI Insights' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ];
  const moreActive = ['brief','insights','settings','history','payouts','calendar'].includes(activeTab);

  const go = (tab) => { setActiveTab(tab); setMoreOpen(false); };

  const hasActive = active.length > 0;
  const sessionColor = hasActive ? SESSION_COLORS[active[0].id] : '#6B6760';
  const sessionText  = hasActive
    ? active.map(s => s.label).join(' · ') + ' Open'
    : `Next: ${next.session?.label} in ${next.h}h ${next.m}m`;

  return (
    <>
      {moreOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:199 }} onClick={() => setMoreOpen(false)} />
      )}
      {moreOpen && (
        <div className="mobile-more-menu open">
          {more.map(m => (
            <button key={m.id} className={`mm-item${activeTab === m.id ? ' on' : ''}`} onClick={() => go(m.id)}>
              <span>{m.icon}</span> {m.label}
            </button>
          ))}
          <div className="mm-separator" />
          <button className="mm-item" onClick={() => sb.auth.signOut()}>
            Sign out
          </button>
        </div>
      )}

      {/* Session strip — sits just above the nav bar on mobile */}
      <div style={{
        position: 'fixed', bottom: 57, left: 0, right: 0, zIndex: 149,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '6px',
        padding: '5px 16px',
        background: 'rgba(23,21,15,0.92)',
        backdropFilter: 'blur(10px)',
        borderTop: `1px solid ${hasActive ? `${sessionColor}33` : 'rgba(107,103,96,0.15)'}`,
        fontSize: '11px',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: sessionColor,
          boxShadow: hasActive ? `0 0 5px ${sessionColor}99` : 'none',
        }} />
        <span style={{ color: sessionColor, fontWeight: hasActive ? 700 : 400 }}>
          {sessionText}
        </span>
      </div>

      <nav className="mobile-nav" style={{ display:'flex' }}>
        {nav.map(n => (
          <button key={n.id} className={`mn-btn${activeTab === n.id ? ' on' : ''}`}
            onClick={() => go(n.id)}>
            <span className="mn-icon">{n.icon}</span>
            <span className="mn-label">{n.label}</span>
          </button>
        ))}
        <button className={`mn-btn${moreActive ? ' on' : ''}`} onClick={e => { e.stopPropagation(); setMoreOpen(o => !o); }}>
          <span className="mn-icon">•••</span>
          <span className="mn-label">More</span>
        </button>
      </nav>
    </>
  );
}
