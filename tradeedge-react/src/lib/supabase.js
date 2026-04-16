import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://ppjrfpuqfofgggtgmipd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwanJmcHVxZm9mZ2dndGdtaXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDg2MTIsImV4cCI6MjA5MTgyNDYxMn0.f4sRfK2-rrKbfsl-51wluoJb9gpm95MeEng1kjpg3TA';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

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
  };
}

export function dbToTrade(r) {
  return {
    id: r.id, date: r.date, symbol: r.symbol, direction: r.direction,
    accounts: r.accounts, riskPer: r.risk_per, rewardPer: r.reward_per,
    risk: r.risk, reward: r.reward, outcome: r.outcome, pnl: r.pnl,
    notes: r.notes || '', setup: r.setup || '', image: r.image || null,
    createdAt: r.created_at,
  };
}

export function payoutToDb(p, userId) {
  return { id: p.id, user_id: userId, date: p.date, firm: p.firm, amount: p.amount, notes: p.notes || '', created_at: p.createdAt };
}

export function dbToPayout(r) {
  return { id: r.id, date: r.date, firm: r.firm, amount: r.amount, notes: r.notes || '', createdAt: r.created_at };
}

// ── Signed URLs for screenshots ──────────────────────────────────────────────

export async function fetchSignedUrls(tradeList) {
  const paths = tradeList
    .filter(t => t.image && !t.image.startsWith('data:'))
    .map(t => t.image);
  if (!paths.length) return;
  const { data } = await sb.storage.from('trade-screenshots').createSignedUrls(paths, 3600);
  if (!data) return;
  const urlMap = {};
  data.forEach(item => { if (item.signedUrl) urlMap[item.path] = item.signedUrl; });
  tradeList.forEach(t => { if (t.image && urlMap[t.image]) t.imageUrl = urlMap[t.image]; });
}
