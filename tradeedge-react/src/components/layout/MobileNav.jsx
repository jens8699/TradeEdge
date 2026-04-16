import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { sb } from '../../lib/supabase';

export default function MobileNav() {
  const { activeTab, setActiveTab } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);

  const nav = [
    { id: 'dashboard', icon: '⌂', label: 'Home' },
    { id: 'entry',    icon: '✦', label: 'Log' },
    { id: 'stats',    icon: '◈', label: 'Stats' },
    { id: 'social',   icon: '◉', label: 'Social' },
  ];
  const more = [
    { id: 'calendar', icon: '▦', label: 'Calendar' },
    { id: 'history',  icon: '∡', label: 'History' },
    { id: 'payouts',  icon: '$', label: 'Payouts' },
    { id: 'brief',    icon: '◎', label: 'Market Brief' },
    { id: 'insights', icon: '◇', label: 'AI Insights' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ];
  const moreActive = ['brief','insights','settings','history','payouts','calendar'].includes(activeTab);

  const go = (tab) => { setActiveTab(tab); setMoreOpen(false); };

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
