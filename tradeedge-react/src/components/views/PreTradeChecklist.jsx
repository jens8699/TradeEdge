import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';

const STORAGE_KEY  = 'te_checklist_items';
const SESSION_KEY  = 'te_checklist_session';

const DEFAULT_ITEMS = [
  { id: 'plan',     text: 'I have a clear trade plan — entry, stop, and target are defined' },
  { id: 'risk',     text: 'My risk per trade is within my daily limit' },
  { id: 'news',     text: 'I have checked for upcoming news events that could affect this trade' },
  { id: 'trend',    text: 'The trade is in the direction of the higher-timeframe trend' },
  { id: 'emotion',  text: 'I am not in revenge mode, FOMO, or trading emotionally' },
  { id: 'daily',    text: 'I have not hit my daily loss limit' },
  { id: 'setup',    text: 'This setup meets my strategy criteria — it is not impulsive' },
  { id: 'patient',  text: 'I have waited for confirmation — I am not chasing the entry' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ITEMS;
    return JSON.parse(raw);
  } catch { return DEFAULT_ITEMS; }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.date !== todayStr()) return null;
    return s;
  } catch { return null; }
}

export default function PreTradeChecklist({ showToast }) {
  const { setActiveTab } = useApp();
  const [items,    setItems]    = useState(loadItems);
  const [checked,  setChecked]  = useState({});
  const [session,  setSession]  = useState(loadSession);
  const [editMode, setEditMode] = useState(false);
  const [newText,  setNewText]  = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText,  setEditText]  = useState('');
  const [showBlock, setShowBlock] = useState(false); // "hard stop" overlay

  // Persist items on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const allChecked = items.length > 0 && items.every(i => checked[i.id]);
  const checkedCount = items.filter(i => checked[i.id]).length;

  const toggle = (id) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
    setShowBlock(false);
  };

  const resetChecklist = () => {
    setChecked({});
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const pass = () => {
    if (!allChecked) {
      setShowBlock(true);
      return;
    }
    const s = { date: todayStr(), passedAt: new Date().toISOString(), count: checkedCount };
    setSession(s);
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    showToast?.('Checklist passed — you are cleared to trade', 'success', 3000);
  };

  const goLog = () => {
    if (!allChecked && !session) {
      setShowBlock(true);
      return;
    }
    setActiveTab('entry');
  };

  // ── Item editing ─────────────────────────────────────────────────────────────
  const addItem = () => {
    const t = newText.trim();
    if (!t) return;
    const id = 'custom_' + Date.now();
    setItems(prev => [...prev, { id, text: t }]);
    setNewText('');
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setChecked(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const saveEdit = () => {
    const t = editText.trim();
    if (t) setItems(prev => prev.map(i => i.id === editingId ? { ...i, text: t } : i));
    setEditingId(null);
    setEditText('');
  };

  const resetToDefaults = () => {
    setItems(DEFAULT_ITEMS);
    setChecked({});
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
  };

  // ── Styles ───────────────────────────────────────────────────────────────────
  const inp = {
    width: '100%', padding: '10px 13px', borderRadius: 10, fontSize: 14,
    background: 'var(--c-surface)', border: '1px solid var(--c-border)',
    color: 'var(--c-text)', outline: 'none', fontFamily: "'Inter', sans-serif",
    boxSizing: 'border-box', transition: 'border-color 0.15s',
  };

  const passed = !!session;

  return (
    <div style={{ padding: '36px 44px', maxWidth: 700, margin: '0 auto', paddingBottom: 60 }}>

      {/* ── Hard-stop overlay ── */}
      {showBlock && (
        <div
          onClick={() => setShowBlock(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 900,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--c-surface)', border: '1.5px solid #C65A45',
              borderRadius: 20, padding: '36px 40px', maxWidth: 420, textAlign: 'center',
              animation: 'scaleIn 0.2s ease both',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 14 }}>⛔</div>
            <div style={{
              fontFamily: "'Fraunces', Georgia, serif", fontSize: 26,
              letterSpacing: '-0.03em', color: '#C65A45', marginBottom: 12,
            }}>
              Not yet.
            </div>
            <div style={{ fontSize: 14, color: 'var(--c-text-2)', lineHeight: 1.6, marginBottom: 24 }}>
              {items.filter(i => !checked[i.id]).length} item{items.filter(i => !checked[i.id]).length !== 1 ? 's' : ''} still unchecked.
              Complete the checklist before logging a trade — that's the point.
            </div>
            <button
              onClick={() => setShowBlock(false)}
              style={{
                padding: '11px 28px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                background: 'var(--c-border)', color: 'var(--c-text)',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Go back and finish it
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
        Discipline
      </div>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.1, marginBottom: 10 }}>
        Pre-trade <em style={{ color: 'var(--c-accent)' }}>checklist</em>.
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--c-text-2)', lineHeight: 1.55, maxWidth: 520, marginBottom: 6 }}>
        Every box must be checked before you enter a trade. No exceptions.
      </div>

      {/* ── Session badge ── */}
      {passed && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(224,122,59,0.1)', border: '1px solid rgba(224,122,59,0.3)',
          borderRadius: 100, padding: '6px 16px', marginTop: 16, fontSize: 12, color: 'var(--c-accent)',
        }}>
          <span>✓</span>
          <span>Passed today at {new Date(session.passedAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
          <button onClick={resetChecklist} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 11,
            color: 'var(--c-text-2)', padding: 0, fontFamily: 'inherit', textDecoration: 'underline', marginLeft: 4,
          }}>
            Reset
          </button>
        </div>
      )}

      {/* ── Progress bar ── */}
      <div style={{ marginTop: 28, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Progress
          </span>
          <span style={{ fontSize: 11, color: allChecked ? 'var(--c-accent)' : 'var(--c-text-2)', fontWeight: 600 }}>
            {checkedCount} / {items.length}
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--c-border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: allChecked ? 'var(--c-accent)' : 'linear-gradient(90deg, var(--c-accent) 0%, #F0904E 100%)',
            width: `${items.length > 0 ? (checkedCount / items.length) * 100 : 0}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* ── Checklist items ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {items.map((item) => {
          const isChecked = !!checked[item.id];
          const isEditing = editingId === item.id;
          return (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: isEditing ? 'flex-start' : 'center', gap: 14,
                background: isChecked ? 'rgba(224,122,59,0.06)' : 'var(--c-surface)',
                border: `1px solid ${isChecked ? 'rgba(224,122,59,0.25)' : 'var(--c-border)'}`,
                borderRadius: 12, padding: '14px 16px',
                transition: 'all 0.15s', cursor: isEditing ? 'default' : 'pointer',
              }}
              onClick={() => !editMode && !isEditing && toggle(item.id)}
            >
              {/* Checkbox */}
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                border: `1.5px solid ${isChecked ? 'var(--c-accent)' : 'var(--c-border)'}`,
                background: isChecked ? 'var(--c-accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
                color: '#fff', fontSize: 12, fontWeight: 700,
              }}>
                {isChecked && '✓'}
              </div>

              {/* Text or edit input */}
              {isEditing ? (
                <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    autoFocus
                    style={{ ...inp, flex: 1, fontSize: 13 }}
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                    onClick={e => e.stopPropagation()}
                  />
                  <button onClick={e => { e.stopPropagation(); saveEdit(); }} style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'var(--c-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  }}>Save</button>
                  <button onClick={e => { e.stopPropagation(); setEditingId(null); }} style={{
                    padding: '8px 10px', borderRadius: 8, fontSize: 12,
                    background: 'transparent', color: 'var(--c-text-2)', border: '1px solid var(--c-border)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>✕</button>
                </div>
              ) : (
                <span style={{
                  flex: 1, fontSize: 13.5, lineHeight: 1.5,
                  color: isChecked ? 'var(--c-text-2)' : 'var(--c-text)',
                  textDecoration: isChecked ? 'line-through' : 'none',
                  opacity: isChecked ? 0.7 : 1,
                  transition: 'all 0.15s',
                }}>
                  {item.text}
                </span>
              )}

              {/* Edit controls (only in edit mode) */}
              {editMode && !isEditing && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => startEdit(item)} style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11,
                    background: 'transparent', color: 'var(--c-text-2)',
                    border: '1px solid var(--c-border)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>Edit</button>
                  <button onClick={() => removeItem(item.id)} style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11,
                    background: 'transparent', color: '#C65A45',
                    border: '1px solid rgba(198,90,69,0.3)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>Remove</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add custom item (edit mode) ── */}
      {editMode && (
        <div style={{
          display: 'flex', gap: 10, marginBottom: 20,
          background: 'var(--c-surface)', border: '1px dashed var(--c-border)',
          borderRadius: 12, padding: '12px 14px',
        }}>
          <input
            style={{ ...inp, flex: 1, fontSize: 13 }}
            placeholder="Add a custom rule…"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
          />
          <button onClick={addItem} style={{
            padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: 'var(--c-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            flexShrink: 0,
          }}>Add</button>
        </div>
      )}

      {/* ── Action row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

        {/* Primary CTA */}
        {!passed ? (
          <button
            onClick={pass}
            disabled={!allChecked}
            style={{
              padding: '13px 28px', borderRadius: 12, fontSize: 15, fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              background: allChecked ? 'var(--c-accent)' : 'var(--c-border)',
              color: allChecked ? '#fff' : 'var(--c-text-2)',
              border: 'none', cursor: allChecked ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {allChecked ? 'Mark as passed →' : `${items.length - checkedCount} left to check`}
          </button>
        ) : (
          <button
            onClick={goLog}
            style={{
              padding: '13px 28px', borderRadius: 12, fontSize: 15, fontWeight: 600,
              fontFamily: "'Inter', sans-serif", background: 'var(--c-accent)',
              color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            Log a trade →
          </button>
        )}

        {/* Edit toggle */}
        <button
          onClick={() => setEditMode(m => !m)}
          style={{
            padding: '13px 20px', borderRadius: 12, fontSize: 13, fontWeight: 500,
            fontFamily: "'Inter', sans-serif",
            background: editMode ? 'rgba(224,122,59,0.1)' : 'transparent',
            color: editMode ? 'var(--c-accent)' : 'var(--c-text-2)',
            border: `1px solid ${editMode ? 'rgba(224,122,59,0.3)' : 'var(--c-border)'}`,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {editMode ? 'Done editing' : 'Customize'}
        </button>

        {/* Reset defaults (only in edit mode) */}
        {editMode && (
          <button
            onClick={resetToDefaults}
            style={{
              padding: '13px 16px', borderRadius: 12, fontSize: 13,
              fontFamily: "'Inter', sans-serif",
              background: 'transparent', color: 'var(--c-text-2)',
              border: '1px solid var(--c-border)', cursor: 'pointer',
            }}
          >
            Reset to defaults
          </button>
        )}
      </div>

      {/* ── Helper tip ── */}
      {!passed && !allChecked && (
        <div style={{ marginTop: 28, padding: '14px 18px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-text-2)', marginBottom: 6 }}>
            Why this exists
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.65 }}>
            Most traders don't lose money because they can't read charts — they lose because they enter trades they know they shouldn't.
            This checklist is a hard gate. It keeps you honest before the trade, not sorry after.
          </div>
        </div>
      )}

    </div>
  );
}
