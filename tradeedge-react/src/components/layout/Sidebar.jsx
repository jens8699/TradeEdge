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
