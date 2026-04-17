// ── Tradovate API Client ─────────────────────────────────────────────────────
// Docs: https://api.tradovate.com/
// Supports live + demo environments.
// Auth uses username + password → short-lived access token (24h).

const ENDPOINTS = {
  live: 'https://live.tradovateapi.com/v1',
  demo: 'https://demo.tradovateapi.com/v1',
};

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function tradovateAuth({ username, password, isDemo = false }) {
  const base = isDemo ? ENDPOINTS.demo : ENDPOINTS.live;
  const res = await fetch(`${base}/auth/accesstokenrequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: username,
      password,
      appId: 'TradeEdge',
      appVersion: '1.0.0',
      cid: 0,
      sec: '',
    }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (data['p-ticket']) throw new Error('MFA required — not yet supported in TradeEdge.');
  if (!data.accessToken) throw new Error(data.errorText || 'Auth failed — check credentials.');
  return {
    accessToken: data.accessToken,
    expirationTime: data.expirationTime,
    userId: data.userId,
    mdAccessToken: data.mdAccessToken,
    userStatus: data.userStatus,
  };
}

// ── Generic request ───────────────────────────────────────────────────────────

async function tget(base, path, token) {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Tradovate API error: ${res.status} ${path}`);
  return res.json();
}

// ── Account list ──────────────────────────────────────────────────────────────

export async function tradovateGetAccounts({ accessToken, isDemo = false }) {
  const base = isDemo ? ENDPOINTS.demo : ENDPOINTS.live;
  const accounts = await tget(base, '/account/list', accessToken);
  return accounts.map(a => ({
    id: a.id,
    name: a.name,
    nickname: a.nickname || a.name,
    balance: a.cashBalance || 0,
    active: a.active,
  }));
}

// ── Contract lookup ───────────────────────────────────────────────────────────

let contractCache = {};

async function getContract(base, token, contractId) {
  if (contractCache[contractId]) return contractCache[contractId];
  try {
    const data = await tget(base, `/contract/item?id=${contractId}`, token);
    contractCache[contractId] = data;
    return data;
  } catch {
    return { name: `Contract-${contractId}`, fullName: '' };
  }
}

// ── Execution reports → trades ────────────────────────────────────────────────

export async function tradovateSyncTrades({
  accessToken,
  isDemo = false,
  accountId,       // Tradovate account ID (number)
  since,           // ISO date string — only pull trades after this date
}) {
  const base = isDemo ? ENDPOINTS.demo : ENDPOINTS.live;

  // Pull all execution reports for this account
  const execs = await tget(
    base,
    `/executionReport/list`,
    accessToken
  );

  // Filter: only this account, only fills that have a P&L (closing fills), only new
  const sinceMs = since ? new Date(since).getTime() : 0;

  const closingFills = execs.filter(e =>
    e.accountId === accountId &&
    (e.action === 'Sell' || e.action === 'Buy') &&
    e.netPnl != null &&
    e.netPnl !== 0 &&
    new Date(e.timestamp).getTime() > sinceMs
  );

  if (!closingFills.length) return [];

  // Resolve contract names (batch — unique contractIds only)
  const uniqueContractIds = [...new Set(closingFills.map(e => e.contractId))];
  const contractMap = {};
  await Promise.all(
    uniqueContractIds.map(async cid => {
      contractMap[cid] = await getContract(base, accessToken, cid);
    })
  );

  // Map to TradeEdge trade format
  return closingFills.map(e => {
    const contract = contractMap[e.contractId] || {};
    const symbol = contract.name || `${e.contractId}`;
    const date = e.timestamp
      ? e.timestamp.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // For a closing Sell: the position was Long (we bought first, now selling)
    // For a closing Buy: the position was Short (we sold first, now buying)
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
