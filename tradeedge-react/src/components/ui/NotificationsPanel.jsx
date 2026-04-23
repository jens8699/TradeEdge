import { useState, useEffect, useCallback } from 'react';

// ── Notification generation ───────────────────────────────────────────────────
// Derives notifications from trade data + localStorage events.
// Each notification: { id, type, icon, title, body, ts, read }

const MILESTONE_DEFS = [
  { count: 1,   emoji: '🌱', label: 'First trade logged!' },
  { count: 5,   emoji: '✨', label: '5 trades logged — you\'re building momentum!' },
  { count: 10,  emoji: '🎯', label: '10 trades logged — great start!' },
  { count: 25,  emoji: '📈', label: '25 trades — you\'re in the zone!' },
  { count: 50,  emoji: '🏅', label: '50 trades — half a century!' },
  { count: 100, emoji: '💯', label: '100 trades — serious trader!' },
  { count: 250, emoji: '🔥', label: '250 trades — elite level!' },
  { count: 500, emoji: '🏆', label: '500 trades — legend status!' },
];

function getPnl(t) {
  const v = parseFloat(t.pnl ?? t.profit_loss ?? 0);
  return isNaN(v) ? 0 : v;
}

function dateKey(iso) {
  return iso ? iso.slice(0, 10) : null;
}

function generateNotifications(trades) {
  const notes = [];

  if (!trades || trades.length === 0) {
    notes.push({
      id: 'welcome',
      type: 'welcome',
      icon: '👋',
      title: 'Welcome to TradeEdge!',
      body: 'Log your first trade to get started. Import a CSV or connect your broker.',
      ts: new Date().toISOString(),
      read: false,
    });
    return notes;
  }

  // ── Milestones ─────────────────────────────────────────────────────────────
  for (const m of MILESTONE_DEFS) {
    if (trades.length >= m.count) {
      const tradeAtMilestone = trades[m.count - 1];
      notes.push({
        id: `milestone_${m.count}`,
        type: 'milestone',
        icon: m.emoji,
        title: m.label,
        body: `You\'ve now logged ${m.count} trade${m.count === 1 ? '' : 's'} in your journal.`,
        ts: tradeAtMilestone?.created_at || new Date().toISOString(),
        read: false,
      });
    }
  }

  // ── Win streak ─────────────────────────────────────────────────────────────
  const sorted = [...trades].sort((a, b) =>
    new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
  let streak = 0;
  let maxStreak = 0;
  for (const t of sorted) {
    if (getPnl(t) > 0) { streak++; maxStreak = Math.max(maxStreak, streak); }
    else if (getPnl(t) < 0) break;
  }
  if (streak >= 3) {
    notes.push({
      id: `streak_${streak}`,
      type: 'streak',
      icon: '🔥',
      title: `${streak}-trade win streak!`,
      body: 'You\'re on fire — keep that discipline going.',
      ts: sorted[0]?.created_at || new Date().toISOString(),
      read: false,
    });
  }

  // ── Best day ───────────────────────────────────────────────────────────────
  const byDay = {};
  for (const t of trades) {
    const d = dateKey(t.created_at || t.date);
    if (!d) continue;
    byDay[d] = (byDay[d] || 0) + getPnl(t);
  }
  const days = Object.entries(byDay);
  if (days.length > 0) {
    const [bestDate, bestPnl] = days.reduce((a, b) => b[1] > a[1] ? b : a);
    if (bestPnl > 0) {
      const fmt = new Date(bestDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      notes.push({
        id: `bestday_${bestDate}`,
        type: 'best_day',
        icon: '🚀',
        title: `Best day: +$${bestPnl.toFixed(2)} on ${fmt}`,
        body: `That was your highest-earning single day so far. Keep building on it.`,
        ts: bestDate + 'T23:59:00.000Z',
        read: false,
      });
    }
  }

  // ── Win rate insight ───────────────────────────────────────────────────────
  if (trades.length >= 10) {
    const wins = trades.filter(t => getPnl(t) > 0).length;
    const wr = Math.round((wins / trades.length) * 100);
    if (wr >= 60) {
      notes.push({
        id: `winrate_${wr}`,
        type: 'insight',
        icon: '📊',
        title: `${wr}% win rate — above average!`,
        body: `Most retail traders sit under 50%. You\'re outperforming. Keep your edge.`,
        ts: trades[trades.length - 1]?.created_at || new Date().toISOString(),
        read: false,
      });
    } else if (wr < 40) {
      notes.push({
        id: `winrate_${wr}`,
        type: 'insight',
        icon: '💡',
        title: `Win rate is ${wr}% — room to improve`,
        body: 'Check your AI Insights page for patterns in your losing trades.',
        ts: trades[trades.length - 1]?.created_at || new Date().toISOString(),
        read: false,
      });
    }
  }

  // ── Recent CSV imports (stored by CSV importer in localStorage) ────────────
  try {
    const raw = localStorage.getItem('te_csv_imports');
    if (raw) {
      const imports = JSON.parse(raw);
      for (const imp of imports.slice(0, 3)) {
        notes.push({
          id: `csv_${imp.ts}`,
          type: 'import',
          icon: '📥',
          title: `${imp.count} trades imported`,
          body: `CSV import from ${imp.broker || 'unknown broker'} completed successfully.`,
          ts: imp.ts,
          read: false,
        });
      }
    }
  } catch (_) {}

  // Sort newest first
  notes.sort((a, b) => new Date(b.ts) - new Date(a.ts));

  return notes;
}

// ── Read-state persistence ─────────────────────────────────────────────────────
function loadReadSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem('te_notif_read') || '[]'));
  } catch (_) { return new Set(); }
}
function saveReadSet(set) {
  try { localStorage.setItem('te_notif_read', JSON.stringify([...set])); } catch (_) {}
}

// ── Time formatting ────────────────────────────────────────────────────────────
function relativeTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)      return 'just now';
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)  return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Type colours ───────────────────────────────────────────────────────────────
const TYPE_COLOR = {
  milestone: '#E8724A',
  streak:    '#F59E0B',
  best_day:  '#5DCAA5',
  insight:   '#85B7EB',
  import:    '#A78BFA',
  welcome:   '#5DCAA5',
};

// ─────────────────────────────────────────────────────────────────────────────
// NotificationsPanel — slide-in drawer from the left (below sidebar)
// Props: trades, isOpen, onClose
// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationsPanel({ trades, isOpen, onClose }) {
  const [notes,   setNotes]   = useState([]);
  const [readSet, setReadSet] = useState(loadReadSet);

  // Regenerate whenever trades change
  useEffect(() => {
    const generated = generateNotifications(trades);
    const rs = loadReadSet();
    setNotes(generated.map(n => ({ ...n, read: rs.has(n.id) })));
    setReadSet(rs);
  }, [trades]);

  const unreadCount = notes.filter(n => !n.read).length;

  const markAllRead = useCallback(() => {
    const newSet = new Set(notes.map(n => n.id));
    saveReadSet(newSet);
    setReadSet(newSet);
    setNotes(prev => prev.map(n => ({ ...n, read: true })));
  }, [notes]);

  const markOneRead = useCallback((id) => {
    setReadSet(prev => {
      const next = new Set(prev);
      next.add(id);
      saveReadSet(next);
      return next;
    });
    setNotes(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 8998,
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            animation: 'fadeIn 0.15s ease',
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: isOpen ? '220px' : '-340px',
        width: '320px',
        height: '100vh',
        zIndex: 8999,
        background: 'var(--c-surface)',
        borderRight: '1px solid var(--c-border)',
        boxShadow: isOpen ? '4px 0 32px rgba(0,0,0,0.25)' : 'none',
        transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1), box-shadow 0.28s ease',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--c-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>🔔</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text)' }}>
              Activity
            </span>
            {unreadCount > 0 && (
              <span style={{
                fontSize: '10px', fontWeight: 700,
                background: '#E8724A', color: '#fff',
                borderRadius: '100px', padding: '1px 6px',
                minWidth: '18px', textAlign: 'center',
              }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: 'none', border: 'none',
                  fontSize: '11px', color: '#E8724A',
                  cursor: 'pointer', fontWeight: 600, padding: '2px 4px',
                }}
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none',
                color: 'var(--c-text-2)', cursor: 'pointer',
                fontSize: '18px', lineHeight: 1, padding: '2px 4px',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Feed */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0',
        }}>
          {notes.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--c-text-2)',
              fontSize: '13px',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔕</div>
              No notifications yet
            </div>
          ) : (
            notes.map(n => (
              <NotifCard
                key={n.id}
                notif={n}
                color={TYPE_COLOR[n.type] || '#6B6862'}
                onRead={() => markOneRead(n.id)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--c-border)',
          fontSize: '11px',
          color: 'var(--c-text-2)',
          flexShrink: 0,
          textAlign: 'center',
        }}>
          Notifications are generated from your trade data
        </div>
      </div>
    </>
  );
}

// ── Single notification card ──────────────────────────────────────────────────
function NotifCard({ notif, color, onRead }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onRead}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: '12px',
        padding: '12px 20px',
        cursor: notif.read ? 'default' : 'pointer',
        background: hovered && !notif.read
          ? 'rgba(255,255,255,0.03)'
          : notif.read ? 'transparent' : 'rgba(232,114,74,0.03)',
        borderBottom: '1px solid var(--c-border)',
        transition: 'background 0.12s',
        position: 'relative',
      }}
    >
      {/* Unread dot */}
      {!notif.read && (
        <div style={{
          position: 'absolute',
          top: '50%',
          right: '12px',
          transform: 'translateY(-50%)',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#E8724A',
          flexShrink: 0,
        }} />
      )}

      {/* Icon bubble */}
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: `${color}18`,
        border: `0.5px solid ${color}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        flexShrink: 0,
        opacity: notif.read ? 0.6 : 1,
      }}>
        {notif.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: '0 0 2px',
          fontSize: '12px',
          fontWeight: notif.read ? 500 : 700,
          color: notif.read ? 'var(--c-text-2)' : 'var(--c-text)',
          lineHeight: 1.4,
        }}>
          {notif.title}
        </p>
        <p style={{
          margin: '0 0 4px',
          fontSize: '11px',
          color: 'var(--c-text-2)',
          lineHeight: 1.5,
          opacity: notif.read ? 0.7 : 1,
        }}>
          {notif.body}
        </p>
        <span style={{
          fontSize: '10px',
          color: color,
          opacity: notif.read ? 0.5 : 0.85,
          fontWeight: 600,
        }}>
          {relativeTime(notif.ts)}
        </span>
      </div>
    </div>
  );
}

// ── Bell icon with unread badge — exported for use in Sidebar ─────────────────
export function NotificationsBell({ trades, onClick, isOpen }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const notes = generateNotifications(trades);
    const rs = loadReadSet();
    setUnread(notes.filter(n => !rs.has(n.id)).length);
  }, [trades]);

  return (
    <button
      onClick={onClick}
      title="Notifications"
      style={{
        position: 'relative',
        background: isOpen ? 'rgba(232,114,74,0.12)' : 'none',
        border: isOpen ? '1px solid rgba(232,114,74,0.3)' : '1px solid transparent',
        borderRadius: '8px',
        cursor: 'pointer',
        padding: '5px 7px',
        fontSize: '15px',
        color: isOpen ? '#E8724A' : 'var(--c-text-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        lineHeight: 1,
      }}
    >
      🔔
      {unread > 0 && (
        <span style={{
          position: 'absolute',
          top: '-3px',
          right: '-3px',
          minWidth: '15px',
          height: '15px',
          borderRadius: '100px',
          background: '#E8724A',
          color: '#fff',
          fontSize: '9px',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 3px',
          boxShadow: '0 0 0 2px var(--c-surface)',
          lineHeight: 1,
        }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
