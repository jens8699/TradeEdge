import { useState } from 'react';
import { sb } from '../../lib/supabase';

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
  const [msg,   setMsg]   = useState({ text: '', ok: false });
  const [busy,  setBusy]  = useState(false);

  const submit = async () => {
    setMsg({ text: '', ok: false });
    if (!name || !email || !pass) { setMsg({ text: 'Please fill in all fields.', ok: false }); return; }
    if (!email.includes('@'))      { setMsg({ text: 'Enter a valid email address.', ok: false }); return; }
    if (pass.length < 6)           { setMsg({ text: 'Password must be at least 6 characters.', ok: false }); return; }
    setBusy(true);
    const { error } = await sb.auth.signUp({ email: email.trim().toLowerCase(), password: pass, options: { data: { name } } });
    setBusy(false);
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    setMsg({ text: '✓ Account created! Check your email to confirm, then sign in.', ok: true });
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
        <input type="password" placeholder="Min. 6 characters" autoComplete="new-password" value={pass} onChange={e => setPass(e.target.value)} /></div>
      <button className="tp-auth-btn" disabled={busy} onClick={submit}>
        {busy ? 'Creating account…' : (msg.ok ? 'Check your email ✓' : 'Create free account')}
      </button>
      <p className="tp-auth-err" style={msg.ok ? { color: '#E07A3B' } : {}}>{msg.text}</p>
      <div className="tp-plans">
        <div className="tp-plan">
          <div className="tp-plan-label">Free</div>
          <div className="tp-plan-price">$0 <span>forever</span></div>
          <div className="tp-plan-note">Core journal · No card needed</div>
        </div>
        <div className="tp-plan pro">
          <div className="tp-plan-label">Pro</div>
          <div className="tp-plan-price">$19 <span>/ mo</span></div>
          <div className="tp-plan-note">7-day free trial · Cancel anytime</div>
        </div>
      </div>
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
    if (pass.length < 6) { setMsg({ text: 'Password must be at least 6 characters.', ok: false }); return; }
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
        <input type="password" placeholder="Min. 6 characters" autoComplete="new-password" value={pass} onChange={e => setPass(e.target.value)} /></div>
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
