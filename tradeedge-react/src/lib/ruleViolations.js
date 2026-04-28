// Side-table for per-trade rule violations captured at log-time.
// Keyed by trade ID. Each value is an array of violations:
//   [{ ruleId, type, message }]
//
// Stamped at-save (TradeEntry) so it captures the *point-in-time* context.
// Read by Stats to compute adherence over a period.
//
// Same pattern as checklistTags.js + tradeCritiques.js.

const STORAGE_KEY = 'te_trade_rule_violations';

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch {}
}

/** Persist the violations array for a trade. Pass [] or null to clear. */
export function setViolations(tradeId, violations) {
  if (!tradeId) return;
  const map = loadAll();
  if (Array.isArray(violations) && violations.length > 0) {
    // Strip any non-essential fields; keep the data tight
    map[tradeId] = violations.map(v => ({
      ruleId:  v.ruleId,
      type:    v.type,
      message: v.message,
    }));
  } else {
    delete map[tradeId];
  }
  saveAll(map);
}

export function getViolations(tradeId) {
  const map = loadAll();
  return map[tradeId] || null;
}

export function clearViolations(tradeId) {
  setViolations(tradeId, null);
}

/** Merge stored violations onto trade objects as `ruleViolations: [...]`. */
export function mergeViolations(trades) {
  const map = loadAll();
  if (!trades || !trades.length) return trades;
  return trades.map(t => {
    if (Array.isArray(t.ruleViolations)) return t;
    const v = map[t.id];
    if (!v) return t;
    return { ...t, ruleViolations: v };
  });
}

/** Drop violations for trade IDs that no longer exist. */
export function pruneViolations(existingIds) {
  const set = new Set(existingIds || []);
  const map = loadAll();
  let changed = false;
  for (const id of Object.keys(map)) {
    if (!set.has(id)) { delete map[id]; changed = true; }
  }
  if (changed) saveAll(map);
}
