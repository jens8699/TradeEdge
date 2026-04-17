import { useState } from 'react';

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
  const [submitted, setSubmitted] = useState(false);

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
          background: 'radial-gradient(ellipse at top right, rgba(232,114,74,0.15) 0%, transparent 60%)',
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

          {/* Price */}
          <div style={{
            background: 'rgba(232,114,74,0.08)', border: '1px solid rgba(232,114,74,0.2)',
            borderRadius: '14px', padding: '16px 20px', marginBottom: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#E8724A', letterSpacing: '-1px' }}>$19</span>
                <span style={{ fontSize: '14px', color: 'var(--c-text-2)' }}>/month</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--c-text-2)' }}>Cancel any time · No lock-in</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#5DCAA5', fontWeight: 600, background: 'rgba(93,202,165,0.1)', padding: '4px 10px', borderRadius: '100px', marginBottom: '4px' }}>
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
            <div style={{ fontSize: '11px', color: '#E8724A', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', minWidth: '48px', fontWeight: 700 }}>Pro</div>
          </div>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto',
              padding: '9px 0', borderBottom: '1px solid var(--c-border)',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--c-text)' }}>{f.label}</span>
              <div style={{ textAlign: 'center', minWidth: '48px', fontSize: '14px' }}>
                {f.free ? <span style={{ color: '#5DCAA5' }}>✓</span> : <span style={{ color: 'var(--c-border)' }}>–</span>}
              </div>
              <div style={{ textAlign: 'center', minWidth: '48px', fontSize: '14px' }}>
                {f.pro ? <span style={{ color: '#E8724A', fontWeight: 700 }}>✓</span> : <span style={{ color: 'var(--c-border)' }}>–</span>}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ padding: '0 24px 24px' }}>
          {!submitted ? (
            <>
              <div style={{
                background: 'rgba(93,202,165,0.06)', border: '1px solid rgba(93,202,165,0.15)',
                borderRadius: '10px', padding: '10px 14px', marginBottom: '12px',
                fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.5,
              }}>
                <strong style={{ color: '#5DCAA5' }}>Early access:</strong> Pro is launching soon. Join the waitlist and lock in the founding rate before public launch.
              </div>
              <button
                onClick={() => setSubmitted(true)}
                style={{
                  width: '100%', padding: '13px', background: '#E8724A',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  letterSpacing: '-0.2px',
                }}
              >
                ⚡ Join Pro Waitlist
              </button>
              <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--c-text-2)', margin: '8px 0 0' }}>
                No card required · We'll email you when Pro launches
              </p>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎉</div>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '15px', color: 'var(--c-text)' }}>You're on the list!</p>
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--c-text-2)' }}>
                We'll email you when Pro launches. You'll get the founding rate locked in.
              </p>
              <button onClick={onClose} style={{
                padding: '10px 24px', background: 'var(--c-bg)', color: 'var(--c-text)',
                border: '1px solid var(--c-border)', borderRadius: '10px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
