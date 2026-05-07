/**
 * Cloudflare Pages Function — One-click unsubscribe.
 *
 * GET /api/unsubscribe?token=<userid>.<sig>
 *   Returns an HTML confirmation page. Sets profiles.unsubscribed_at = NOW().
 * POST /api/unsubscribe
 *   Same effect, used for List-Unsubscribe-Post=One-Click headers
 *   (Gmail/Yahoo bulk-sender requirement).
 *
 * Tokens are HMAC-signed user IDs. See _email_lib.js#signToken.
 *
 * This endpoint is intentionally idempotent and tolerant — clicking
 * twice still works, an invalid token shows a friendly error rather
 * than a 500.
 *
 * Required env:
 *   EMAIL_TOKEN_SECRET           HMAC secret (must match the cron tick)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { verifyToken } from './_email_lib.js';

export async function onRequest(context) {
  const { env, request } = context;
  return handle(env, request);
}

async function handle(env, request) {
  if (!env.EMAIL_TOKEN_SECRET || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return htmlPage('Service not configured', 'This unsubscribe link is temporarily unavailable. Please email jens@tradeedge.today and we\'ll handle it manually.', 503);
  }

  const url = new URL(request.url);
  // POST one-click puts the token in form body OR query string depending on
  // the client. Accept both.
  let token = url.searchParams.get('token');
  if (!token && request.method === 'POST') {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/x-www-form-urlencoded')) {
      const body = await request.text();
      const params = new URLSearchParams(body);
      token = params.get('token');
    }
  }

  const userId = token ? await verifyToken(token, env.EMAIL_TOKEN_SECRET) : null;
  if (!userId) {
    return htmlPage(
      'Invalid unsubscribe link',
      'We couldn\'t verify this unsubscribe link. The link may be expired or copied incorrectly. To unsubscribe manually, reply to any email from jens@tradeedge.today and we\'ll take you off immediately.',
      400,
    );
  }

  // Mark unsubscribed. Idempotent — clicking twice is fine.
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ unsubscribed_at: new Date().toISOString() }),
    },
  );
  if (!r.ok) {
    return htmlPage(
      'Something went wrong',
      'We couldn\'t process the unsubscribe right now. Please reply to any of our emails and we\'ll handle it manually.',
      500,
    );
  }

  return htmlPage(
    'You\'ve been unsubscribed',
    'You won\'t receive any more emails from TradeEdge. If you change your mind or have feedback, you can always reply to a previous email — we read every reply.',
  );
}

function htmlPage(title, body, status = 200) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · TradeEdge</title>
<style>
  body { margin:0; padding:0; background:#F2EDE3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#1C1613; }
  .wrap { max-width:480px; margin:80px auto; padding:32px; background:#FFFFFF; border:1px solid #E0DAC8; border-radius:14px; }
  .logo { font-size:18px; font-weight:600; color:#E07A3B; letter-spacing:-0.3px; margin-bottom:24px; }
  h1 { font-size:20px; font-weight:600; margin:0 0 12px; letter-spacing:-0.3px; }
  p { font-size:14px; line-height:1.6; color:#3A3733; margin:0 0 16px; }
  a { color:#E07A3B; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="logo">tradeedge.</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
    <p><a href="https://tradeedge.today/">← back to TradeEdge</a></p>
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
