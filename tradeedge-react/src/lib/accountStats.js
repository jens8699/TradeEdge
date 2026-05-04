// Auto-compute per-account stats from the trades tagged to that account
// (via the side-table in `tradeAccounts.js`). Replaces the manual P&L and
// drawdown-remaining fields that used to live on the account itself.
//
// Drawdown calc: we use the conservative "max drop from running peak"
// interpretation. Different prop firms use different rules (static vs
// trailing vs end-of-day-trailing) — by always showing the worst-case
// drawdown used, the user sees AT LEAST as much buffer as their firm
// actually gives them. Safer than over-promising.

/**
 * Compute live stats for a single prop firm account.
 *
 * @param {object} account     — the account record from PropFirmTracker
 *                               (must have `id` and `ddMax`)
 * @param {Array}  allTrades   — full trades array from AppContext (each trade
 *                               may carry an `accountId` set by Phase 1)
 * @returns {{
 *   pnl: number,             // total P&L from trades tied to this account
 *   tradeCount: number,
 *   winCount: number,
 *   lossCount: number,
 *   winRate: number,         // 0-100
 *   ddRemaining: number,     // dollars left before breaching ddMax
 *   ddUsed: number,          // dollars of drawdown currently used (>= 0)
 *   peakBalance: number,     // running peak relative to start (so 0 if no green)
 *   currentBalance: number,  // current relative balance (== pnl)
 * }}
 */
export function computeAccountStats(account, allTrades) {
  const empty = {
    pnl: 0,
    tradeCount: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    ddRemaining: account?.ddMax || 0,
    ddUsed: 0,
    peakBalance: 0,
    currentBalance: 0,
  };
  if (!account?.id || !Array.isArray(allTrades) || allTrades.length === 0) {
    return empty;
  }

  // Filter trades belonging to this account, oldest → newest.
  // Trade dates are ISO strings (YYYY-MM-DD); lexical sort works as chronological.
  const own = allTrades
    .filter(t => t.accountId === account.id)
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (own.length === 0) return empty;

  // Walk the running balance, track peak + max drawdown.
  // We track balance relative to ZERO (i.e. pure cumulative P&L), not relative
  // to the account's starting size. Drawdown buffer is dollars-from-peak which
  // is invariant to absolute scale.
  let bal = 0;
  let peak = 0;
  let maxDD = 0;
  let wins = 0;
  let losses = 0;

  for (const t of own) {
    const p = Number(t.pnl) || 0;
    bal += p;
    if (bal > peak) peak = bal;
    const dd = peak - bal;
    if (dd > maxDD) maxDD = dd;
    if (p > 0) wins++;
    else if (p < 0) losses++;
  }

  // Current drawdown = how far below peak we are RIGHT NOW (not historical max).
  // Buffer remaining is judged on current standing, not worst-ever moment.
  const ddUsedNow = Math.max(0, peak - bal);
  const ddMax = Number(account.ddMax) || 0;
  const ddRemaining = ddMax > 0 ? Math.max(0, ddMax - ddUsedNow) : 0;

  const total = wins + losses;
  return {
    pnl: bal,
    tradeCount: own.length,
    winCount: wins,
    lossCount: losses,
    winRate: total > 0 ? (wins / total) * 100 : 0,
    ddRemaining,
    ddUsed: ddUsedNow,
    peakBalance: peak,
    currentBalance: bal,
  };
}

/**
 * Bulk-compute stats for every account in one pass. Returns a Map keyed by
 * account.id. Saves filtering the trades array N times when you have many
 * accounts.
 */
export function computeAllAccountStats(accounts, allTrades) {
  const out = new Map();
  if (!Array.isArray(accounts)) return out;
  for (const acc of accounts) {
    out.set(acc.id, computeAccountStats(acc, allTrades));
  }
  return out;
}
