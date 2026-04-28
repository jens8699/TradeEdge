// CSV importers for DAS Trader and Thinkorswim.
//
// Both platforms export "fills" (per-execution rows), not "round-trip trades".
// We parse fills, then pair buys with sells per symbol in chronological order
// to reconstruct trades with entry/exit prices and P&L.

// ── Generic CSV utilities ────────────────────────────────────────────────────

/** Split a CSV line respecting double-quoted fields. */
export function splitCsvLine(line) {
  const cells = [];
  let inQ = false, cur = '';
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/** Parse a full CSV blob into { headers, rows: string[][] }. */
export function parseCsv(text) {
  const lines = text.replace(/﻿/g, '').trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase().trim());
  const rows = lines.slice(1)
    .filter(l => l.trim().length > 0)
    .map(l => splitCsvLine(l));
  return { headers, rows };
}

/** Find a column index by trying multiple aliases (case-insensitive). */
function findCol(headers, aliases) {
  for (const a of aliases) {
    const idx = headers.findIndex(h => h === a || h.includes(a));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Parse a number that may be in `$1,234.56` or `(123.45)` (negative) form. */
export function parseMoney(raw) {
  if (raw == null) return NaN;
  const s = String(raw).replace(/[$,"\s]/g, '');
  if (!s) return NaN;
  if (s.startsWith('(') && s.endsWith(')')) return -parseFloat(s.slice(1, -1));
  return parseFloat(s);
}

/** Strip futures expiry codes: NQM6 → NQ, ESZ5 → ES. */
export function cleanSymbol(sym) {
  if (!sym) return 'UNKNOWN';
  return sym.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '').toUpperCase() || sym.toUpperCase();
}

// ── Format detection ─────────────────────────────────────────────────────────

/** Sniff which platform exported this CSV. Returns 'das' | 'tos' | 'unknown'. */
export function detectFormat(text) {
  const head = text.slice(0, 4000).toLowerCase();
  // Thinkorswim Account Statement always contains this section header.
  if (head.includes('account trade history') || head.includes('exec time')) return 'tos';
  // DAS Trader exports usually have these column names.
  if (
    (head.includes('symbol') && head.includes('side') && head.includes('route')) ||
    head.includes('das trader')
  ) return 'das';
  return 'unknown';
}

// ── Round-trip pairing ───────────────────────────────────────────────────────

/**
 * Given a list of normalised fills [{ time, symbol, side: 'buy'|'sell', qty, price }],
 * pair them into round-trip trades using FIFO per symbol.
 *
 * Returns { trades, leftover } — leftover are unmatched fills (open positions).
 */
export function pairFillsIntoTrades(fills, sourceLabel = 'CSV') {
  const bySymbol = {};
  for (const f of fills) {
    if (!f || !f.symbol) continue;
    (bySymbol[f.symbol] = bySymbol[f.symbol] || []).push(f);
  }
  // Sort each symbol's fills by time (asc).
  Object.values(bySymbol).forEach(arr => arr.sort((a, b) => +a.time - +b.time));

  const trades = [];
  const leftover = [];

  for (const [symbol, arr] of Object.entries(bySymbol)) {
    // FIFO position queue. Each entry: { side, qtyRemaining, price, time }
    const positions = [];

    for (const fill of arr) {
      let remaining = Math.abs(fill.qty);
      while (remaining > 0) {
        const open = positions[0];
        // Same side as open position (or no open position) → this fill opens / adds to it
        if (!open || open.side === fill.side) {
          positions.push({ ...fill, qtyRemaining: remaining });
          remaining = 0;
          break;
        }
        // Opposing side → closes part or all of the open position
        const closedQty = Math.min(open.qtyRemaining, remaining);
        const direction = open.side === 'buy' ? 'Long' : 'Short';
        const entry = open.price;
        const exit  = fill.price;
        const pnl = direction === 'Long'
          ? (exit - entry) * closedQty
          : (entry - exit) * closedQty;
        const date = new Date(open.time).toISOString().slice(0, 10);
        trades.push({
          symbol,
          direction,
          entry,
          exit,
          qty: closedQty,
          pnl: parseFloat(pnl.toFixed(2)),
          date,
          notes: `Imported from ${sourceLabel} (${symbol})`,
          source: sourceLabel.toLowerCase().includes('das') ? 'das_csv' : sourceLabel.toLowerCase().includes('thinkorswim') ? 'tos_csv' : 'csv',
          external_id: `${sourceLabel.toLowerCase().slice(0,3)}_csv_${symbol}_${+open.time}_${+fill.time}_${closedQty}`,
        });
        open.qtyRemaining -= closedQty;
        remaining -= closedQty;
        if (open.qtyRemaining <= 0) positions.shift();
      }
    }
    if (positions.length) leftover.push(...positions.map(p => ({ symbol, ...p })));
  }
  return { trades, leftover };
}

// ── DAS Trader parser ────────────────────────────────────────────────────────

/**
 * DAS Trader Trades export typically has columns:
 *   Time, Symbol, Side, Qty, Price, Route, Account, ...
 * Side values: B (buy), S (sell), SS (short sell), BC (buy to cover).
 */
export function parseDAS(text) {
  const { headers, rows } = parseCsv(text);
  if (!headers.length) throw new Error('CSV is empty.');

  const idxTime   = findCol(headers, ['time', 'datetime', 'date']);
  const idxSym    = findCol(headers, ['symbol', 'ticker']);
  const idxSide   = findCol(headers, ['side', 'b/s', 'action']);
  const idxQty    = findCol(headers, ['qty', 'quantity', 'shares']);
  const idxPrice  = findCol(headers, ['price', 'fill price', 'exec price']);

  if (idxSym < 0 || idxSide < 0 || idxQty < 0 || idxPrice < 0) {
    throw new Error('Could not find Symbol/Side/Qty/Price columns. This may not be a DAS export — try the manual mapping option.');
  }

  const fills = [];
  const skipped = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sideRaw = (r[idxSide] || '').toUpperCase().trim();
    let side;
    if (sideRaw === 'B' || sideRaw === 'BUY' || sideRaw === 'BC') side = 'buy';
    else if (sideRaw === 'S' || sideRaw === 'SELL' || sideRaw === 'SS') side = 'sell';
    else { skipped.push(i + 2); continue; }

    const qty   = parseFloat(r[idxQty]);
    const price = parseFloat(r[idxPrice]);
    if (!isFinite(qty) || !isFinite(price)) { skipped.push(i + 2); continue; }

    const timeStr = idxTime >= 0 ? r[idxTime] : '';
    const time = timeStr ? new Date(timeStr) : new Date();
    if (isNaN(+time)) { skipped.push(i + 2); continue; }

    fills.push({
      time,
      symbol: cleanSymbol(r[idxSym]),
      side,
      qty,
      price,
    });
  }

  const { trades, leftover } = pairFillsIntoTrades(fills, 'DAS Trader');
  return { trades, skipped, leftover };
}

// ── Thinkorswim parser ───────────────────────────────────────────────────────

/**
 * Thinkorswim Account Statement is a multi-section CSV. The "Account Trade
 * History" section has the rows we need. Section starts with a line containing
 * "Account Trade History" and ends at the next blank line / next section.
 * Columns (typical): Exec Time, Spread, Side, Qty, Pos Effect, Symbol,
 *                    Exp, Strike, Type, Price, Net Price, Order Type
 *
 * For a simple equity-only TOS export (just trade history), there's no section
 * wrapping — we treat the whole file as one block.
 */
export function parseTOS(text) {
  const cleaned = text.replace(/﻿/g, '');

  // Try to extract the "Account Trade History" section if present.
  let block = cleaned;
  const lower = cleaned.toLowerCase();
  const sectionStart = lower.indexOf('account trade history');
  if (sectionStart >= 0) {
    const after = cleaned.slice(sectionStart);
    // Skip past the section title line + blank line, find headers row
    const lines = after.split(/\r?\n/);
    // Find the first line that looks like a header (contains "Exec Time" or "Symbol")
    let headerIdx = lines.findIndex(l => /exec time/i.test(l) || /^DATE,|^Date,/i.test(l));
    if (headerIdx < 0) headerIdx = 1;
    // Find the end: blank line marks section end
    let endIdx = lines.findIndex((l, i) => i > headerIdx && l.trim() === '');
    if (endIdx < 0) endIdx = lines.length;
    block = lines.slice(headerIdx, endIdx).join('\n');
  }

  const { headers, rows } = parseCsv(block);
  if (!headers.length) throw new Error('Thinkorswim CSV: no Account Trade History section found.');

  const idxTime   = findCol(headers, ['exec time', 'date/time', 'datetime', 'time', 'date']);
  const idxSide   = findCol(headers, ['side', 'b/s', 'action']);
  const idxQty    = findCol(headers, ['qty', 'quantity', 'shares']);
  const idxSym    = findCol(headers, ['symbol', 'underlying']);
  const idxPrice  = findCol(headers, ['price', 'net price', 'avg price']);
  const idxType   = findCol(headers, ['type']); // 'STOCK' / 'OPT' / 'FUT'

  if (idxSym < 0 || idxSide < 0 || idxQty < 0 || idxPrice < 0) {
    throw new Error('Could not find Symbol/Side/Qty/Price columns. Is this an Account Statement export?');
  }

  const fills = [];
  const skipped = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    // Skip option rows for v1 — we don't model multi-leg spreads yet.
    if (idxType >= 0) {
      const t = (r[idxType] || '').toUpperCase();
      if (t === 'OPT' || t === 'OPTION') { skipped.push(i + 2); continue; }
    }

    const sideRaw = (r[idxSide] || '').toUpperCase().trim();
    let side;
    if (sideRaw === 'BUY' || sideRaw === 'BOT' || sideRaw === 'B' || sideRaw === '+') side = 'buy';
    else if (sideRaw === 'SELL' || sideRaw === 'SLD' || sideRaw === 'S' || sideRaw === '-') side = 'sell';
    else { skipped.push(i + 2); continue; }

    const qty   = parseFloat(String(r[idxQty]).replace(/[+,\s]/g, ''));
    const price = parseFloat(String(r[idxPrice]).replace(/[$,\s]/g, ''));
    if (!isFinite(qty) || !isFinite(price)) { skipped.push(i + 2); continue; }

    const timeStr = idxTime >= 0 ? r[idxTime] : '';
    const time = timeStr ? new Date(timeStr) : new Date();
    if (isNaN(+time)) { skipped.push(i + 2); continue; }

    fills.push({
      time,
      symbol: cleanSymbol(r[idxSym]),
      side,
      qty: Math.abs(qty),
      price,
    });
  }

  const { trades, leftover } = pairFillsIntoTrades(fills, 'Thinkorswim');
  return { trades, skipped, leftover };
}

// ── Manual mapping (fallback for unknown formats) ────────────────────────────

/**
 * Parse with user-provided column mapping. `mapping` is an object whose values
 * are header strings (lowercased) the user picked from a dropdown.
 *   { time, symbol, side, qty, price }
 */
export function parseWithMapping(text, mapping) {
  const { headers, rows } = parseCsv(text);
  const idx = key => mapping[key] ? headers.indexOf(mapping[key]) : -1;
  const idxTime  = idx('time');
  const idxSym   = idx('symbol');
  const idxSide  = idx('side');
  const idxQty   = idx('qty');
  const idxPrice = idx('price');

  if (idxSym < 0 || idxSide < 0 || idxQty < 0 || idxPrice < 0) {
    throw new Error('Please map all required columns: Symbol, Side, Qty, Price.');
  }

  const fills = [];
  const skipped = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sideRaw = (r[idxSide] || '').toUpperCase().trim();
    let side;
    if (/(B|BUY|BOT|\+)/.test(sideRaw)) side = 'buy';
    else if (/(S|SELL|SLD|SS|-)/.test(sideRaw)) side = 'sell';
    else { skipped.push(i + 2); continue; }
    const qty   = parseFloat(String(r[idxQty]).replace(/[+,\s]/g, ''));
    const price = parseFloat(String(r[idxPrice]).replace(/[$,\s]/g, ''));
    if (!isFinite(qty) || !isFinite(price)) { skipped.push(i + 2); continue; }
    const timeStr = idxTime >= 0 ? r[idxTime] : '';
    const time = timeStr ? new Date(timeStr) : new Date();
    if (isNaN(+time)) { skipped.push(i + 2); continue; }
    fills.push({ time, symbol: cleanSymbol(r[idxSym]), side, qty: Math.abs(qty), price });
  }
  const { trades, leftover } = pairFillsIntoTrades(fills, 'Manual mapping');
  return { trades, skipped, leftover };
}
