import { useEffect, useState, useRef, useCallback } from 'react';

// ── Shortcut catalog ─────────────────────────────────────────────────────────
// Two-key vim-style sequences ("g d" → dashboard) plus a few single-key
// power moves. Imported by useKeyboardShortcuts and rendered by the cheat
// sheet so the source of truth is one place.
export const SHORTCUTS = [
  { group: 'Go to', items: [
    { keys: ['g', 'd'], label: 'Dashboard',         tab: 'dashboard'   },
    { keys: ['g', 'l'], label: 'Log a trade',       tab: 'entry'       },
    { keys: ['g', 'x'], label: 'Pre-trade checklist', tab: 'checklist' },
    { keys: ['g', 'h'], label: 'History',           tab: 'history'     },
    { keys: ['g', 's'], label: 'Stats',             tab: 'stats'       },
    { keys: ['g', 'c'], label: 'Calendar',          tab: 'calendar'    },
    { keys: ['g', 'p'], label: 'Prop Firms',        tab: 'tracker'     },
    { keys: ['g', 'w'], label: 'Weekly digest',     tab: 'digest'      },
    { keys: ['g', 'i'], label: 'AI Insights',       tab: 'insights'    },
    { keys: ['g', 'm'], label: 'Market brief',      tab: 'brief'       },
    { keys: ['g', 'n'], label: 'Connections',       tab: 'connections' },
    { keys: ['g', 'o'], label: 'Social',            tab: 'social'      },
    { keys: ['g', ','], label: 'Settings',          tab: 'settings'    },
  ]},
  { group: 'Actions', items: [
    { keys: ['n'], label: 'New trade',  tab: 'entry'  },
    { keys: ['?'], label: 'Show this cheat sheet', special: 'help' },
    { keys: ['Esc'], label: 'Close any open modal', special: 'esc' },
  ]},
];

// Flatten the catalog into a quick lookup table keyed by the joined sequence.
function buildLookup() {
  const map = new Map();
  for (const group of SHORTCUTS) {
    for (const item of group.items) {
      const key = item.keys.join(' ').toLowerCase();
      map.set(key, item);
    }
  }
  return map;
}

// ── The hook ─────────────────────────────────────────────────────────────────
//
// onAction({ tab, special }) is called when a shortcut matches. The caller
// is responsible for actually doing the navigation / opening the help / etc.
// The hook itself is purely about input → action translation.
//
// Returns { showHelp, setShowHelp } so the caller can render the cheat sheet.
export function useKeyboardShortcuts({ onAction } = {}) {
  const [showHelp, setShowHelp] = useState(false);
  const pendingPrefixRef = useRef(null); // last "g" key + its timestamp
  const lookup = useRef(buildLookup()).current;

  const handleAction = useCallback((item) => {
    if (item.special === 'help') {
      setShowHelp(true);
      return;
    }
    if (onAction) onAction(item);
  }, [onAction]);

  useEffect(() => {
    function isTypingTarget(el) {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    function onKeyDown(e) {
      // Don't interfere with system shortcuts
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Don't interfere with text input
      if (isTypingTarget(e.target)) {
        // But still let Escape close the help overlay even when typing
        if (e.key === 'Escape' && showHelp) {
          setShowHelp(false);
          e.preventDefault();
        }
        return;
      }

      const k = e.key;

      // Single-key catches first
      if (k === '?') {
        e.preventDefault();
        setShowHelp(s => !s);
        pendingPrefixRef.current = null;
        return;
      }
      if (k === 'Escape') {
        if (showHelp) {
          e.preventDefault();
          setShowHelp(false);
        }
        pendingPrefixRef.current = null;
        return;
      }
      if (k === 'n' || k === 'N') {
        const item = lookup.get('n');
        if (item) {
          e.preventDefault();
          handleAction(item);
          pendingPrefixRef.current = null;
          return;
        }
      }

      // Two-key sequence: "g <letter>"
      const lower = k.toLowerCase();
      const now = Date.now();
      const pending = pendingPrefixRef.current;
      // If we have a fresh prefix, try to match
      if (pending && pending.key === 'g' && (now - pending.at) < 1500) {
        const seq = `g ${lower}`;
        const item = lookup.get(seq);
        pendingPrefixRef.current = null;
        if (item) {
          e.preventDefault();
          handleAction(item);
        }
        return;
      }
      // Start a new prefix on plain "g"
      if (lower === 'g') {
        pendingPrefixRef.current = { key: 'g', at: now };
        return;
      }
      // Anything else clears any stale prefix
      pendingPrefixRef.current = null;
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAction, showHelp, lookup]);

  return { showHelp, setShowHelp };
}
