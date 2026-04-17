import { useApp } from '../../context/AppContext';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import Dashboard from '../views/Dashboard';
import TradeEntry from '../views/TradeEntry';
import Stats from '../views/Stats';
import History from '../views/History';
import Payouts from '../views/Payouts';
import MarketBrief from '../views/MarketBrief';
import Insights from '../views/Insights';
import Settings from '../views/Settings';
import Calendar from '../views/Calendar';
import Social from '../views/Social';
import Connections from '../views/Connections';
import { getGreeting } from '../../lib/utils';

export default function AppLayout({ user, profile, showToast }) {
  const { activeTab, loading } = useApp();
  const name = (profile?.name) || user?.user_metadata?.name || user?.email || 'Trader';
  const { full: greet } = getGreeting(name);

  if (loading) {
    return (
      <div className="jm" style={{ padding:'1rem 0' }}>
        <div className="jm-app">
          <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'400px', flexDirection:'column', gap:'12px' }}>
            <div className="jm-spinner" style={{ width:'24px', height:'24px', borderWidth:'2.5px' }} />
            <p style={{ fontSize:'13px', color:'#6B6862', margin:0 }}>Loading your journal…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="jm">
      <div className="jm-app">
        <Sidebar user={user} profile={profile} />

        <main className="jm-main">
          {activeTab === 'dashboard' && <Dashboard user={user} profile={profile} />}
          {activeTab === 'entry'    && <TradeEntry showToast={showToast} />}
          {activeTab === 'stats'    && <Stats />}
          {activeTab === 'history'  && <History showToast={showToast} />}
          {activeTab === 'payouts'  && <Payouts showToast={showToast} />}
          {activeTab === 'brief'    && <MarketBrief showToast={showToast} />}
          {activeTab === 'insights' && <Insights showToast={showToast} />}
          {activeTab === 'calendar'  && <Calendar />}
          {activeTab === 'social'       && <Social user={user} profile={profile} showToast={showToast} />}
          {activeTab === 'connections'  && <Connections user={user} showToast={showToast} />}
          {activeTab === 'settings'     && <Settings user={user} profile={profile} showToast={showToast} />}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
