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
import ShortcutsCheatSheet from '../ui/ShortcutsCheatSheet';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import ErrorBoundary from '../ErrorBoundary';
import { getGreeting } from '../../lib/utils';
import { openPortal } from '../../lib/stripe';

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

  // Keyboard shortcuts — vim-style "g <letter>" navigation + ? for help
  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    onAction: ({ tab }) => { if (tab) setActiveTab(tab); },
  });

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
          <TrialBanner profile={profile} setActiveTab={setActiveTab} />
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
      <ShortcutsCheatSheet open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}

// ── Trial Banner ────────────────────────────────────────────────────────────
// Shown to Pro users while their trial is still active. Auto-disappears once
// trial converts to a real subscription (webhook clears trial_ends_at) OR
// the trial ends. Reduces "wait, why was I charged?" surprises on day 8.
function TrialBanner({ profile, setActiveTab }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  if (!profile?.trial_ends_at) return null;
  const endsAt = new Date(profile.trial_ends_at);
  if (!Number.isFinite(endsAt.getTime())) return null;

  const now = Date.now();
  const msLeft = endsAt.getTime() - now;
  if (msLeft <= 0) return null; // trial already over — no banner

  const daysLeft = Math.ceil(msLeft / 86400000);
  const hoursLeft = Math.ceil(msLeft / 3600000);
  const timeLabel =
    daysLeft > 1 ? `${daysLeft} days`
    : hoursLeft > 1 ? `${hoursLeft} hours`
    : 'less than an hour';

  // Friendly date format e.g. "May 8"
  const chargeDate = endsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // 0 days left = urgent (red-ish), 1-2 days = warn (amber), else accent
  const accent =
    daysLeft <= 0 ? '#C65A45'
    : daysLeft <= 2 ? '#EFC97A'
    : 'var(--c-accent)';

  const handleManage = async () => {
    if (opening) return;
    setError('');
    setOpening(true);
    try {
      await openPortal();
      // Browser redirects away.
    } catch (e) {
      setError(e.message || 'Could not open billing portal.');
      setOpening(false);
    }
  };

  return (
    <div style={{
      padding: '10px clamp(16px, 4.5vw, 44px)',
      background: `linear-gradient(90deg, ${accent}1a 0%, ${accent}08 100%)`,
      borderBottom: `1px solid ${accent}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 14, flexWrap: 'wrap',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--c-text)', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: accent, background: `${accent}1a`, border: `1px solid ${accent}55`,
          padding: '3px 8px', borderRadius: 100,
        }}>
          Pro trial
        </span>
        <span>
          Your trial ends in <strong style={{ color: accent }}>{timeLabel}</strong>
          {' '}— card charged $19 on <strong>{chargeDate}</strong>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {error && (
          <span style={{ fontSize: 11, color: '#C65A45' }}>{error}</span>
        )}
        <button
          onClick={handleManage}
          disabled={opening}
          style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'transparent', color: 'var(--c-text)',
            border: `1px solid ${accent}80`,
            cursor: opening ? 'default' : 'pointer',
            opacity: opening ? 0.6 : 1,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {opening ? 'Opening…' : 'Manage subscription'}
        </button>
      </div>
    </div>
  );
}
