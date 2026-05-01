// Side-table that records which prop firm account a trade was placed on.
// Keyed by trade ID → account ID (the `id` field on PropFirmTracker accounts).
// Lives in localStorage so we don't need a Supabase schema migration for the
// trade-to-account tie. Same pattern as checklistTags / tradeCritiques.
//
// Phase 2 (later): migrate to a `trades.account_id` column or a separate
// `trade_account_links` table. The API shape here stays the same.

const STORAGE_KEY = 'te_trade_accounts';
const ACCOUNTS_KEY = 'te_prop_firm_accounts'; // shared with PropFirmTracker

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

/** Set the account-id tag for a trade. Pass null/empty to clear. */
export function setTradeAccount(tradeId, accountId) {
  if (!tradeId) return;
  const map = loadAll();
  if (accountId) {
    map[tradeId] = accountId;
  } else {
    delete map[tradeId];
  }
  saveAll(map);
}

/** Get the account-id for a trade, or null if untagged. */
export function getTradeAccount(tradeId) {
  const map = loadAll();
  return map[tradeId] || null;
}

/** Returns a new array of trades with `accountId` merged from local tags. */
export function mergeTradeAccounts(trades) {
  const map = loadAll();
  if (!trades || !trades.length) return trades;
  return trades.map(t => {
    if (t.accountId) return t;
    if (t.id in map) return { ...t, accountId: map[t.id] };
    return t;
  });
}

/** Drop tags for trade IDs that no longer exist (housekeeping). */
export function pruneTradeAccounts(existingIds) {
  const set = new Set(existingIds || []);
  const map = loadAll();
  let changed = false;
  for (const id of Object.keys(map)) {
    if (!set.has(id)) { delete map[id]; changed = true; }
  }
  if (changed) saveAll(map);
}

/**
 * Load the user's prop firm accounts from localStorage. Returns [] if none
 * configured yet. Returned shape matches PropFirmTracker's account model:
 * { id, firm, name, accountSize, status, ... }
 */
export function loadAccountsForPicker() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Format an account for display in the dropdown:
 * "TopStep · gggg · $50k"  (if name set) or "TopStep · $50k" (no name)
 */
export function formatAccountLabel(acc) {
  if (!acc) return '';
  const sizeLabel = acc.accountSize >= 1000
    ? `$${(acc.accountSize / 1000).toFixed(0)}k`
    : `$${acc.accountSize}`;
  const parts = [acc.firm];
  if (acc.name) parts.push(acc.name);
  parts.push(sizeLabel);
  return parts.join(' · ');
}
