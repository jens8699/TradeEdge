import { useState } from 'react';
import { startCheckout, openPortal } from '../../lib/stripe';

const FEATURES = [
  { label: 'Trade journal (unlimited)',    free: true,  pro: true  },
  { label: 'Stats & analytics',            free: true,  pro: true  },
  { label: 'Prop firm challenge tracker',  free: true,  pro: true  },
  { label: 'AI Insights (pattern engine)', free: true,  pro: true  },
  { label: 'Connected accounts (1)',       free: true,  pro: false },
  { label: 'Connected accounts (unlimited)', free: false, pro: true },
  { label: 'AI Deep Coaching (Claude)',    free: false, pro: true  },
  { label: 'Social profile & followers',  free: false, pro: true  },
  { label: 'Weekly performance report',   free: false, pro: true  },
  { label: 'Daily P&L notifications',     free: false, pro: true  },
  { label: 'Export to PDF / Excel',       free: false, pro: true  },
  { label: 'Priority support',            free: false, pro: true  },
];

export default function UpgradeModal({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Set when the server tells us the user already has an active subscription.
  // We swap the CTA from "Start trial" to "Manage subscription" in that case.
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  // Billing interval — 'monthly' default. Annual is opt-in via toggle.
  // Renamed from setInterval to avoid clashing with the global setInterval.
  const [billingInterval, setBillingInterval] = useState('monthly');
  const isAnnual = billingInterval === 'annual';

  async function handleSubscribe() {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      // Backtesting add-on is "Coming soon" — never request it from checkout.
      // When the feature ships, re-introduce the toggle and pass addBacktesting here.
      await startCheckout({ interval: billingInterval, addBacktesting: false });
    } catch (e) {
      // 409 + code='already_subscribed' → user has an active sub, send them to portal
      // instead of letting them double-subscribe.
      if (e.code === 'already_subscribed') {
        setAlreadySubscribed(true);
      } else {
        setError(e.message || 'Could not start checkout.');
      }
      setLoading(false);
    }
  }

  async function handleManage() {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await openPortal();
    } catch (e) {
      setError(e.message || 'Could not open the Customer Portal.');
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '16px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--c-surface)', borderRadius: '24px',
        border: '1px solid var(--c-border)', width: '100%', maxWidth: '480px',
        maxHeight: '90vh', overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 0',
          background: 'radial-gradient(ellipse at top right, rgba(224,122,59,0.15) 0%, transparent 60%)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '18px' }}>⚡</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.5px' }}>TradeEdge Pro</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--c-text-2)' }}>Everything you need to trade at your best</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--c-text-2)', cursor: 'pointer', fontSize: '18px', padding: '4px', flexShrink: 0 }}>✕</button>
          </div>

          {/* Billing interval toggle */}
          <div style={{
            display: 'flex',
            background: 'rgba(0,0,0,0.04)',
            border: '1px solid var(--c-border)',
            borderRadius: 100,
            padding: 3,
            marginBottom: 14,
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

          {/* Price */}
          <div style={{
            background: 'rgba(224,122,59,0.08)', border: '1px solid rgba(224,122,59,0.2)',
            borderRadius: '14px', padding: '16px 20px', marginBottom: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#E07A3B', letterSpacing: '-1px' }}>
                  ${isAnnual ? '190' : '19'}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--c-text-2)' }}>
                  {isAnnual ? '/year' : '/month'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--c-text-2)' }}>
                {isAnnual
                  ? '7-day free trial · ~$15.83/mo equivalent · Cancel anytime'
                  : '7-day free trial · Cancel anytime'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#E07A3B', fontWeight: 600, background: 'rgba(224,122,59,0.1)', padding: '4px 10px', borderRadius: '100px', marginBottom: '4px' }}>
                Founding rate
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-2)' }}>Locks in forever</div>
            </div>
          </div>
        </div>

        {/* Feature comparison */}
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Feature</div>
            <div style={{ fontSize: '11px', color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', minWidth: '48px' }}>Free</div>
            <div style={{ fontSize: '11px', color: '#E07A3B', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', minWidth: '48px', fontWeight: 700 }}>Pro</div>
          </div>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto',
              padding: '9px 0', borderBottom: '1px solid var(--c-border)',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--c-text)' }}>{f.label}</span>
              <div style={{ textAlign: 'center', minWidth: '48px', fontSize: '14px' }}>
                {f.free ? <span style={{ color: '#E07A3B' }}>✓</span> : <span style={{ color: 'var(--c-border)' }}>–</span>}
              </div>
              <div style={{ textAlign: 'center', minWidth: '48px', fontSize: '14px' }}>
                {f.pro ? <span style={{ color: '#E07A3B', fontWeight: 700 }}>✓</span> : <span style={{ color: 'var(--c-border)' }}>–</span>}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ padding: '0 24px 24px' }}>
          {/* Backtesting — Coming Soon. Re-enable interactive toggle when feature ships. */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', marginBottom: 12,
              border: '1.5px dashed var(--c-border)',
              background: 'transparent',
              borderRadius: 12, opacity: 0.7,
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0,
              border: '1.5px solid var(--c-border)',
              background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--c-text-2)', fontSize: 11, fontWeight: 800,
            }}>
              ⏱
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', marginBottom: 2 }}>
                Backtesting
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-text-2)' }}>
                5 years of tick data · same dashboard
              </div>
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#E07A3B',
              background: 'rgba(224,122,59,0.1)', border: '1px solid rgba(224,122,59,0.35)',
              padding: '4px 9px', borderRadius: 100, whiteSpace: 'nowrap',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              Coming soon
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', marginBottom: 12, borderRadius: 10,
              background: 'rgba(198,90,69,0.06)', border: '1px solid rgba(198,90,69,0.25)',
              fontSize: 12.5, color: '#C65A45',
            }}>
              {error}
            </div>
          )}

          {alreadySubscribed ? (
            <>
              <div style={{
                padding: '12px 14px', marginBottom: 12, borderRadius: 10,
                background: 'rgba(224,122,59,0.08)', border: '1px solid rgba(224,122,59,0.25)',
                fontSize: 12.5, color: 'var(--c-text)', lineHeight: 1.5,
              }}>
                You're already on Pro. Open the Customer Portal to switch plan, update your card, or cancel.
              </div>
              <button
                onClick={handleManage}
                disabled={loading}
                style={{
                  width: '100%', padding: '13px', background: '#E07A3B',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '14px', fontWeight: 700,
                  cursor: loading ? 'default' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  letterSpacing: '-0.2px',
                }}
              >
                {loading ? 'Opening portal…' : 'Manage subscription →'}
              </button>
              <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--c-text-2)', margin: '8px 0 0' }}>
                Manage plan, payment method, and invoices in Stripe
              </p>
            </>
          ) : (
            <>
              <button
                onClick={handleSubscribe}
                disabled={loading}
                style={{
                  width: '100%', padding: '13px', background: '#E07A3B',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '14px', fontWeight: 700,
                  cursor: loading ? 'default' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  letterSpacing: '-0.2px',
                }}
              >
                {loading
                  ? 'Opening checkout…'
                  : isAnnual
                    ? '⚡ Start 7-day free trial — then $190 / year →'
                    : '⚡ Start 7-day free trial — then $19 / month →'}
              </button>
              <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--c-text-2)', margin: '8px 0 0' }}>
                Card required · Free for 7 days · Cancel anytime from Settings
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
