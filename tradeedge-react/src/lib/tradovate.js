// ── Tradovate API Client ─────────────────────────────────────────────────────
// All requests go through /api/tradovate/* Cloudflare Pages Functions
// to avoid CORS restrictions. The proxy forwards to live/demo Tradovate APIs.
//
// The proxy is auth-gated by Supabase token in the X-Supabase-Auth header
// (the Authorization header is reserved for the Tradovate token that gets
// passed straight through to Tradovate). Without this gate the proxy was an
// open relay anyone could use to flood Tradovate from our domain.

import { sb } from './supabase';

async function authHeaders() {
  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token || '';
  if (!token) throw new Error('You need to be signed in to use broker connections.');
  return { 'X-Supabase-Auth': token };
}

// ── Auth ─────────────────────────────────────────────────────────────────────

const AUTH_BODY_BASE = (username, password) => ({
  name: username,
  password,
  appId: 'TradeEdge',
  appVersion: '1.0.0',
  cid: 0,
  sec: '',
});

function parseAuthResponse(data, isDemo) {
  // MFA required — return ticket info so UI can prompt for code
  if (data['p-ticket']) {
    return {
      mfaRequired: true,
      pTicket: data['p-ticket'],
      pTime: data['p-time'] ?? 60,
      pCaptcha: data['p-captcha'] ?? false,
    };
  }
  if (!data.accessToken) {
    throw new Error(data.errorText || 'Auth failed — check your credentials.');
  }
  return {
    mfaRequired: false,
    accessToken: data.accessToken,
    expirationTime: data.expirationTime,
    userId: data.userId,
    mdAccessToken: data.mdAccessToken,
    userStatus: data.userStatus,
    isDemo,
  };
}

// Step 1: initial auth — may return { mfaRequired: true, pTicket } if MFA enabled
export async function tradovateAuth({ username, password, isDemo = false }) {
  const res = await fetch('/api/tradovate/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ ...AUTH_BODY_BASE(username, password), isDemo }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  return parseAuthResponse(data, isDemo);
}

// Step 2: complete auth after MFA — send the 6-digit code
export async function tradovateAuthMFA({ username, password, isDemo = false, pTicket, pTime, pCaptcha, mfaCode }) {
  const res = await fetch('/api/tradovate/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({
      ...AUTH_BODY_BASE(username, password),
      isDemo,
      'p-ticket': pTicket,
      'p-time': pTime,
      'p-captcha': pCaptcha,
      'p-response': mfaCode.trim(),
    }),
  });
  if (!res.ok) throw new Error(`MFA auth failed: ${res.status}`);
  const data = await res.json();
  return parseAuthResponse(data, isDemo);
}

// ── Account list ──────────────────────────────────────────────────────────────

export async function tradovateGetAccounts({ accessToken, isDemo = false }) {
  const res = await fetch(`/api/tradovate/accounts?isDemo=${isDemo}`, {
    headers: { Authorization: `Bearer ${accessToken}`, ...(await authHeaders()) },
  });
  if (!res.ok) throw new Error(`Failed to load accounts: ${res.status}`);
  const accounts = await res.json();
  if (!Array.isArray(accounts)) throw new Error(accounts?.errorText || 'Unexpected response from Tradovate');
  return accounts.map(a => ({
    id: a.id,
    name: a.name,
    nickname: a.nickname || a.name,
    balance: a.cashBalance ?? 0,
    active: a.active,
  }));
}

// ── Contract lookup cache ─────────────────────────────────────────────────────

let contractCache = {};

async function getContract(accessToken, isDemo, contractId) {
  if (contractCache[contractId]) return contractCache[contractId];
  try {
    // Direct contract lookup still needs proxying — use executions proxy base
    // Fallback: just return the contract ID as name if lookup fails
    contractCache[contractId] = { name: `${contractId}` };
    return contractCache[contractId];
  } catch {
    return { name: `${contractId}` };
  }
}

// ── Execution reports → trades ────────────────────────────────────────────────

export async function tradovateSyncTrades({
  accessToken,
  isDemo = false,
  accountId,   // Tradovate account ID (number)
  since,       // ISO date string — only pull trades after this date
}) {
  const res = await fetch(`/api/tradovate/executions?isDemo=${isDemo}`, {
    headers: { Authorization: `Bearer ${accessToken}`, ...(await authHeaders()) },
  });
  if (!res.ok) throw new Error(`Failed to fetch executions: ${res.status}`);
  const execs = await res.json();
  if (!Array.isArray(execs)) throw new Error(execs?.errorText || 'Unexpected response from Tradovate');

  const sinceMs = since ? new Date(since).getTime() : 0;

  const closingFills = execs.filter(e =>
    e.accountId === accountId &&
    (e.action === 'Sell' || e.action === 'Buy') &&
    e.netPnl != null &&
    e.netPnl !== 0 &&
    new Date(e.timestamp).getTime() > sinceMs
  );

  if (!closingFills.length) return [];

  return closingFills.map(e => {
    const symbol = e.contractId ? String(e.contractId) : 'UNKNOWN';
    const date = e.timestamp
      ? e.timestamp.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // Closing Sell = was Long; closing Buy = was Short
    const direction = e.action === 'Sell' ? 'Long' : 'Short';

    const pnl = parseFloat((e.netPnl || 0).toFixed(2));
    return {
      symbol,
      direction,
      pnl,
      // Derive outcome from P&L sign — user can override in EditModal.
      outcome: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven',
      date,
      entry: e.openingPrice ?? null,
      exit: e.price ?? null,
      qty: e.qty ?? 1,
      notes: `Auto-imported from Tradovate | ${isDemo ? 'Demo' : 'Live'}`,
      source: 'tradovate',
      external_id: String(e.id),
    };
  });
}

// ── Reusable sync-to-DB helper ────────────────────────────────────────────────
// Wraps tradovateSyncTrades + Supabase upsert + last_sync_at update into one
// call. Used by BOTH the manual "Sync trades" button in Connections.jsx and
// the auto-poll loop in AppContext.
//
// Dedup is handled by Supabase upsert with onConflict: 'user_id,external_id'
// so re-running this safely re-pulls the executions list without inserting
// duplicates. We update last_sync_at on every call (even when zero new
// trades) so subsequent polls only ask Tradovate for trades after the last
// check window.
//
// Returns { newCount, error? }. The caller decides whether to toast / refresh
// the UI / mark the connection as expired (on 401).
export async function syncTradovateAccountToDb({ connection, userId, sb }) {
  if (!connection || !userId || !sb) {
    return { newCount: 0, error: 'Missing connection, userId, or sb client.' };
  }
  const auth = connection.credentials || {};
  if (!auth.accessToken) {
    return { newCount: 0, error: 'No access token on connection.' };
  }

  const accId  = parseInt(connection.account_id);
  const isDemo = !!connection.is_demo;
  const since  = connection.last_sync_at || null;

  try {
    const trades = await tradovateSyncTrades({
      accessToken: auth.accessToken,
      isDemo,
      accountId: accId,
      since,
    });

    const now = new Date().toISOString();

    if (!trades.length) {
      // No new trades — still bump last_sync_at so the next poll narrows
      // its query window.
      await sb.from('connected_accounts').update({ last_sync_at: now })
        .eq('user_id', userId)
        .eq('platform', 'tradovate')
        .eq('account_id', String(accId));
      return { newCount: 0 };
    }

    // Upsert with dedup. ignoreDuplicates: true means external_id collisions
    // (already-imported trades) silently skip without throwing.
    const toInsert = trades.map(t => ({ ...t, user_id: userId }));
    const { error: insertErr } = await sb.from('trades').upsert(toInsert, {
      onConflict: 'user_id,external_id',
      ignoreDuplicates: true,
    });
    if (insertErr) return { newCount: 0, error: insertErr.message };

    // Bump last_sync_at + trade_count counter.
    await sb.from('connected_accounts').update({
      last_sync_at: now,
      trade_count: (connection.trade_count || 0) + trades.length,
    })
      .eq('user_id', userId)
      .eq('platform', 'tradovate')
      .eq('account_id', String(accId));

    return { newCount: trades.length };
  } catch (e) {
    return { newCount: 0, error: e.message || 'Sync failed' };
  }
}
