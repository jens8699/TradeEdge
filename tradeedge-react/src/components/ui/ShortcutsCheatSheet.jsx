import { SHORTCUTS } from '../../hooks/useKeyboardShortcuts';

// Pretty-prints the key as a small mono pill ("⌘" / "Esc" / "?").
function Key({ k }) {
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11, fontWeight: 600,
      background: 'var(--c-overlay-medium)',
      border: '1px solid var(--c-border)',
      borderRadius: 5,
      padding: '2px 7px',
      color: 'var(--c-text)',
      lineHeight: 1.3,
      minWidth: 14,
      textAlign: 'center',
    }}>
      {k}
    </span>
  );
}

export default function ShortcutsCheatSheet({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 16,
        width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto',
        padding: '24px 28px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
              Shortcuts
            </div>
            <h3 style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 22, color: 'var(--c-text)',
              letterSpacing: '-0.02em', margin: 0,
            }}>
              Faster <em style={{ fontStyle: 'italic', color: 'var(--c-accent)' }}>journaling</em>.
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--c-text-2)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4 }}
            title="Close (Esc)"
          >✕</button>
        </div>

        {SHORTCUTS.map(group => (
          <div key={group.group} style={{ marginBottom: 18 }}>
            <div style={{
              fontSize: 11, color: 'var(--c-text-2)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: 10, fontWeight: 600,
            }}>
              {group.group}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, columnGap: 16, alignItems: 'center' }}>
              {group.items.map((item, i) => (
                <>
                  <span key={`l-${i}`} style={{ fontSize: 13, color: 'var(--c-text)' }}>
                    {item.label}
                  </span>
                  <span key={`k-${i}`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    {item.keys.map((k, j) => (
                      <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Key k={k} />
                        {j < item.keys.length - 1 && (
                          <span style={{ fontSize: 9, color: 'var(--c-text-2)', opacity: 0.6 }}>then</span>
                        )}
                      </span>
                    ))}
                  </span>
                </>
              ))}
            </div>
          </div>
        ))}

        <div style={{
          fontSize: 11, color: 'var(--c-text-2)', lineHeight: 1.6,
          marginTop: 8, paddingTop: 14, borderTop: '1px solid var(--c-border)',
        }}>
          Tip: shortcuts are ignored while you're typing in any input. Press
          {' '}<Key k="?" /> any time to show this sheet again.
        </div>
      </div>
    </div>
  );
}
