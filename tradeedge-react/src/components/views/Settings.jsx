import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { sb } from '../../lib/supabase';
import { openPortal } from '../../lib/stripe';
import {
  RULE_TYPES, getRuleTypeMeta, getRules, saveRule, deleteRule, setRuleEnabled,
} from '../../lib/tradingRules';

// ── Layout helpers ────────────────────────────────────────────────────────────

function HR() {
  return <div style={{ height: 1, background: 'var(--c-border)', margin: '28px 0' }} />;
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 18 }}>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginBottom: 6 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--c-text-2)', opacity: 0.6, marginBottom: 8, lineHeight: 1.5 }}>{hint}</div>}
      {children}
    </div>
  );
}

function SaveMsg({ msg }) {
  if (!msg) return null;
  const ok = msg.startsWith('✓');
  return <div style={{ fontSize: 11, marginTop: 6, color: ok ? 'var(--c-accent)' : '#C65A45' }}>{msg}</div>;
}

const inputStyle = {
  width: '100%', maxWidth: 360, boxSizing: 'border-box',
  background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, color: 'var(--c-text)', fontFamily: "'Inter', sans-serif",
  outline: 'none', display: 'block',
};

function ActionButton({ onClick, children, variant = 'primary', disabled }) {
  const styles = {
    primary: { background: 'rgba(224,122,59,0.1)', border: '1px solid rgba(224,122,59,0.35)', color: 'var(--c-accent)' },
    ghost:   { background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-text-2)' },
    danger:  { background: 'transparent', border: '1px solid rgba(198,90,69,0.35)', color: '#C65A45' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer', fontFamily: "'Inter', sans-serif",
        opacity: disabled ? 0.6 : 1, transition: 'opacity 0.15s',
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Settings({ user, profile, showToast, onUpgrade, onReplayOnboarding }) {
  const { exportData, importData, isOnline, syncPending, doSync, offlineQueueCount, theme, toggleTheme, setActiveTab } = useApp();

  const [name,        setName]        = useState(profile?.name || user?.user_metadata?.name || '');
  const [nameMsg,     setNameMsg]     = useState('');
  const [pass,        setPass]        = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [passMsg,     setPassMsg]     = useState('');
  const [claudeKey,   setClaudeKey]   = useState(localStorage.getItem('te_claude_key') || localStorage.getItem('jens_claude_key') || '');
  const [claudeMsg,   setClaudeMsg]   = useState('');
  const [elKey,       setElKey]       = useState(localStorage.getItem('te_el_key') || localStorage.getItem('jens_el_key') || '');
  const [elMsg,       setElMsg]       = useState('');
  const [dailyLimit,  setDailyLimit]  = useState(localStorage.getItem('te_daily_loss_limit') || '');
  const [limitMsg,    setLimitMsg]    = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalErr,     setPortalErr]     = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    if (claudeKey) setClaudeMsg('✓ Key saved');
    if (elKey)     setElMsg('✓ Key saved');
  }, []);

  const saveName = async () => {
    if (!name.trim()) { setNameMsg('Name cannot be empty.'); return; }
    const { error } = await sb.from('profiles').update({ name: name.trim() }).eq('id', user.id);
    if (error) { setNameMsg(error.message); return; }
    setNameMsg('✓ Name updated');
    setTimeout(() => setNameMsg(''), 3000);
    showToast('Display name updated');
  };

  const savePass = async () => {
    setPassMsg('');
    if (pass.length < 6)        { setPassMsg('Min. 6 characters.'); return; }
    if (pass !== passConfirm)   { setPassMsg('Passwords do not match.'); return; }
    const { error } = await sb.auth.updateUser({ password: pass });
    if (error) { setPassMsg(error.message); return; }
    setPassMsg('✓ Password updated');
    setPass(''); setPassConfirm('');
    setTimeout(() => setPassMsg(''), 3000);
    showToast('Password updated');
  };

  const saveClaudeKey = () => {
    if (!claudeKey.startsWith('sk-ant-')) { setClaudeMsg('Key should start with sk-ant-'); return; }
    localStorage.setItem('te_claude_key', claudeKey);
    localStorage.removeItem('jens_claude_key');
    setClaudeMsg('✓ Key saved');
    showToast('Claude key saved');
  };

  const saveElKey = () => {
    if (!elKey.trim()) { setElMsg('Please enter a key.'); return; }
    localStorage.setItem('te_el_key', elKey);
    localStorage.removeItem('jens_el_key');
    setElMsg('✓ Key saved');
    showToast('ElevenLabs key saved');
  };

  const saveDailyLimit = () => {
    const v = parseFloat(dailyLimit);
    if (dailyLimit && (isNaN(v) || v <= 0)) { setLimitMsg('Enter a valid positive number.'); return; }
    localStorage.setItem('te_daily_loss_limit', dailyLimit);
    setLimitMsg('✓ Saved');
    setTimeout(() => setLimitMsg(''), 2500);
    showToast('Daily loss limit saved');
  };

  const handleManageSubscription = async () => {
    if (portalLoading) return;
    setPortalErr('');
    setPortalLoading(true);
    try {
      await openPortal();
      // Browser will redirect away. If we're still here, something stalled.
    } catch (e) {
      setPortalErr(e.message || 'Could not open billing portal.');
      setPortalLoading(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importData(file);
      showToast('Data imported');
    } catch (err) {
      showToast('Import failed: ' + err.message);
    }
    e.target.value = '';
  };

  const isPro = profile?.plan === 'pro';

  return (
    <div style={{ padding: 'clamp(20px, 5vw, 36px) clamp(16px, 4.5vw, 44px) 64px', maxWidth: 840, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
          Settings
        </div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.1 }}>
          Your account<span style={{ color: 'var(--c-accent)' }}>.</span>
        </div>
      </div>

      <HR />

      {/* ── Appearance ── */}
      <SectionLabel>Appearance</SectionLabel>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text)', marginBottom: 3 }}>
            {theme === 'light' ? 'Light mode' : 'Dark mode'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text-2)' }}>Switch between dark and light theme</div>
        </div>
        {/* Toggle switch */}
        <div
          onClick={toggleTheme}
          style={{
            width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
            background: theme === 'light' ? 'var(--c-accent)' : 'var(--c-overlay-strong)',
            border: '1px solid var(--c-border)',
            position: 'relative', transition: 'background 0.2s', flexShrink: 0,
          }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            position: 'absolute', top: 2,
            left: theme === 'light' ? 22 : 2,
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </div>
      </div>

      <HR />

      {/* ── Profile ── */}
      <SectionLabel>Profile</SectionLabel>
      <Field label="Display name">
        <input type="text" style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
        <SaveMsg msg={nameMsg} />
      </Field>
      <Field label="Email">
        <input type="email" style={{ ...inputStyle, opacity: 0.5 }} value={user?.email || ''} disabled />
      </Field>
      <ActionButton onClick={saveName}>Save name</ActionButton>

      <HR />

      {/* ── Password ── */}
      <SectionLabel>Change password</SectionLabel>
      <Field label="New password">
        <input type="password" style={inputStyle} placeholder="Min. 6 characters" value={pass} onChange={e => setPass(e.target.value)} />
      </Field>
      <Field label="Confirm password">
        <input type="password" style={inputStyle} placeholder="Repeat password" value={passConfirm} onChange={e => setPassConfirm(e.target.value)} />
        <SaveMsg msg={passMsg} />
      </Field>
      <ActionButton onClick={savePass}>Update password</ActionButton>

      <HR />

      {/* ── API Keys ── */}
      <SectionLabel>API Keys</SectionLabel>
      <Field
        label="Claude API key"
        hint={<>Optional — Market Brief and AI Insights work out of the box on TradeEdge's Claude. Add your own key here if you'd rather use your own Anthropic quota. Get one at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: 'var(--c-text-2)', textDecoration: 'underline' }}>console.anthropic.com</a>.</>}
      >
        <input type="password" style={inputStyle} placeholder="sk-ant-api03-…" value={claudeKey} onChange={e => setClaudeKey(e.target.value)} />
        <SaveMsg msg={claudeMsg} />
      </Field>
      <div style={{ marginBottom: 24 }}>
        <ActionButton onClick={saveClaudeKey}>Save Claude key</ActionButton>
      </div>

      <Field
        label="ElevenLabs API key"
        hint={<>Optional — enables voice narration in Market Brief. Get yours at <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" style={{ color: 'var(--c-text-2)', textDecoration: 'underline' }}>elevenlabs.io</a>.</>}
      >
        <input type="password" style={inputStyle} placeholder="Paste your ElevenLabs key…" value={elKey} onChange={e => setElKey(e.target.value)} />
        <SaveMsg msg={elMsg} />
      </Field>
      <ActionButton onClick={saveElKey}>Save ElevenLabs key</ActionButton>

      <HR />

      {/* ── Risk management ── */}
      <SectionLabel>Risk management</SectionLabel>
      <Field label="Daily loss limit ($)" hint="Shows a warning banner when you hit this amount on a trading day. Leave blank to disable.">
        <input type="number" style={{ ...inputStyle, maxWidth: 200 }} placeholder="e.g. 200" step="0.01" value={dailyLimit} onChange={e => setDailyLimit(e.target.value)} />
        <SaveMsg msg={limitMsg} />
      </Field>
      <ActionButton onClick={saveDailyLimit}>Save limit</ActionButton>

      <HR />

      {/* ── Data ── */}
      <SectionLabel>Data</SectionLabel>

      {/* Sync status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: isOnline ? (syncPending ? '#EFC97A' : 'var(--c-accent)') : '#A89687',
          boxShadow: isOnline && !syncPending ? '0 0 5px var(--c-accent)' : 'none',
        }} />
        <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
          {isOnline
            ? syncPending
              ? `Syncing ${offlineQueueCount} item${offlineQueueCount !== 1 ? 's' : ''}…`
              : 'All synced'
            : `Offline — ${offlineQueueCount || 0} item${offlineQueueCount !== 1 ? 's' : ''} queued`
          }
        </span>
        {isOnline && syncPending && (
          <button onClick={doSync} style={{ fontSize: 11, color: 'var(--c-accent)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}>
            Sync now
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginBottom: 16, lineHeight: 1.7 }}>
        Export a backup of all your trades and payouts as JSON. Import to restore from a backup.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton onClick={exportData}>Export backup</ActionButton>
        <ActionButton variant="ghost" onClick={() => fileRef.current?.click()}>Import backup</ActionButton>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
      </div>

      <HR />

      {/* ── Subscription ── */}
      <SectionLabel>Subscription</SectionLabel>
      {isPro ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderRadius: 12, background: 'rgba(224,122,59,0.06)', border: '1px solid rgba(224,122,59,0.2)', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-accent)', marginBottom: 4 }}>TradeEdge Pro</div>
              <div style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
                All features unlocked · Founding rate locked in
                {profile?.has_backtesting && <> · Backtesting add-on</>}
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-accent)', background: 'rgba(224,122,59,0.1)', padding: '4px 10px', borderRadius: 100 }}>Active</span>
          </div>
          {portalErr && (
            <div style={{
              padding: '10px 14px', marginBottom: 12, borderRadius: 10,
              background: 'rgba(198,90,69,0.06)', border: '1px solid rgba(198,90,69,0.25)',
              fontSize: 12.5, color: '#C65A45',
            }}>
              {portalErr}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActionButton onClick={handleManageSubscription} disabled={portalLoading}>
              {portalLoading ? 'Opening portal…' : 'Manage subscription'}
            </ActionButton>
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 8, opacity: 0.7 }}>
            Update payment method, change plan, or cancel — opens Stripe's secure portal.
          </div>
        </>
      ) : (
        <>
          <div style={{ padding: '14px 18px', borderRadius: 12, border: '1px solid var(--c-border)', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>Free plan</span>
              <span style={{ fontSize: 11, color: 'var(--c-text-2)', background: 'var(--c-overlay-medium)', padding: '3px 8px', borderRadius: 100, border: '1px solid var(--c-border)' }}>Current</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.7 }}>
              Journal, stats, AI Insights, and one connected account. Upgrade to Pro for unlimited accounts, AI Deep Coaching, weekly reports, and more.
            </div>
          </div>
          <button
            onClick={onUpgrade}
            style={{ width: '100%', maxWidth: 360, padding: '12px', background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
          >
            Try Pro free for 7 days
          </button>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 8, opacity: 0.7 }}>
            Then $19 / month · Founding rate · Cancel anytime
          </div>
        </>
      )}

      <HR />

      {/* ── Help & Tour ── */}
      <SectionLabel>Help</SectionLabel>
      <button
        type="button"
        onClick={() => onReplayOnboarding && onReplayOnboarding()}
        style={{ background: 'none', border: 'none', padding: '6px 0', textAlign: 'left', color: 'var(--c-text)', fontSize: 13, cursor: 'pointer', fontFamily: "'Inter', sans-serif", display: 'block' }}
      >
        Replay welcome tour →
      </button>
      <div style={{ fontSize: 13, color: 'var(--c-text-2)', padding: '6px 0' }}>
        Press <kbd style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, background: 'var(--c-overlay-medium)', border: '1px solid var(--c-border)', borderRadius: 4, padding: '1px 6px', color: 'var(--c-text)' }}>?</kbd> anywhere to see keyboard shortcuts
      </div>

      <HR />

      {/* ── Trading Rules ── */}
      <SectionLabel>Trading rules</SectionLabel>
      <p style={{ fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.6, margin: '0 0 14px', maxWidth: 560 }}>
        Personal commandments. TradeEdge will warn you in Log a trade when an in-progress trade would break one. Soft warnings only — never blocks the save.
      </p>
      <TradingRulesEditor />

      <HR />

      {/* ── Legal ── */}
      <SectionLabel>Legal</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
        <button
          type="button"
          onClick={() => setActiveTab('privacy')}
          style={{ background: 'none', border: 'none', padding: '6px 0', textAlign: 'left', color: 'var(--c-text)', fontSize: 13, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
        >
          Privacy Policy →
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('terms')}
          style={{ background: 'none', border: 'none', padding: '6px 0', textAlign: 'left', color: 'var(--c-text)', fontSize: 13, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
        >
          Terms of Service →
        </button>
      </div>

      <HR />

      {/* ── Danger zone ── */}
      <SectionLabel>Danger zone</SectionLabel>
      <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginBottom: 14, lineHeight: 1.6 }}>
        Sign out of your account on this device.
      </div>
      <ActionButton variant="danger" onClick={async () => { try { await sb.auth.signOut(); } catch (e) {} window.location.href = '/'; }}>
        Sign out
      </ActionButton>
    </div>
  );
}

// ── Trading Rules editor ─────────────────────────────────────────────────────

function TradingRulesEditor() {
  const [rules, setRules] = useState(getRules);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState(RULE_TYPES[0].type);
  const [newValue, setNewValue] = useState('');

  function refresh() { setRules(getRules()); }

  function handleAdd() {
    const value = parseFloat(newValue);
    if (!isFinite(value) || value <= 0) return;
    saveRule({ type: newType, value, enabled: true });
    setAdding(false);
    setNewValue('');
    setNewType(RULE_TYPES[0].type);
    refresh();
  }

  function handleToggle(id, enabled) {
    setRuleEnabled(id, enabled);
    refresh();
  }

  function handleDelete(id) {
    deleteRule(id);
    refresh();
  }

  return (
    <div>
      {rules.length === 0 ? (
        <div style={{
          padding: '14px 16px', border: '1px dashed var(--c-border)', borderRadius: 12,
          fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.6, marginBottom: 12,
        }}>
          No rules yet. Add your first one below.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {rules.map(r => {
            const meta = getRuleTypeMeta(r.type);
            if (!meta) return null;
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', border: '1px solid var(--c-border)', borderRadius: 12,
                background: r.enabled === false ? 'transparent' : 'var(--c-surface)',
                opacity: r.enabled === false ? 0.55 : 1,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', marginBottom: 2 }}>
                    {meta.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-2)' }}>
                    {meta.valueLabel}: <strong style={{ color: 'var(--c-text)' }}>{meta.valuePrefix}{r.value}</strong>
                  </div>
                </div>
                {/* Enable toggle */}
                <div
                  onClick={() => handleToggle(r.id, r.enabled === false)}
                  style={{
                    width: 38, height: 22, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                    background: r.enabled === false ? 'var(--c-overlay-strong)' : 'var(--c-accent)',
                    border: '1px solid var(--c-border)',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                  title={r.enabled === false ? 'Disabled' : 'Enabled'}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 2,
                    left: r.enabled === false ? 2 : 18,
                    transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  }} />
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  style={{
                    width: 26, height: 26, borderRadius: 6,
                    border: '1px solid var(--c-border)', background: 'transparent',
                    color: '#C65A45', fontSize: 14, cursor: 'pointer', lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'inherit', flexShrink: 0,
                  }}
                  title="Delete rule"
                >×</button>
              </div>
            );
          })}
        </div>
      )}

      {!adding ? (
        <button
          onClick={() => { setAdding(true); setNewValue(String(getRuleTypeMeta(newType).valueDefault)); }}
          style={{
            background: 'rgba(224,122,59,0.08)', border: '1px solid rgba(224,122,59,0.3)',
            color: 'var(--c-accent)', borderRadius: 10, padding: '9px 16px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}
        >
          + Add a rule
        </button>
      ) : (
        <div style={{
          padding: '14px 16px', border: '1px solid rgba(224,122,59,0.3)',
          background: 'rgba(224,122,59,0.04)', borderRadius: 12,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 11, color: 'var(--c-text-2)', display: 'block', marginBottom: 5, fontWeight: 500 }}>
                Rule type
              </span>
              <select
                value={newType}
                onChange={e => { setNewType(e.target.value); setNewValue(String(getRuleTypeMeta(e.target.value).valueDefault)); }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', fontSize: 13, fontFamily: "'Inter', sans-serif" }}
              >
                {RULE_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
              <span style={{ fontSize: 11, color: 'var(--c-text-2)', display: 'block', marginTop: 5 }}>
                {getRuleTypeMeta(newType)?.desc}
              </span>
            </label>

            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 11, color: 'var(--c-text-2)', display: 'block', marginBottom: 5, fontWeight: 500 }}>
                {getRuleTypeMeta(newType)?.valueLabel}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {getRuleTypeMeta(newType)?.valuePrefix && (
                  <span style={{ fontSize: 14, color: 'var(--c-text-2)', minWidth: 18 }}>
                    {getRuleTypeMeta(newType).valuePrefix}
                  </span>
                )}
                <input
                  type="number"
                  step="any"
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  placeholder={getRuleTypeMeta(newType)?.placeholder}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', fontSize: 13, fontFamily: "'Inter', sans-serif" }}
                  autoFocus
                />
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setAdding(false); setNewValue(''); }}
              style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid var(--c-border)',
                background: 'transparent', color: 'var(--c-text)', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!parseFloat(newValue) || parseFloat(newValue) <= 0}
              style={{
                flex: 1, padding: '8px 14px', borderRadius: 8, border: 'none',
                background: 'var(--c-accent)', color: '#fff', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                opacity: !parseFloat(newValue) || parseFloat(newValue) <= 0 ? 0.5 : 1,
              }}
            >
              Save rule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
