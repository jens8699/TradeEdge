import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://ppjrfpuqfofgggtgmipd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwanJmcHVxZm9mZ2dndGdtaXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDg2MTIsImV4cCI6MjA5MTgyNDYxMn0.f4sRfK2-rrKbfsl-51wluoJb9gpm95MeEng1kjpg3TA';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    lock: async (_name, _timeout, fn) => fn(),
  },
});

export async function getProfile(userId) {
  const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
  return data;
}

// ── Supabase ↔ local shape mappers ──────────────────────────────────────────

export function tradeToDb(t, userId) {
  return {
    id: t.id, user_id: userId,
    date: t.date, symbol: t.symbol, direction: t.direction,
    accounts: t.accounts, risk_per: t.riskPer, reward_per: t.rewardPer,
    risk: t.risk, reward: t.reward, outcome: t.outcome, pnl: t.pnl,
    notes: t.notes || '', setup: t.setup || '', image: t.image || null,
    created_at: t.createdAt,
    source:      t.source      || null,
    external_id: t.external_id || null,
    entry_price: t.entry       || null,
    exit_price:  t.exit        || null,
    qty:         t.qty         || null,
    session:     t.session     || null,
    rating:      t.rating      || null,
    emotion:     t.emotion     || null,
  };
}

export function dbToTrade(r) {
  return {
    id: r.id, date: r.date, symbol: r.symbol, direction: r.direction,
    accounts: r.accounts, riskPer: r.risk_per, rewardPer: r.reward_per,
    risk: r.risk, reward: r.reward, outcome: r.outcome, pnl: r.pnl,
    notes: r.notes || '', setup: r.setup || '', image: r.image || null,
    createdAt: r.created_at,
    source:      r.source      || null,
    external_id: r.external_id || null,
    entry:       r.entry_price || null,
    exit:        r.exit_price  || null,
    qty:         r.qty         || null,
    session:     r.session     || null,
    rating:      r.rating      || null,
    emotion:     r.emotion     || null,
  };
}

export function payoutToDb(p, userId) {
  return { id: p.id, user_id: userId, date: p.date, firm: p.firm, amount: p.amount, notes: p.notes || '', created_at: p.createdAt };
}

export function dbToPayout(r) {
  return { id: r.id, date: r.date, firm: r.firm, amount: r.amount, notes: r.notes || '', createdAt: r.created_at };
}

// ── Signed URLs for screenshots ──────────────────────────────────────────────
// Supabase signed URLs are time-bounded. We use 24h TTL (was 1h) so users
// who load the app once and come back hours later still see their images.
// Even with the longer TTL, a URL CAN expire if the user keeps the app open
// for a full day — fetchSignedUrlForPath() below provides a JIT refresh
// path that components can call from an <img onError> handler.

const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export async function fetchSignedUrls(tradeList) {
  const paths = tradeList
    .filter(t => t.image && !t.image.startsWith('data:'))
    .map(t => t.image);
  if (!paths.length) return;
  const { data } = await sb.storage.from('trade-screenshots').createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (!data) return;
  const urlMap = {};
  data.forEach(item => { if (item.signedUrl) urlMap[item.path] = item.signedUrl; });
  tradeList.forEach(t => { if (t.image && urlMap[t.image]) t.imageUrl = urlMap[t.image]; });
}

/**
 * Fetch a fresh signed URL for a single storage path. Used as a recovery
 * path when an <img> fails to load (URL expired, browser cached a stale
 * URL, etc.). Returns null on failure.
 */
export async function fetchSignedUrlForPath(path) {
  if (!path || path.startsWith('data:')) return null;
  try {
    const { data } = await sb.storage
      .from('trade-screenshots')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    return data?.signedUrl || null;
  } catch (e) {
    return null;
  }
}
