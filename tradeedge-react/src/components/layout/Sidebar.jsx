import { useApp } from '../../context/AppContext';
import { getGreeting, getMilestone, getStreak } from '../../lib/utils';
import { sb } from '../../lib/supabase';

const NAV = [
  { id: 'entry',    icon: '✦', label: 'Log Trade' },
  { id: 'stats',    icon: '◈', label: 'Stats' },
  { id: 'history',  icon: '≡', label: 'History' },
  { id: 'payouts',  icon: '$', label: 'Payouts' },
];
const NAV2 = [
  { id: 'brief',    icon: '◎', label: 'Market Brief' },
  { id: 'insights', icon: '◇', label: 'AI Insights' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
];

export default function Sidebar({ user, profile }) {
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
        <div className={`tp-plan-badge ${plan === 'pro' ? 'tp-badge-pro' : 'tp-badge-free'}`}>
          {plan === 'pro' ? 'Pro' : 'Free trial'}
        </div>
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
