import { useState, useEffect } from 'react';
import { sb, getProfile } from './lib/supabase';
import { AppProvider } from './context/AppContext';
import AuthScreen from './components/auth/AuthScreen';
import AppLayout from './components/layout/AppLayout';
import LandingPage from './components/landing/LandingPage';
import LegalLayout from './components/legal/LegalLayout';
import { useToast, ToastContainer } from './hooks/useToast';

export default function App() {
  const [authState, setAuthState] = useState({ status: 'loading', user: null, profile: null });
  const [authPanel,  setAuthPanel]  = useState('login');
  const [showLanding, setShowLanding] = useState(true);
  const [legalPage,  setLegalPage]  = useState(null); // 'privacy' | 'terms' | null
  const { toasts, show: showToast } = useToast();

  useEffect(() => {
    // Timeout fallback — if Supabase hangs for 6s, drop to login screen
    const timeout = setTimeout(() => {
      setAuthState(prev => prev.status === 'loading' ? { status: 'guest', user: null, profile: null } : prev);
    }, 6000);

    // Initial session check
    sb.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout);
      if (session?.user) {
        const prof = await getProfile(session.user.id);
        setAuthState({ status: 'authed', user: session.user, profile: prof });
      } else {
        setAuthState({ status: 'guest', user: null, profile: null });
        setShowLanding(true);
      }
    }).catch(() => {
      clearTimeout(timeout);
      setAuthState({ status: 'guest', user: null, profile: null });
      setShowLanding(true);
    });

    // Auth state changes (login, logout, password recovery)
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthPanel('newpass');
        setAuthState({ status: 'guest', user: null, profile: null });
        return;
      }
      if (session?.user) {
        const prof = await getProfile(session.user.id);
        setAuthState({ status: 'authed', user: session.user, profile: prof });
      } else {
        setAuthState({ status: 'guest', user: null, profile: null });
        setShowLanding(true);
        setAuthPanel('login');
      }
    });

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  // Handle return from Stripe Checkout / Portal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    const fromPortal = params.get('from') === 'portal';
    if (!checkout && !fromPortal) return;

    if (checkout === 'success') {
      showToast('Welcome to Pro 🎉 Refreshing your account…');
    } else if (checkout === 'cancel') {
      showToast('Checkout canceled — no charge.');
    } else if (fromPortal) {
      showToast('Subscription updated.');
    }

    // Strip the params so a refresh doesn't re-fire the toast
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    url.searchParams.delete('from');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url.pathname + (url.search || ''));

    // Reload profile a few times — Stripe webhook may take a moment
    let cancelled = false;
    const refreshProfile = async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user || cancelled) return;
      const prof = await getProfile(session.user.id);
      if (cancelled) return;
      setAuthState(prev => prev.status === 'authed' ? { ...prev, profile: prof } : prev);
    };
    refreshProfile();
    const t1 = setTimeout(refreshProfile, 2000);
    const t2 = setTimeout(refreshProfile, 5000);
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2); };
  }, [showToast]);

  const { status, user, profile } = authState;

  if (status === 'loading') {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0A0906', flexDirection:'column', gap:'12px' }}>
        <div className="jm-spinner" style={{ width:'24px', height:'24px', borderWidth:'2.5px' }} />
        <p style={{ fontSize:'13px', color:'#6B6862', margin:0 }}>Loading TradeEdge…</p>
      </div>
    );
  }

  // Legal pages — shown standalone for guests reaching them from the footer
  if (legalPage && status !== 'authed') {
    return (
      <>
        <LegalLayout page={legalPage} onBack={() => setLegalPage(null)} />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  // Authenticated → show app
  if (status === 'authed' && user) {
    return (
      <AppProvider userId={user.id}>
        <AppLayout user={user} profile={profile} showToast={showToast} />
        <ToastContainer toasts={toasts} />
      </AppProvider>
    );
  }

  // Guest + landing shown → marketing page
  if (showLanding) {
    return (
      <>
        <LandingPage
          onSignIn={() => { setShowLanding(false); setAuthPanel('login'); }}
          onStartTrial={() => { setShowLanding(false); setAuthPanel('register'); }}
          onShowPrivacy={() => setLegalPage('privacy')}
          onShowTerms={() => setLegalPage('terms')}
        />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  // Guest + landing dismissed → auth screen
  return (
    <>
      <AuthScreen panel={authPanel} onSwitchPanel={(p) => {
        if (p === 'landing') { setShowLanding(true); return; }
        setAuthPanel(p);
      }} />
      <ToastContainer toasts={toasts} />
    </>
  );
}
