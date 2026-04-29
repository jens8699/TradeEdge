// Shared Claude client.
// Default path: /api/claude (Cloudflare Pages function, uses platform's
// ANTHROPIC_API_KEY env var). Free for users — no key setup needed.
//
// BYO path: if the user pasted their own key in Settings (`te_claude_key` or
// the legacy `jens_claude_key`), we hit Anthropic directly. Power users who
// want to use their own quota / a different model.

export function getUserClaudeKey() {
  return localStorage.getItem('te_claude_key') ||
         localStorage.getItem('jens_claude_key') || '';
}

/**
 * Call Claude. Returns the parsed Anthropic response on success.
 * Throws on failure with a user-friendly message.
 *
 * @param {object} opts
 * @param {Array<{role: 'user'|'assistant', content: string}>} opts.messages
 * @param {string} [opts.model] e.g. 'claude-haiku-4-5-20251001' or 'claude-sonnet-4-6'
 * @param {number} [opts.max_tokens]
 * @param {string} [opts.system] optional system prompt
 */
export async function callClaude({
  messages,
  model = 'claude-haiku-4-5-20251001',
  max_tokens = 1024,
  system,
}) {
  if (!Array.isArray(messages) || !messages.length) {
    throw new Error('messages required');
  }

  const userKey = getUserClaudeKey();
  const payload = { model, max_tokens, messages };
  if (system) payload.system = system;

  let resp;
  if (userKey) {
    // BYO key — direct call to Anthropic
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': userKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
    });
  } else {
    // Platform proxy
    resp = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data.error?.message || data.error || `Claude error (HTTP ${resp.status})`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Convenience wrapper — Claude returns content as an array of blocks. For
 * simple text prompts, this returns just the first text block as a string.
 */
export async function callClaudeText(opts) {
  const data = await callClaude(opts);
  return data?.content?.[0]?.text || '';
}
