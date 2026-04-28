import { useState, useEffect, lazy, Suspense } from 'react';
import { useApp } from '../../context/AppContext';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
// Eager: views the user is overwhelmingly likely to open right after auth.
import Dashboard from '../views/Dashboard';
import TradeEntry from '../views/TradeEntry';
import History from '../views/History';
import Stats from '../views/Stats';
import Settings from '../views/Settings';
import PreTradeChecklist from '../views/PreTradeChecklist';
import PrivacyPolicy from '../views/PrivacyPolicy';
import TermsOfService from '../views/TermsOfService';
// Lazy: secondary views — each gets its own chunk that loads only when opened.
const Calendar       = lazy(() => import('../views/Calendar'));
const Payouts        = lazy(() => import('../views/Payouts'));
const MarketBrief    = lazy(() => import('../views/MarketBrief'));
const Insights       = lazy(() => import('../views/Insights'));
const Social         = lazy(() => import('../views/Social'));
const Connections    = lazy(() => import('../views/Connections'));
const PropFirmTracker = lazy(() => import('../views/PropFirmTracker'));
const WeeklyDigest   = lazy(() => import('../views/WeeklyDigest'));
import UpgradeModal from '../modals/UpgradeModal';
import OnboardingModal, { isOnboardingDone } from '../modals/OnboardingModal';
import ErrorBoundary from '../ErrorBoundary';
import { getGreeting } from '../../lib/utils';

// Tiny fallback shown while a lazy view's chunk downloads. Matches the
// existing AppLayout loading style so it feels native.
function ViewLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 320, flexDirection: 'column', gap: 12,
    }}>
      <div className="jm-spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} />
      <p style={{ fontSize: 12, color: 'var(--c-text-2)', margin: 0, fontStyle: 'italic', fontFamily: "'Fraunces', Georgia, serif" }}>
        Loading…
      </p>
    </div>
  );
}

function LegalBack({ onBack, label }) {
  return (
    <button
      type="button"
      onClick={onBack}
      style={{ background: 'none', border: 'none', padding: 0, marginBottom: 16, color: 'var(--c-text-2)', fontSize: 12, cursor: 'pointer', letterSpacing: '0.04em', fontFamily: "'Inter', sans-serif" }}
    >
      ← Back to {label}
    </button>
  );
}

export default function AppLayout({ user, profile, showToast }) {
  const { activeTab, setActiveTab, loading, trades } = useApp();
  const [showUpgrade, setShowUpgrade] = useState(false);
  // Onboarding shows on first login (no trades yet + flag not set), or when
  // the user replays it from Settings via the onReplayOnboarding callback.
  const [showOnboarding, setShowOnboarding] = useState(false);
  const name = (profile?.name) || user?.user_metadata?.name || user?.email || 'Trader';
  const { full: greet } = getGreeting(name);

  // Trigger onboarding on first login: flips true once after initial load if
  // user has no trades yet and the localStorage flag isn't set.
  useEffect(() => {
    if (loading) return;
    if (isOnboardingDone()) return;
    if (!trades || trades.length > 0) return;
    setShowOnboarding(true);
  }, [loading, trades]);

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
        <Sidebar user={user} profile={profile} onUpgrade={() => setShowUpgrade(true)} />

        <main className="jm-main">
          <ErrorBoundary>
          <Suspense fallback={<ViewLoader />}>
            {activeTab === 'dashboard' && <Dashboard user={user} profile={profile} />}
            {activeTab === 'tracker'   && <PropFirmTracker />}
            {activeTab === 'checklist' && <PreTradeChecklist showToast={showToast} />}
            {activeTab === 'entry'    && <TradeEntry showToast={showToast} />}
            {activeTab === 'stats'    && <Stats />}
            {activeTab === 'history'  && <History showToast={showToast} />}
            {activeTab === 'payouts'  && <Payouts showToast={showToast} />}
            {activeTab === 'brief'    && <MarketBrief showToast={showToast} />}
            {activeTab === 'insights' && <Insights showToast={showToast} />}
            {activeTab === 'digest'   && <WeeklyDigest />}
            {activeTab === 'calendar'  && <Calendar />}
            {activeTab === 'social'       && <Social user={user} profile={profile} showToast={showToast} />}
            {activeTab === 'connections'  && <Connections user={user} showToast={showToast} />}
            {activeTab === 'settings'     && <Settings user={user} profile={profile} showToast={showToast} onUpgrade={() => setShowUpgrade(true)} onReplayOnboarding={() => { try { localStorage.removeItem('te_onboarding_done'); } catch {} setShowOnboarding(true); }} />}
            {activeTab === 'privacy'      && (
              <div className="jm-view">
                <LegalBack onBack={() => setActiveTab('settings')} label="Settings" />
                <PrivacyPolicy />
              </div>
            )}
            {activeTab === 'terms'        && (
              <div className="jm-view">
                <LegalBack onBack={() => setActiveTab('settings')} label="Settings" />
                <TermsOfService />
              </div>
            )}
          </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <MobileNav />
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      {showOnboarding && (
        <OnboardingModal
          user={user}
          profile={profile}
          onClose={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
