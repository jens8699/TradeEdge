// ── Tradovate API Client ─────────────────────────────────────────────────────
// All requests go through /api/tradovate/* Cloudflare Pages Functions
// to avoid CORS restrictions. The proxy forwards to live/demo Tradovate APIs.

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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { Authorization: `Bearer ${accessToken}` },
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
    headers: { Authorization: `Bearer ${accessToken}` },
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

    return {
      symbol,
      direction,
      pnl: parseFloat((e.netPnl || 0).toFixed(2)),
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
