// Side-table that records whether each trade was logged on a checklist-passed
// day. Keyed by trade ID. Lives in localStorage so we don't need a Supabase
// schema migration for the discipline tracking feature.
//
// Trade IDs not present in this table → checklistPassed is undefined (treated
// as "untagged" — imported trades, historic trades from before the feature).
//
// Eventually this can be migrated to a `trades.checklist_passed` column or a
// separate `trade_tags` table; the API here is the same shape either way.

const STORAGE_KEY = 'te_checklist_tags';

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

/** Set the tag for a trade. `passed` should be true | false | null (delete). */
export function setChecklistTag(tradeId, passed) {
  if (!tradeId) return;
  const map = loadAll();
  if (passed === true || passed === false) {
    map[tradeId] = passed;
  } else {
    delete map[tradeId];
  }
  saveAll(map);
}

/** Get the tag for a trade, or undefined if untagged. */
export function getChecklistTag(tradeId) {
  const map = loadAll();
  return tradeId in map ? map[tradeId] : undefined;
}

/** Return a new array of trades with `checklistPassed` merged from local tags. */
export function mergeChecklistTags(trades) {
  const map = loadAll();
  if (!trades || !trades.length) return trades;
  return trades.map(t => {
    if (t.checklistPassed === true || t.checklistPassed === false) return t;
    if (t.id in map) return { ...t, checklistPassed: map[t.id] };
    return t;
  });
}

/** Drop tags for trade IDs that no longer exist (housekeeping). */
export function pruneChecklistTags(existingIds) {
  const set = new Set(existingIds || []);
  const map = loadAll();
  let changed = false;
  for (const id of Object.keys(map)) {
    if (!set.has(id)) { delete map[id]; changed = true; }
  }
  if (changed) saveAll(map);
}
