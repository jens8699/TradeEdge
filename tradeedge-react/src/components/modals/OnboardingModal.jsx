import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { sb } from '../../lib/supabase';

// ── localStorage key ──────────────────────────────────────────────────────────
const OB_KEY = 'te_onboarding_done';
export function markOnboardingDone() {
  try { localStorage.setItem(OB_KEY, '1'); } catch (_) {}
}
export function isOnboardingDone() {
  try { return !!localStorage.getItem(OB_KEY); } catch (_) { return true; }
}

// ── Step definitions ──────────────────────────────────────────────────────────
const STYLES = [
  { id: 'futures',  emoji: '⚡', label: 'Futures',   sub: 'ES, NQ, MES, MNQ…' },
  { id: 'forex',    emoji: '💱', label: 'Forex',      sub: 'EUR/USD, GBP/JPY…' },
  { id: 'stocks',   emoji: '📈', label: 'Stocks',     sub: 'Equities & options' },
  { id: 'crypto',   emoji: '₿',  label: 'Crypto',     sub: 'BTC, ETH & alts' },
];

const START_OPTIONS = [
  {
    id: 'csv',
    emoji: '📥',
    label: 'Import CSV',
    sub: 'Bring in your existing trades from Tradovate, Rithmic, or NinjaTrader.',
    tab: 'connections',
  },
  {
    id: 'manual',
    emoji: '✏️',
    label: 'Log a trade',
    sub: 'Log your first trade manually — takes under a minute.',
    tab: 'entry',
  },
  {
    id: 'explore',
    emoji: '🗺️',
    label: 'Explore first',
    sub: 'Have a look around the journal before you start.',
    tab: 'dashboard',
  },
];

// ── Progress dots ─────────────────────────────────────────────────────────────
function Dots({ total, current }) {
  return (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '28px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? '20px' : '6px',
          height: '6px',
          borderRadius: '100px',
          background: i === current ? '#E07A3B' : i < current ? '#E07A3B66' : 'var(--c-border)',
          transition: 'all 0.3s ease',
        }} />
      ))}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function OnboardingModal({ user, profile, onClose }) {
  const { setActiveTab } = useApp();
  const [step,    setStep]    = useState(0);
  const [name,    setName]    = useState(
    profile?.name || user?.user_metadata?.name || ''
  );
  const [style,   setStyle]   = useState(null);
  const [saving,  setSaving]  = useState(false);

  // Animate in on mount
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const totalSteps = 4;

  const saveAndClose = async (tab = 'dashboard') => {
    setSaving(true);
    markOnboardingDone();
    // Update profile name + trading_style if changed
    if (user?.id) {
      const updates = {};
      if (name && name !== (profile?.name)) updates.name = name.trim();
      if (style) updates.trading_style = style;
      if (Object.keys(updates).length > 0) {
        try {
          await sb.from('profiles').update(updates).eq('id', user.id);
        } catch (_) {}
      }
    }
    setSaving(false);
    setActiveTab(tab);
    onClose();
  };

  const next = () => setStep(s => s + 1);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.2s ease',
    }}>
      <div style={{
        background: 'var(--c-surface)',
        border: '0.5px solid var(--c-border)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '440px',
        maxHeight: '90vh',
        overflowY: 'auto',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
        transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* ── Step 0: Welcome ─────────────────────────────────── */}
        {step === 0 && (
          <StepWelcome
            name={name}
            setName={setName}
            onNext={next}
            totalSteps={totalSteps}
            step={step}
          />
        )}

        {/* ── Step 1: Trading style ────────────────────────────── */}
        {step === 1 && (
          <StepStyle
            selected={style}
            setSelected={setStyle}
            onNext={next}
            onBack={() => setStep(0)}
            totalSteps={totalSteps}
            step={step}
          />
        )}

        {/* ── Step 2: What to do first ─────────────────────────── */}
        {step === 2 && (
          <StepStart
            name={name}
            onPick={(tab) => saveAndClose(tab)}
            onBack={() => setStep(1)}
            saving={saving}
            totalSteps={totalSteps}
            step={step}
          />
        )}
      </div>
    </div>
  );
}

// ── Step 0: Welcome + Name ────────────────────────────────────────────────────
function StepWelcome({ name, setName, onNext, totalSteps, step }) {
  return (
    <div style={{ padding: '36px 28px 28px' }}>
      <Dots total={totalSteps - 1} current={step} />

      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '18px',
          background: 'rgba(224,122,59,0.12)',
          border: '1px solid rgba(224,122,59,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: '28px',
        }}>
          📊
        </div>
        <h2 style={{
          margin: '0 0 8px', fontSize: '22px', fontWeight: 800,
          color: 'var(--c-text)', lineHeight: 1.2,
        }}>
          Welcome to TradeEdge
        </h2>
        <p style={{
          margin: 0, fontSize: '14px', color: 'var(--c-text-2)', lineHeight: 1.6,
        }}>
          Your personal trading journal. Let's get you set up in 60 seconds.
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block', fontSize: '12px', fontWeight: 600,
          color: 'var(--c-text-2)', marginBottom: '8px',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          What should we call you?
        </label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onNext()}
          placeholder="Your name or trading alias"
          style={{
            width: '100%', background: 'var(--c-bg)',
            border: '1.5px solid var(--c-border)',
            borderRadius: '10px', padding: '11px 14px',
            color: 'var(--c-text)', fontSize: '14px',
            boxSizing: 'border-box', outline: 'none',
            transition: 'border-color 0.15s',
            fontFamily: 'inherit',
          }}
          onFocus={e => e.target.style.borderColor = '#E07A3B'}
          onBlur={e => e.target.style.borderColor = 'var(--c-border)'}
        />
      </div>

      <button
        onClick={onNext}
        disabled={!name.trim()}
        style={{
          width: '100%', padding: '13px',
          background: name.trim() ? '#E07A3B' : 'var(--c-border)',
          color: name.trim() ? '#fff' : 'var(--c-text-2)',
          border: 'none', borderRadius: '12px',
          fontSize: '14px', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'default',
          transition: 'all 0.15s',
        }}
      >
        Let's go →
      </button>
    </div>
  );
}

// ── Step 1: Trading style ─────────────────────────────────────────────────────
function StepStyle({ selected, setSelected, onNext, onBack, totalSteps, step }) {
  return (
    <div style={{ padding: '32px 28px 28px' }}>
      <Dots total={totalSteps - 1} current={step} />

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 800, color: 'var(--c-text)' }}>
          What do you trade?
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--c-text-2)' }}>
          Helps us tailor insights to your market.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
        {STYLES.map(s => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            style={{
              background: selected === s.id ? 'rgba(224,122,59,0.1)' : 'var(--c-bg)',
              border: selected === s.id ? '1.5px solid #E07A3B' : '1.5px solid var(--c-border)',
              borderRadius: '12px',
              padding: '14px 12px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.emoji}</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text)', marginBottom: '2px' }}>
              {s.label}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--c-text-2)' }}>{s.sub}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onBack} style={{
          flex: '0 0 auto', padding: '12px 18px',
          background: 'none', border: '0.5px solid var(--c-border)',
          borderRadius: '12px', color: 'var(--c-text-2)',
          fontSize: '13px', cursor: 'pointer',
        }}>
          ← Back
        </button>
        <button
          onClick={onNext}
          style={{
            flex: 1, padding: '13px',
            background: '#E07A3B', color: '#fff',
            border: 'none', borderRadius: '12px',
            fontSize: '14px', fontWeight: 700, cursor: 'pointer',
          }}
        >
          {selected ? 'Continue →' : 'Skip for now →'}
        </button>
      </div>
    </div>
  );
}

// ── Step 2: How to start ──────────────────────────────────────────────────────
function StepStart({ name, onPick, onBack, saving, totalSteps, step }) {
  const firstName = name?.split(' ')[0] || 'Trader';
  return (
    <div style={{ padding: '32px 28px 28px' }}>
      <Dots total={totalSteps - 1} current={step} />

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 800, color: 'var(--c-text)' }}>
          How do you want to start, {firstName}?
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--c-text-2)' }}>
          You can always change this later.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {START_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => !saving && onPick(opt.tab)}
            disabled={saving}
            style={{
              background: 'var(--c-bg)',
              border: '1.5px solid var(--c-border)',
              borderRadius: '12px',
              padding: '14px 16px',
              cursor: saving ? 'wait' : 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'all 0.15s',
              opacity: saving ? 0.6 : 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#E07A3B'; e.currentTarget.style.background = 'rgba(224,122,59,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.background = 'var(--c-bg)'; }}
          >
            <span style={{ fontSize: '24px', flexShrink: 0 }}>{opt.emoji}</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text)', marginBottom: '2px' }}>
                {opt.label}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-2)', lineHeight: 1.5 }}>{opt.sub}</div>
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--c-text-2)', fontSize: '16px' }}>›</span>
          </button>
        ))}
      </div>

      <button onClick={onBack} style={{
        width: '100%', padding: '11px',
        background: 'none', border: '0.5px solid var(--c-border)',
        borderRadius: '12px', color: 'var(--c-text-2)',
        fontSize: '13px', cursor: 'pointer',
      }}>
        ← Back
      </button>
    </div>
  );
}
