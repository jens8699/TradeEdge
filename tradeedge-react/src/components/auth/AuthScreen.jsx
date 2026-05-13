import { useState } from 'react';
import { sb } from '../../lib/supabase';
import { startCheckout } from '../../lib/stripe';

function LogoMark() {
  return (
    <div style={{ marginBottom:'36px', textAlign:'center' }}>
      <span className="te-logo" style={{ fontSize:'28px' }}>tradeedge<span className="te-logo-dot" /></span>
    </div>
  );
}

function LoginPanel({ onSwitch }) {
  const [email, setEmail]   = useState('');
  const [pass,  setPass]    = useState('');
  const [err,   setErr]     = useState('');
  const [busy,  setBusy]    = useState(false);

  const submit = async () => {
    setErr('');
    if (!email || !pass) { setErr('Please fill in both fields.'); return; }
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass });
    setBusy(false);
    if (error) setErr(error.message);
  };

  return (
    <div className="tp-auth-card">
      <p className="tp-auth-title">Welcome back</p>
      <p className="tp-auth-sub">Sign in to your account to continue.</p>
      <div className="tp-auth-field">
        <label>Email</label>
        <input type="email" className="tp-auth-input" placeholder="you@example.com" autoComplete="email"
          value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="tp-auth-field">
        <label>Password</label>
        <input type="password" className="tp-auth-input" placeholder="••••••••" autoComplete="current-password"
          value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />
      </div>
      <button className="tp-auth-btn" disabled={busy} onClick={submit}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="tp-auth-err">{err}</p>
      <div style={{ textAlign:'center', marginTop:'10px' }}>
        <button onClick={() => onSwitch('reset')} style={{ background:'none', border:'none', color:'#6B6862', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
          Forgot password?
        </button>
      </div>
      <div className="tp-auth-divider"><span>New to TradeEdge?</span></div>
      <div className="tp-auth-switch">
        <button onClick={() => onSwitch('register')}>Create a free account →</button>
      </div>
    </div>
  );
}

function RegisterPanel({ onSwitch }) {
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  // Default to free — never silently push a card-collecting flow on the user.
  const [plan,  setPlan]  = useState('free');
  // Billing interval — only relevant if user picks Pro. Default ANNUAL since
  // most prop traders are long-term tool users + annual captures higher LTV.
  // Monthly is still one click away in the toggle below the cards.
  const [billingInterval, setBillingInterval] = useState('annual');
  const isAnnual = billingInterval === 'annual';
  const [msg,   setMsg]   = useState({ text: '', ok: false });
  const [busy,  setBusy]  = useState(false);

  const submit = async () => {
    setMsg({ text: '', ok: false });
    if (!name || !email || !pass) { setMsg({ text: 'Please fill in all fields.', ok: false }); return; }
    if (!email.includes('@'))      { setMsg({ text: 'Enter a valid email address.', ok: false }); return; }
    if (pass.length < 8)           { setMsg({ text: 'Password must be at least 8 characters.', ok: false }); return; }
    setBusy(true);

    // Read first-touch attribution captured by App.jsx on landing.
    // Passed through signUp metadata AND written directly to profiles.utm_*
    // after auth succeeds. Both paths so we don't lose attribution if the
    // post-signup update fails (network blip, RLS edge case).
    let attribution = null;
    try { attribution = JSON.parse(localStorage.getItem('te_attribution') || 'null'); } catch (_) {}

    const { data: authData, error } = await sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password: pass,
      options: { data: { name, ...(attribution || {}) } },
    });
    if (error) { setBusy(false); setMsg({ text: error.message, ok: false }); return; }

    // Write attribution to profiles columns. Best-effort: failure here doesn't
    // block signup since the data also lives in user_metadata (above) and
    // OnboardingModal could be wired as a fallback later if needed.
    if (attribution && authData?.user?.id) {
      try {
        await sb.from('profiles').update({
          utm_source:   attribution.utm_source   ?? null,
          utm_medium:   attribution.utm_medium   ?? null,
          utm_campaign: attribution.utm_campaign ?? null,
          utm_content:  attribution.utm_content  ?? null,
          utm_term:     attribution.utm_term     ?? null,
          referrer:     attribution.referrer     ?? null,
          landing_path: attribution.landing_path ?? null,
          attribution_captured_at: attribution.captured_at || new Date().toISOString(),
        }).eq('id', authData.user.id);
      } catch (_) { /* non-blocking */ }
    }

    // Pro: hand off to Stripe Checkout for the 7-day trial. With Supabase
    // "Confirm email" disabled, signUp returns an active session immediately,
    // so startCheckout() can read the access token and POST to the worker.
    // startCheckout calls window.location.assign on success — we never return.
    if (plan === 'pro') {
      try {
        await startCheckout({ interval: billingInterval });
      } catch (err) {
        setBusy(false);
        setMsg({ text: `Account created, but couldn't reach Stripe: ${err.message}. You can start your trial from Settings → Billing.`, ok: false });
      }
      return;
    }

    setBusy(false);
    setMsg({ text: '✓ Account created — signing you in…', ok: true });
  };

  return (
    <div className="tp-auth-card">
      <p className="tp-auth-title">Start trading smarter</p>
      <p className="tp-auth-sub">Free forever, no card needed. Upgrade when you want more.</p>
      <div className="tp-auth-field"><label>Your name</label>
        <input type="text" placeholder="John Doe" autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="tp-auth-field"><label>Email</label>
        <input type="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
      <div className="tp-auth-field"><label>Password</label>
        <input type="password" placeholder="Min. 8 characters" autoComplete="new-password" value={pass} onChange={e => setPass(e.target.value)} /></div>
      <div className="tp-plans">
        <div
          className={`tp-plan ${plan === 'free' ? 'tp-plan-selected' : ''}`}
          role="radio"
          aria-checked={plan === 'free'}
          tabIndex={0}
          onClick={() => setPlan('free')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPlan('free'); } }}
        >
          <div className="tp-plan-label">Free</div>
          <div className="tp-plan-price">$0 <span>forever</span></div>
          <div className="tp-plan-note">Core journal · No card needed</div>
        </div>
        <div
          className={`tp-plan pro ${plan === 'pro' ? 'tp-plan-selected' : ''}`}
          role="radio"
          aria-checked={plan === 'pro'}
          tabIndex={0}
          onClick={() => setPlan('pro')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPlan('pro'); } }}
          style={{ position: 'relative' }}
        >
          {isAnnual && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', top: -8, right: 10,
                fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
                color: '#17150F', background: '#E07A3B',
                padding: '3px 8px', borderRadius: 100,
                boxShadow: '0 2px 6px rgba(224,122,59,0.4)',
              }}
            >
              SAVE $38
            </span>
          )}
          <div className="tp-plan-label">Pro</div>
          <div className="tp-plan-price">
            ${isAnnual ? '190' : '19'} <span>{isAnnual ? '/ yr' : '/ mo'}</span>
          </div>
          <div className="tp-plan-note">
            {isAnnual ? '7-day free trial · just ~$15.83/mo' : '7-day free trial · cancel anytime'}
          </div>
        </div>
      </div>

      {/* Monthly | Annual interval toggle — only shown when Pro is selected. */}
      {plan === 'pro' && (
        <div style={{
          display: 'flex',
          background: 'rgba(0,0,0,0.04)',
          border: '1px solid var(--c-border)',
          borderRadius: 100,
          padding: 3,
          marginTop: 14,
        }}>
          <button
            type="button"
            role="switch"
            aria-pressed={!isAnnual}
            aria-label="Monthly billing"
            onClick={() => setBillingInterval('monthly')}
            style={{
              flex: 1, padding: '8px 14px',
              background: !isAnnual ? 'var(--c-surface)' : 'transparent',
              border: 'none', borderRadius: 100,
              fontSize: 13, fontWeight: 600,
              color: !isAnnual ? 'var(--c-text)' : 'var(--c-text-2)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: !isAnnual ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              fontFamily: 'inherit',
            }}
          >
            Monthly
          </button>
          <button
            type="button"
            role="switch"
            aria-pressed={isAnnual}
            aria-label="Annual billing, save 17 percent"
            onClick={() => setBillingInterval('annual')}
            style={{
              flex: 1, padding: '8px 14px',
              background: isAnnual ? 'var(--c-surface)' : 'transparent',
              border: 'none', borderRadius: 100,
              fontSize: 13, fontWeight: 600,
              color: isAnnual ? 'var(--c-text)' : 'var(--c-text-2)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: isAnnual ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              fontFamily: 'inherit',
            }}
          >
            Annual
            <span aria-hidden="true" style={{
              fontSize: 9, fontWeight: 800,
              color: '#E07A3B',
              background: 'rgba(224,122,59,0.12)',
              padding: '2px 6px',
              borderRadius: 100,
              letterSpacing: '0.04em',
            }}>
              SAVE 17%
            </span>
          </button>
        </div>
      )}

      <button className="tp-auth-btn" disabled={busy} onClick={submit} style={{ marginTop: '16px' }}>
        {busy
          ? (plan === 'pro' ? 'Redirecting to Stripe…' : 'Creating account…')
          : (plan === 'pro'
              ? (isAnnual ? 'Start 7-day free trial — then $190 / yr' : 'Start 7-day free trial — then $19 / mo')
              : 'Create free account')}
      </button>
      <p className="tp-auth-err" style={msg.ok ? { color: '#E07A3B' } : {}}>{msg.text}</p>
      <div className="tp-auth-switch" style={{ marginTop:'16px' }}>
        Already have an account? <button onClick={() => onSwitch('login')}>Sign in</button>
      </div>
    </div>
  );
}

function ResetPanel({ onSwitch }) {
  const [email, setEmail] = useState('');
  const [msg,   setMsg]   = useState({ text: '', ok: false });
  const [busy,  setBusy]  = useState(false);

  const submit = async () => {
    setMsg({ text: '', ok: false });
    if (!email) { setMsg({ text: 'Please enter your email.', ok: false }); return; }
    setBusy(true);
    const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin });
    setBusy(false);
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    setMsg({ text: '✓ Reset link sent — check your email.', ok: true });
  };

  return (
    <div className="tp-auth-card">
      <p className="tp-auth-title">Reset password</p>
      <p className="tp-auth-sub">Enter your email and we'll send you a reset link.</p>
      <div className="tp-auth-field"><label>Email</label>
        <input type="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
      <button className="tp-auth-btn" disabled={busy} onClick={submit}>
        {busy ? 'Sending…' : 'Send reset link'}
      </button>
      <p className="tp-auth-err" style={msg.ok ? { color:'#E07A3B' } : {}}>{msg.text}</p>
      <div className="tp-auth-switch" style={{ marginTop:'16px' }}>
        <button onClick={() => onSwitch('login')}>← Back to sign in</button>
      </div>
    </div>
  );
}

function NewPassPanel() {
  const [pass,    setPass]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg,     setMsg]     = useState({ text: '', ok: false });
  const [busy,    setBusy]    = useState(false);

  const submit = async () => {
    setMsg({ text: '', ok: false });
    if (pass.length < 8) { setMsg({ text: 'Password must be at least 8 characters.', ok: false }); return; }
    if (pass !== confirm) { setMsg({ text: 'Passwords do not match.', ok: false }); return; }
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: pass });
    setBusy(false);
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    setMsg({ text: '✓ Password updated! Signing you in…', ok: true });
  };

  return (
    <div className="tp-auth-card">
      <p className="tp-auth-title">Set new password</p>
      <p className="tp-auth-sub">Choose a strong password for your account.</p>
      <div className="tp-auth-field"><label>New password</label>
        <input type="password" placeholder="Min. 8 characters" autoComplete="new-password" value={pass} onChange={e => setPass(e.target.value)} /></div>
      <div className="tp-auth-field"><label>Confirm password</label>
        <input type="password" placeholder="Repeat password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
      <button className="tp-auth-btn" disabled={busy} onClick={submit}>
        {busy ? 'Updating…' : 'Update password'}
      </button>
      <p className="tp-auth-err" style={msg.ok ? { color:'#E07A3B' } : {}}>{msg.text}</p>
    </div>
  );
}

export default function AuthScreen({ panel, onSwitchPanel }) {
  return (
    <div className="screen-auth">
      <div className="tp-auth-wrap">
        <LogoMark />
        {panel === 'login'    && <LoginPanel    onSwitch={onSwitchPanel} />}
        {panel === 'register' && <RegisterPanel onSwitch={onSwitchPanel} />}
        {panel === 'reset'    && <ResetPanel    onSwitch={onSwitchPanel} />}
        {panel === 'newpass'  && <NewPassPanel />}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button onClick={() => onSwitchPanel('landing')}
            style={{ background: 'none', border: 'none', color: '#6B6862', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Back to homepage
          </button>
        </div>
        <p className="tp-auth-tagline">© 2026 TradeEdge · Built for serious day traders</p>
      </div>
    </div>
  );
}
