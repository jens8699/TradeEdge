// Futures contract specifications — dollar value per 1.00 point of price
// movement, per 1 contract. Used to auto-calculate P&L from entry + exit + qty
// so prop traders don't have to manually figure out their math when logging.
//
// Coverage: the contracts prop traders actually use day-to-day. If a trader
// uses a contract that's not here, P&L falls back to the manual / risk-reward
// path. Adding new symbols is a one-line change.
//
// Multipliers verified against CME contract specs as of 2026.
export const FUTURES_MULTIPLIERS = {
  // E-mini Nasdaq
  NQ:  20,
  MNQ: 2,
  // E-mini S&P 500
  ES:  50,
  MES: 5,
  // E-mini Dow Jones
  YM:  5,
  MYM: 0.5,
  // E-mini Russell 2000
  RTY: 50,
  M2K: 5,
  // Crude Oil (WTI)
  CL:  1000,
  MCL: 100,
  // Natural Gas
  NG:  10000,
  MNG: 2500,
  // Gold
  GC:  100,
  MGC: 10,
  // Silver
  SI:  5000,
  SIL: 1000,
  // Treasury futures (1.00 point = 1% face)
  ZB:  1000,
  ZN:  1000,
  ZF:  1000,
  ZT:  2000,
  // Currency majors
  '6E':  125000, // Euro FX
  '6B':  62500,  // British Pound
  '6J':  12500000, // Japanese Yen
  '6A':  100000, // Australian Dollar
  '6C':  100000, // Canadian Dollar
  '6S':  125000, // Swiss Franc
  // Currency micros
  M6E:  12500,
  M6B:  6250,
  M6A:  10000,
  // Bitcoin (CME)
  BTC: 5,
  MBT: 0.1,
  // Ethereum (CME)
  ETH: 50,
  MET: 0.1,
};

/**
 * Look up the dollar-per-point multiplier for a given symbol. Returns null if
 * the symbol isn't a known futures contract — caller should fall back to
 * manual / risk-reward P&L derivation.
 *
 * Symbol matching is case-insensitive and trims whitespace. Strips a trailing
 * month code like "NQH26" → "NQ" so traders can paste contract codes directly
 * from their broker without rewriting the symbol.
 */
export function getMultiplier(symbol) {
  if (!symbol) return null;
  const s = String(symbol).trim().toUpperCase();
  if (FUTURES_MULTIPLIERS[s] !== undefined) return FUTURES_MULTIPLIERS[s];
  // Strip a trailing futures month code: NQH26 / NQM6 / NQU2026 → NQ
  // Month codes are letters F G H J K M N Q U V X Z (single char) followed
  // by 1-4 digits for the year.
  const m = s.match(/^([A-Z0-9]+?)([FGHJKMNQUVXZ]\d{1,4})$/);
  if (m && FUTURES_MULTIPLIERS[m[1]] !== undefined) return FUTURES_MULTIPLIERS[m[1]];
  return null;
}

/**
 * Calculate P&L from entry, exit, qty, and direction for a known futures
 * contract. Returns null if any input is missing/invalid or if the symbol
 * isn't a known futures contract.
 *
 * Convention:
 *   long  → P&L positive when exit > entry
 *   short → P&L positive when exit < entry
 *
 * Rounded to 2 decimals.
 */
export function calcPnlFromPrices({ symbol, entry, exit, qty, direction }) {
  const mult = getMultiplier(symbol);
  if (mult == null) return null;
  const e = parseFloat(entry);
  const x = parseFloat(exit);
  const q = parseFloat(qty);
  if (!Number.isFinite(e) || !Number.isFinite(x) || !Number.isFinite(q) || q <= 0) {
    return null;
  }
  const dir = direction === 'short' ? -1 : 1;
  const raw = (x - e) * mult * q * dir;
  return Math.round(raw * 100) / 100;
}

/**
 * Helper: is this symbol one we can auto-calc for? Used by the UI to decide
 * whether to show the "auto" pill next to the P&L field.
 */
export function isKnownFuturesSymbol(symbol) {
  return getMultiplier(symbol) != null;
}
