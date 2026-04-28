// Side-table for AI critiques generated against individual trades.
// Same pattern as checklistTags.js — localStorage so we don't need a
// Supabase schema migration. Eventually move to a `trade_critiques` column
// or table; the API surface here would stay identical.
//
// Shape per entry: { text: string, generatedAt: ISO timestamp string }

const STORAGE_KEY = 'te_trade_critiques';

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

/** Save (or replace) a critique for a trade. Pass null/undefined text to clear. */
export function setCritique(tradeId, text) {
  if (!tradeId) return;
  const map = loadAll();
  if (text && typeof text === 'string') {
    map[tradeId] = { text, generatedAt: new Date().toISOString() };
  } else {
    delete map[tradeId];
  }
  saveAll(map);
}

/** Get the critique entry for a trade, or null. */
export function getCritique(tradeId) {
  const map = loadAll();
  return map[tradeId] || null;
}

/** Drop a critique. */
export function clearCritique(tradeId) {
  setCritique(tradeId, null);
}

/** Merge stored critiques onto a list of trade objects. */
export function mergeCritiques(trades) {
  const map = loadAll();
  if (!trades || !trades.length) return trades;
  return trades.map(t => {
    if (t.aiCritique) return t;
    const c = map[t.id];
    if (!c) return t;
    return { ...t, aiCritique: c.text, aiCritiqueAt: c.generatedAt };
  });
}

/** Drop critiques for trade IDs that no longer exist (housekeeping). */
export function pruneCritiques(existingIds) {
  const set = new Set(existingIds || []);
  const map = loadAll();
  let changed = false;
  for (const id of Object.keys(map)) {
    if (!set.has(id)) { delete map[id]; changed = true; }
  }
  if (changed) saveAll(map);
}
