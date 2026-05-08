// Trade screenshot → AI auto-extract.
//
// Drag a screenshot from any broker (Tradovate, NinjaTrader, ToS, TradingView,
// Apex dashboard, etc.) and Claude Vision pulls the structured trade fields:
// symbol, direction, entry, exit, qty, pnl, session. Used by TradeEntry to
// pre-fill the form so users skip the typing step entirely.
//
// Why JSON-shaped output: easier to parse and field-fill the form than
// free-form text. We tolerate missing fields — the user always sees a
// preview and can correct anything before save.

import { callClaude } from './claude';

// ── Public: convert a File/Blob/data-URL to the base64 we send to Anthropic ──

export async function fileToBase64(file) {
  // Already a data URL? Just strip the "data:image/...;base64," prefix.
  if (typeof file === 'string') {
    const comma = file.indexOf(',');
    return comma >= 0 ? file.slice(comma + 1) : file;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

/** Best-effort media type detection. Anthropic accepts png/jpeg/gif/webp. */
export function mediaTypeForFile(file) {
  // Data URL? Parse the prefix.
  if (typeof file === 'string') {
    const m = file.match(/^data:(image\/[a-z]+);base64,/i);
    if (m && /^image\/(png|jpeg|gif|webp)$/i.test(m[1])) return m[1].toLowerCase();
    return 'image/png';
  }
  const t = (file?.type || '').toLowerCase();
  if (t === 'image/png' || t === 'image/jpeg' || t === 'image/gif' || t === 'image/webp') {
    return t;
  }
  // Sniff from filename if MIME is missing (some clipboards do this).
  const name = (file?.name || '').toLowerCase();
  if (name.endsWith('.png'))  return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.gif'))  return 'image/gif';
  if (name.endsWith('.webp')) return 'image/webp';
  // Default — most browser screenshots are PNG.
  return 'image/png';
}

// ── Prompt ───────────────────────────────────────────────────────────────────
// Asks Claude to extract one trade as strict JSON. The "if not visible, omit"
// instruction keeps the model from hallucinating fields just to fill them.

const EXTRACT_SYSTEM = `You are a trading-data extraction tool. Given a screenshot from a broker, prop firm dashboard, charting platform, or any trading-related image, extract the structured trade data and return it as a single JSON object.

Required field rules:
- "symbol": ticker or futures contract code, uppercase, with month-codes stripped (NQM6 → NQ, ESZ5 → ES). For stocks, just the ticker (e.g. AAPL, TSLA).
- "direction": "Long" or "Short". Infer from buy-then-sell vs sell-then-buy if not explicit.
- "entry": numeric entry price (no currency symbol).
- "exit": numeric exit price.
- "qty": integer share/contract count.
- "pnl": realized P&L in account currency, signed (negative for losses). Omit if not shown.
- "date": ISO YYYY-MM-DD date of the trade. Omit if not visible.
- "session": one of "Asia", "London", "New York", "Premarket", "After Hours". Infer from the time if visible. Omit otherwise.
- "notes": one short sentence describing what the screenshot shows (e.g. "Long NQ scalp from M5 chart", "TopStep $50k account daily P&L"). Always include.

Output rules:
- Reply with ONLY a JSON object. No prose, no markdown, no code fences.
- If the image clearly contains NO trade data (e.g. just a logo, a chart with no executions), return: {"error": "No trade data visible"}.
- If multiple trades are visible, extract the most prominent / largest one and put a count in notes.

Example output:
{"symbol":"NQ","direction":"Long","entry":21450.25,"exit":21478.50,"qty":2,"pnl":1130.00,"date":"2026-05-07","session":"New York","notes":"NQ long scalp on 5-min, +28.25 points"}`;

const EXTRACT_USER_TEXT = 'Extract the trade data from this screenshot. Return JSON only.';

// ── Public: extract trade fields from an image File/Blob ─────────────────────

/**
 * Send a screenshot to Claude vision and return the extracted trade fields.
 * Throws with a user-friendly message on failure.
 *
 * @param {File|Blob|string} file  File/Blob OR a data URL string ("data:image/...;base64,...")
 * @returns {Promise<object>} extracted trade fields, or { error: string }
 */
export async function extractTradeFromScreenshot(file) {
  if (!file) throw new Error('No image provided.');
  // For File/Blob inputs check size; data URLs are already in-memory and
  // typically resized smaller than the raw upload anyway.
  if (typeof file !== 'string') {
    const sizeMb = (file.size || 0) / 1024 / 1024;
    if (sizeMb > 5) {
      throw new Error(`Screenshot is ${sizeMb.toFixed(1)} MB — please use one under 5 MB.`);
    }
  }

  const base64 = await fileToBase64(file);
  const mediaType = mediaTypeForFile(file);

  const data = await callClaude({
    // Sonnet is more accurate on noisy broker UI screenshots. Cost is still
    // ~half a cent per extract — acceptable for a Pro feature.
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: EXTRACT_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        { type: 'text', text: EXTRACT_USER_TEXT },
      ],
    }],
  });

  const text = data?.content?.[0]?.text || '';
  if (!text) throw new Error('Claude returned no response. Try a different screenshot.');

  return parseExtractedJson(text);
}

// ── Internal: tolerant JSON parser ───────────────────────────────────────────
// Claude usually returns clean JSON when the system prompt asks for it, but
// occasionally wraps it in ```json fences or adds a trailing period. Strip
// gracefully before parsing.

function parseExtractedJson(text) {
  let s = text.trim();
  // Strip code fences.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  // If there's a leading brace, slice from there to the matching end brace.
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch (e) {
    throw new Error(`AI response wasn't valid JSON. Raw: ${text.slice(0, 200)}`);
  }
}
