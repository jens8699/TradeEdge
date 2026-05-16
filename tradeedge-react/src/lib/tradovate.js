// ── Tradovate API Client ─────────────────────────────────────────────────────
// All requests go through /api/tradovate/* Cloudflare Pages Functions
// to avoid CORS restrictions. The proxy forwards to live/demo Tradovate APIs.
//
// The proxy is auth-gated by Supabase token in the X-Supabase-Auth header
// (the Authorization header is reserved for the Tradovate token that gets
// passed straight through to Tradovate). Without this gate the proxy was an
// open relay anyone could use to flood Tradovate from our domain.

import { sb } from './supabase';

// Read Supabase access token straight from localStorage. The SDK writes it
// here on sign-in and updates it on every refresh — so it's the most
// authoritative source we can read without going through an async API call
// that can stall mid-refresh.
function readTokenFromLocalStorage() {
  try {
    const keys = Object.keys(localStorage).filter(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.access_token) return parsed.access_token;
      // Some Supabase versions wrap the token in { currentSession: { access_token } }
      if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
    }
  } catch (e) {
    console.warn('[authHeaders] localStorage read failed:', e.message);
  }
  return '';
}

async function authHeaders() {
  console.log('[authHeaders] start');

  // Race sb.auth.getSession() against a 3-second timeout. The SDK can hang
  // indefinitely if a token-refresh promise gets stuck (seen live during
  // PR #11 prod-test). 3s is plenty for a healthy session — anything longer
  // means we should fall back rather than make the user wait.
  let token = '';
  try {
    const sessionPromise = sb.auth.getSession();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('getSession timed out after 3s')), 3000)
    );
    const result = await Promise.race([sessionPromise, timeoutPromise]);
    token = result?.data?.session?.access_token || '';
    if (token) {
      console.log('[authHeaders] got token via sb.auth.getSession()');
    }
  } catch (e) {
    console.warn('[authHeaders] getSession failed, trying localStorage fallback:', e.message);
  }

  // Fallback: read from localStorage directly. This is also what we use
  // when the SDK call timed out above.
  if (!token) {
    token = readTokenFromLocalStorage();
    if (token) {
      console.log('[authHeaders] got token via localStorage fallback');
    }
  }

  if (!token) {
    console.error('[authHeaders] no token from any source — user is signed out or storage is corrupt');
    throw new Error('You need to be signed in to use broker connections. Try signing out and back in.');
  }
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

// Internal: fetch with a hard 15-second timeout so the connect UI never hangs
// forever on a stalled network / dropped TCP / browser extension blocking the
// request. AbortController is the only way to actually cancel an inflight
// fetch — without it, the promise stays pending until the browser gives up
// (which can be 60+ seconds).
async function fetchWithTimeout(url, opts, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

// Step 1: initial auth — may return { mfaRequired: true, pTicket } if MFA enabled.
// Heavily instrumented with console.log because the connect modal historically
// stalled on "Connecting…" with no signal to the user — we want every step
// visible in DevTools console so support / debug is one paste away.
export async function tradovateAuth({ username, password, isDemo = false }) {
  console.log('[tradovateAuth] start', { username, isDemo });

  let headers;
  try {
    headers = await authHeaders();
    console.log('[tradovateAuth] supabase auth header obtained');
  } catch (e) {
    console.error('[tradovateAuth] authHeaders failed', e);
    throw new Error(`Sign-in required: ${e.message}`);
  }

  let res;
  try {
    res = await fetchWithTimeout('/api/tradovate/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ ...AUTH_BODY_BASE(username, password), isDemo }),
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      console.error('[tradovateAuth] request timed out after 15s');
      throw new Error('Tradovate auth timed out after 15s. Check your network or try again.');
    }
    console.error('[tradovateAuth] fetch threw', e);
    throw new Error(`Network error reaching Tradovate proxy: ${e.message}`);
  }

  console.log('[tradovateAuth] response', res.status);

  let data;
  try {
    data = await res.json();
  } catch (e) {
    const text = await res.text().catch(() => '(unreadable)');
    console.error('[tradovateAuth] non-JSON response', text);
    throw new Error(`Tradovate proxy returned non-JSON (HTTP ${res.status}). Body: ${text.slice(0, 200)}`);
  }

  console.log('[tradovateAuth] data', {
    hasAccessToken: !!data.accessToken,
    hasMfa: !!data['p-ticket'],
    errorText: data.errorText,
  });

  if (!res.ok && !data['p-ticket']) {
    // Don't drop the upstream errorText — that's how the user sees "incorrect
    // username or password" instead of "Auth failed: 401".
    throw new Error(data.errorText || `Auth failed (HTTP ${res.status})`);
  }
  return parseAuthResponse(data, isDemo);
}

// Step 2: complete auth after MFA — send the 6-digit code
export async function tradovateAuthMFA({ username, password, isDemo = false, pTicket, pTime, pCaptcha, mfaCode }) {
  console.log('[tradovateAuthMFA] start', { username, isDemo });

  let headers;
  try {
    headers = await authHeaders();
  } catch (e) {
    throw new Error(`Sign-in required: ${e.message}`);
  }

  let res;
  try {
    res = await fetchWithTimeout('/api/tradovate/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        ...AUTH_BODY_BASE(username, password),
        isDemo,
        'p-ticket': pTicket,
        'p-time': pTime,
        'p-captcha': pCaptcha,
        'p-response': mfaCode.trim(),
      }),
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('MFA auth timed out after 15s.');
    }
    throw new Error(`Network error: ${e.message}`);
  }

  const data = await res.json().catch(() => ({}));
  console.log('[tradovateAuthMFA] response', res.status, { errorText: data.errorText });

  if (!res.ok && !data['p-ticket']) {
    throw new Error(data.errorText || `MFA auth failed (HTTP ${res.status})`);
  }
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
