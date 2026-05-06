// Pure helpers for the trade ↔ prop-firm-account relationship.
// All persistence now lives in Supabase, owned by AppContext (which loads
// `accountTags` once and exposes CRUD via the context value).
//
// localStorage previously held two keys:
//   - `te_prop_firm_accounts` — the user's roster of accounts
//   - `te_trade_accounts`     — the {tradeId: accountId} side-table
// Both are now migrated to Supabase tables (`prop_firm_accounts`,
// `trade_account_tags`). This file's job is only:
//   1. The pure merge function consumers use to attach `accountId` to trades
//   2. The display formatter for picker dropdowns
//   3. The one-time localStorage → Supabase migration on first load post-deploy

import { sb } from './supabase';

const LEGACY_TAG_KEY     = 'te_trade_accounts';
const LEGACY_ACCOUNT_KEY = 'te_prop_firm_accounts';

/**
 * Merge `accountId` onto each trade from a tag map. Pure — no I/O.
 * `tagMap` is { tradeId: accountId } as held by AppContext.
 */
export function mergeTradeAccounts(trades, tagMap) {
  if (!trades || !trades.length) return trades;
  if (!tagMap) return trades;
  return trades.map(t => {
    if (t.accountId) return t;
    if (t.id in tagMap) return { ...t, accountId: tagMap[t.id] };
    return t;
  });
}

/**
 * Display label for a picker option:
 * "TopStep · gggg · $50k"  (with name)
 * "TopStep · $50k"          (no name)
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

/**
 * Map a Supabase row to the in-app PropFirmAccount shape used by the UI.
 * Inverse of `accountToDb`. Keeps the existing camelCase keys so PropFirmTracker
 * and consumers don't have to change anything.
 */
export function dbToAccount(r) {
  return {
    id:          r.id,
    firm:        r.firm || '',
    name:        r.name || '',
    accountSize: Number(r.account_size) || 0,
    status:      r.status || 'eval',
    ddMax:       Number(r.dd_max) || 0,
    payoutPct:   Number(r.payout_pct) || 0,
    cost:        Number(r.cost) || 0,
    notes:       r.notes || '',
    createdAt:   r.created_at,
    updatedAt:   r.updated_at,
  };
}

export function accountToDb(acc, userId) {
  return {
    id:           acc.id,
    user_id:      userId,
    firm:         acc.firm || '',
    name:         acc.name || null,
    account_size: Number(acc.accountSize) || 0,
    status:       acc.status || 'eval',
    dd_max:       Number(acc.ddMax) || 0,
    payout_pct:   Number(acc.payoutPct) || 0,
    cost:         Number(acc.cost) || 0,
    notes:        acc.notes || null,
    updated_at:   new Date().toISOString(),
  };
}

/**
 * One-time localStorage → Supabase migration. Idempotent: if Supabase already
 * has rows for this user OR localStorage is empty, this no-ops. After a
 * successful upload, the legacy localStorage keys are cleared.
 *
 * Returns { migratedAccounts: number, migratedTags: number }.
 */
export async function migrateLocalStorageToSupabase(userId) {
  let migratedAccounts = 0;
  let migratedTags = 0;
  if (!userId) return { migratedAccounts, migratedTags };

  // ── Accounts ──
  try {
    const raw = localStorage.getItem(LEGACY_ACCOUNT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Only migrate if Supabase has no accounts yet for this user.
        const { count } = await sb
          .from('prop_firm_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);
        if ((count || 0) === 0) {
          const rows = parsed.map(a => accountToDb(a, userId));
          const { error } = await sb.from('prop_firm_accounts').insert(rows);
          if (!error) {
            migratedAccounts = rows.length;
            localStorage.removeItem(LEGACY_ACCOUNT_KEY);
          }
        } else {
          // Supabase already has rows — assume already migrated, drop legacy.
          localStorage.removeItem(LEGACY_ACCOUNT_KEY);
        }
      }
    }
  } catch (e) {
    console.warn('Account migration failed:', e);
  }

  // ── Trade↔Account tags ──
  try {
    const raw = localStorage.getItem(LEGACY_TAG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        const { count } = await sb
          .from('trade_account_tags')
          .select('trade_id', { count: 'exact', head: true })
          .eq('user_id', userId);
        if ((count || 0) === 0) {
          const rows = Object.entries(parsed)
            .filter(([_, accountId]) => Boolean(accountId))
            .map(([tradeId, accountId]) => ({
              trade_id:   tradeId,
              user_id:    userId,
              account_id: accountId,
            }));
          if (rows.length > 0) {
            const { error } = await sb.from('trade_account_tags').insert(rows);
            if (!error) {
              migratedTags = rows.length;
              localStorage.removeItem(LEGACY_TAG_KEY);
            }
          } else {
            localStorage.removeItem(LEGACY_TAG_KEY);
          }
        } else {
          localStorage.removeItem(LEGACY_TAG_KEY);
        }
      }
    }
  } catch (e) {
    console.warn('Tag migration failed:', e);
  }

  return { migratedAccounts, migratedTags };
}
