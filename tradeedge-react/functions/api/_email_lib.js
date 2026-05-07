// Shared email infrastructure used by /api/email-sequence-tick and
// /api/unsubscribe. Lives in functions/api/_email_lib.js — the leading
// underscore tells Cloudflare Pages NOT to expose this as a public route.
//
// Three things in here:
//   1. EMAIL_TEMPLATES — the 7 template definitions
//   2. resendSend()    — POST to Resend's /emails endpoint
//   3. signToken()/verifyToken() — HMAC tokens used in unsubscribe URLs
//
// All emails include a footer with a one-click unsubscribe link. The token
// in that link is the user's UUID, HMAC-signed with EMAIL_TOKEN_SECRET so a
// stranger can't unsubscribe someone by guessing UUIDs.

const FROM_NAME    = 'Jens at TradeEdge';
const FROM_EMAIL   = 'jens@tradeedge.today';
const REPLY_TO     = 'jens@tradeedge.today';
const SITE_BASE    = 'https://tradeedge.today';

// ────────────────────────────────────────────────────────────────────────────
// Templates
// ────────────────────────────────────────────────────────────────────────────
// Each template returns { subject, html, text } given a user object.
// User shape: { id, email, name, plan, trial_ends_at }
//
// HTML keeps inline styles (not a stylesheet) because most email clients
// strip <style> blocks. Mobile-friendly: max-width 560px, single column.
//
// Text fallback is required for spam-filter scoring AND accessibility.

export const EMAIL_TEMPLATES = {
  day_0_welcome: (u, ctx) => ({
    subject: `Welcome to TradeEdge, ${firstName(u)}`,
    html: wrapHtml({
      preheader: 'A 60-second start so the next trade you take is logged.',
      body: `
        <p style="margin:0 0 16px">Hey ${firstName(u)},</p>
        <p style="margin:0 0 16px">You just signed up for TradeEdge — a trading journal built specifically for prop firm traders. I'm Jens, the founder. I built this because I was tired of juggling spreadsheets across my Apex and MyFundedFutures accounts and never knowing my real edge.</p>
        <p style="margin:0 0 16px"><strong>The fastest way to feel the difference:</strong> log your next trade. Even one. The whole point of the journal is the cumulative picture, but you can't see it without rep #1.</p>
        <p style="margin:0 0 16px"><a href="${SITE_BASE}/?utm_source=email&utm_campaign=day_0" style="color:#E07A3B;font-weight:600;text-decoration:none">→ Log your first trade</a></p>
        <p style="margin:0 0 8px">If you hit any friction, just reply to this email. Real human (me) reads every reply.</p>
        <p style="margin:0">— Jens</p>
      `,
    }, u, ctx),
    text: `Hey ${firstName(u)},

You just signed up for TradeEdge — a trading journal built for prop firm traders. I'm Jens, the founder.

The fastest way to feel the difference: log your next trade. Even one.

→ Log your first trade: ${SITE_BASE}/

If you hit any friction, reply to this email. I read every reply.

— Jens

Unsubscribe: ${ctx.unsubscribeUrl}`,
  }),

  day_1_question: (u, ctx) => ({
    subject: `Quick question, ${firstName(u)}`,
    html: wrapHtml({
      preheader: "What's the one thing your current journal doesn't do?",
      body: `
        <p style="margin:0 0 16px">Hey ${firstName(u)},</p>
        <p style="margin:0 0 16px">One question, completely honest:</p>
        <p style="margin:0 0 16px;font-size:17px;font-weight:600;color:#E07A3B"><em>What's the one thing your current journal doesn't do — but should?</em></p>
        <p style="margin:0 0 16px">Spreadsheet, Tradezella, Tradervue, notebook, screenshots-folder, whatever you've been using. What's the gap that made you click "sign up" yesterday?</p>
        <p style="margin:0 0 16px">I'm asking because I'm building this for actual prop firm traders, not for retail folks. The roadmap follows what real users tell me. Reply takes you 30 seconds and shapes the next month of work.</p>
        <p style="margin:0">— Jens</p>
      `,
    }, u, ctx),
    text: `Hey ${firstName(u)},

One question, completely honest:

What's the one thing your current journal doesn't do — but should?

Spreadsheet, Tradezella, Tradervue, notebook, screenshots — whatever. What's the gap that made you sign up yesterday?

I'm building this for actual prop firm traders. The roadmap follows what real users tell me. Reply takes 30s.

— Jens

Unsubscribe: ${ctx.unsubscribeUrl}`,
  }),

  day_3_use_case: (u, ctx) => ({
    subject: 'How I actually use TradeEdge (real numbers)',
    html: wrapHtml({
      preheader: 'A 2-minute tour of the workflow that beats spreadsheets.',
      body: `
        <p style="margin:0 0 16px">Hey ${firstName(u)},</p>
        <p style="margin:0 0 16px">A few people have asked how I personally use TradeEdge day-to-day. Here's the workflow:</p>
        <ol style="margin:0 0 16px;padding-left:20px">
          <li style="margin-bottom:10px"><strong>Pre-market</strong> — open the Pre-Trade Checklist. 30 seconds. Forces me to ask "is this a setup I take, or am I trading because I'm bored." The answer changes more often than I'd like.</li>
          <li style="margin-bottom:10px"><strong>During trading</strong> — every entry, I log it in 10 seconds. Symbol + entry + exit + qty. P&L auto-calculates because the futures multipliers are baked in.</li>
          <li style="margin-bottom:10px"><strong>Tag with the prop firm account</strong> — Apex $50k, MFFU $50k, etc. So later I can see net P&L per firm AFTER eval/reset fees. That number is usually humbling.</li>
          <li style="margin-bottom:10px"><strong>End of week</strong> — open Stats. Win rate by setup, by session, by symbol. AI Insights flags patterns I'd miss (the Pattern Engine is Pro-only — full disclosure).</li>
        </ol>
        <p style="margin:0 0 16px">The biggest unlock for me wasn't the journaling itself — it was finally seeing that ONE of my five accounts was eating 60% of my time and contributing 12% of my P&L. I dropped it. Net P&L went up the next month.</p>
        <p style="margin:0 0 16px"><a href="${SITE_BASE}/?utm_source=email&utm_campaign=day_3" style="color:#E07A3B;font-weight:600;text-decoration:none">→ Open TradeEdge</a></p>
        <p style="margin:0">— Jens</p>
      `,
    }, u, ctx),
    text: `Hey ${firstName(u)},

A few people have asked how I personally use TradeEdge. Here's the workflow:

1. Pre-market — open the Pre-Trade Checklist. 30 seconds. Forces me to ask "is this a setup I take, or am I trading because I'm bored."

2. During trading — every entry logged in 10 seconds. Symbol + entry + exit + qty. P&L auto-calculates.

3. Tag with the prop firm account — Apex, MFFU, etc. So I can see net P&L per firm AFTER eval/reset fees. Usually humbling.

4. End of week — Stats by setup, session, symbol. AI Insights flags patterns I'd miss (Pattern Engine is Pro-only).

The biggest unlock wasn't the journaling — it was finally seeing that ONE of my five accounts ate 60% of my time and contributed 12% of P&L. I dropped it. Net P&L went up next month.

→ Open TradeEdge: ${SITE_BASE}/

— Jens

Unsubscribe: ${ctx.unsubscribeUrl}`,
  }),

  day_6_trial_end: (u, ctx) => ({
    subject: 'Heads up: your TradeEdge Pro trial ends tomorrow',
    html: wrapHtml({
      preheader: 'Your card will be charged $19. Cancel here if needed.',
      body: `
        <p style="margin:0 0 16px">Hey ${firstName(u)},</p>
        <p style="margin:0 0 16px">Quick heads-up: your 7-day Pro trial ends ${trialEndLabel(u)}. After that, your card will be charged <strong>$19</strong> and you'll continue on the monthly Pro plan.</p>
        <p style="margin:0 0 16px"><strong>Want to keep going?</strong> No action needed. Trial converts automatically.</p>
        <p style="margin:0 0 16px"><strong>Want to cancel?</strong> Totally fine — no questions asked. Click below and you won't be charged.</p>
        <p style="margin:0 0 24px"><a href="${SITE_BASE}/?utm_source=email&utm_campaign=day_6_manage" style="display:inline-block;padding:12px 20px;background:#E07A3B;color:#1C1613;border-radius:10px;font-weight:600;text-decoration:none">Manage subscription</a></p>
        <p style="margin:0 0 16px">If you've been using it and it's working — thanks for trying it out. If something's missing or broken, hit reply and tell me. I read every reply and ship fixes fast.</p>
        <p style="margin:0">— Jens</p>
      `,
    }, u, ctx),
    text: `Hey ${firstName(u)},

Heads-up: your 7-day Pro trial ends ${trialEndLabel(u)}. After that your card is charged $19 and you continue on monthly Pro.

Want to keep going? No action needed. Trial converts automatically.

Want to cancel? Totally fine. Click below.

Manage subscription: ${SITE_BASE}/

If something's broken or missing, hit reply. I read every reply and ship fixes fast.

— Jens

Unsubscribe: ${ctx.unsubscribeUrl}`,
  }),

  day_7_charge_confirm: (u, ctx) => ({
    subject: "You're now a TradeEdge Pro — three things you may have missed",
    html: wrapHtml({
      preheader: 'Pattern Engine, Market Brief, Weekly Digest.',
      body: `
        <p style="margin:0 0 16px">Hey ${firstName(u)},</p>
        <p style="margin:0 0 16px">You're officially Pro. Card charged, no surprises. Thanks for sticking with it.</p>
        <p style="margin:0 0 16px">Three Pro features that aren't always obvious from the dashboard:</p>
        <ul style="margin:0 0 16px;padding-left:20px">
          <li style="margin-bottom:10px"><strong>Pattern Engine</strong> (Insights tab) — the AI looks at your last 30 trades and tells you specific patterns: "you lose 70% of your trades on Mondays in the first hour." Most useful AFTER you have ~30 trades logged.</li>
          <li style="margin-bottom:10px"><strong>Market Brief</strong> — every morning, a curated AI summary of what moved overnight + what's on today's calendar. Replaces the 8 tabs you used to open before market open.</li>
          <li style="margin-bottom:10px"><strong>Weekly Digest</strong> — Sunday email summing your week. Win rate, biggest setup, biggest leak, what to focus on next week.</li>
        </ul>
        <p style="margin:0 0 16px">If anything's not working, reply directly. Real inbox.</p>
        <p style="margin:0">— Jens</p>
      `,
    }, u, ctx),
    text: `Hey ${firstName(u)},

You're officially Pro. Card charged, no surprises. Thanks for sticking with it.

Three Pro features that aren't obvious:

1. Pattern Engine (Insights tab) — the AI looks at your last 30 trades and tells you specific patterns. Most useful after ~30 trades logged.

2. Market Brief — daily AI summary of what moved overnight + today's calendar. Replaces 8 tabs.

3. Weekly Digest — Sunday email summing your week.

Reply if anything's not working.

— Jens

Unsubscribe: ${ctx.unsubscribeUrl}`,
  }),

  day_14_check_in: (u, ctx) => ({
    subject: 'Quick week-2 check-in',
    html: wrapHtml({
      preheader: 'Anything broken? Anything missing?',
      body: `
        <p style="margin:0 0 16px">Hey ${firstName(u)},</p>
        <p style="margin:0 0 16px">Two weeks in. How's it actually going?</p>
        <p style="margin:0 0 16px">Two questions, no marketing:</p>
        <ol style="margin:0 0 16px;padding-left:20px">
          <li style="margin-bottom:8px">What's working better than your old setup?</li>
          <li style="margin-bottom:8px">What's frustrating you, or what's still missing?</li>
        </ol>
        <p style="margin:0 0 16px">If question 2 has an answer, that's literally the next thing I should build. Reply with a sentence. I'll either fix it or tell you why it's hard.</p>
        <p style="margin:0">— Jens</p>
      `,
    }, u, ctx),
    text: `Hey ${firstName(u)},

Two weeks in. How's it actually going?

Two questions, no marketing:

1. What's working better than your old setup?
2. What's frustrating you, or what's still missing?

If question 2 has an answer, that's the next thing I should build. Reply with a sentence.

— Jens

Unsubscribe: ${ctx.unsubscribeUrl}`,
  }),

  day_30_referral: (u, ctx) => ({
    subject: 'A favor — and a thank-you',
    html: wrapHtml({
      preheader: 'You probably know other prop firm traders.',
      body: `
        <p style="margin:0 0 16px">Hey ${firstName(u)},</p>
        <p style="margin:0 0 16px">A month in. If you're still here, it means TradeEdge is doing something right for you. That genuinely means a lot — I'm building this solo and every retained user is a real signal.</p>
        <p style="margin:0 0 16px">A small ask: <strong>you probably know other prop firm traders.</strong> The Discord servers, the trading rooms, the friends who switched from retail to funded.</p>
        <p style="margin:0 0 16px">If you'd share TradeEdge with even one of them, it would help me more than any paid ad. The whole growth model right now is word-of-mouth from real prop traders.</p>
        <p style="margin:0 0 16px">Easiest way: forward this email or send them <a href="${SITE_BASE}/?utm_source=email&utm_campaign=day_30_referral" style="color:#E07A3B;text-decoration:none;font-weight:600">tradeedge.today</a>.</p>
        <p style="margin:0 0 16px">If they sign up, they get the same 7-day Pro trial you got. No referral codes, no spammy two-sided gimmicks. Just them seeing if it's useful.</p>
        <p style="margin:0">— Jens</p>
      `,
    }, u, ctx),
    text: `Hey ${firstName(u)},

A month in. If you're still here, TradeEdge is doing something right for you. That means a lot — I'm building this solo.

Small ask: you probably know other prop firm traders. The Discord servers, trading rooms, friends who switched to funded.

If you'd share TradeEdge with even one of them, it helps more than any paid ad.

Easiest way: forward this email or send them ${SITE_BASE}/

If they sign up they get the same 7-day Pro trial. No referral codes.

— Jens

Unsubscribe: ${ctx.unsubscribeUrl}`,
  }),
};

// ────────────────────────────────────────────────────────────────────────────
// Eligibility rules — when each step should fire
// ────────────────────────────────────────────────────────────────────────────
//
// The cron tick uses these to decide who's due. user is the row from the
// SQL JOIN of auth.users + profiles. now is the current Date.
//
// Returns true if the user should receive this step now (and hasn't already).

export const STEP_ELIGIBILITY = {
  day_0_welcome:     (u, now) => hoursSinceSignup(u, now) >= 0,
  // Skip Day 1 if the user already answered the same question in-app via the
  // onboarding modal (profiles.expectation set). No point asking twice.
  day_1_question:    (u, now) => (
    hoursSinceSignup(u, now) >= 24 &&
    !(u.expectation && u.expectation.trim().length > 0)
  ),
  day_3_use_case:    (u, now) => hoursSinceSignup(u, now) >= 72,
  // Trial end warning — only for users in trial whose trial ends within 24h.
  day_6_trial_end:   (u, now) => {
    if (!u.trial_ends_at) return false;
    const ms = new Date(u.trial_ends_at).getTime() - now.getTime();
    return ms > 0 && ms <= 24 * 3600 * 1000;
  },
  // Charge confirm — fires once per user, only after they're a Pro non-trial
  // user AND at least 7 days since signup. trial_ends_at is null when trial
  // converted (the existing Stripe webhook clears it).
  day_7_charge_confirm: (u, now) => (
    u.plan === 'pro' &&
    u.trial_ends_at == null &&
    hoursSinceSignup(u, now) >= 7 * 24
  ),
  day_14_check_in:   (u, now) => hoursSinceSignup(u, now) >= 14 * 24,
  day_30_referral:   (u, now) => hoursSinceSignup(u, now) >= 30 * 24,
};

// All step keys, in send order. Used by the tick to iterate.
export const STEP_ORDER = Object.keys(EMAIL_TEMPLATES);

// ────────────────────────────────────────────────────────────────────────────
// Resend sender
// ────────────────────────────────────────────────────────────────────────────
// POST https://api.resend.com/emails
// Returns the Resend email id on success, null on failure (logs error).

export async function resendSend(env, { to, subject, html, text, replyTo, headers }) {
  if (!env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
      text,
      reply_to: replyTo || REPLY_TO,
      headers: {
        // List-Unsubscribe is required by Gmail/Yahoo for bulk senders.
        // Including a Mailto fallback lets one-click unsubscribe work in
        // every client.
        'List-Unsubscribe': headers?.['List-Unsubscribe'] || '',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    console.warn('Resend send failed:', r.status, txt);
    return null;
  }
  const data = await r.json().catch(() => ({}));
  return data.id || null;
}

// ────────────────────────────────────────────────────────────────────────────
// Token helpers — HMAC-signed user ID for the unsubscribe URL
// ────────────────────────────────────────────────────────────────────────────
// Token format: `${userId}.${signature}`. Signature is HMAC-SHA256 of userId
// with EMAIL_TOKEN_SECRET, hex-encoded. Verifier extracts userId, recomputes
// signature, constant-time compares.

export async function signToken(userId, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(userId));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${userId}.${hex}`;
}

export async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const userId = token.slice(0, dot);
  const expected = await signToken(userId, secret);
  // Constant-time compare
  if (expected.length !== token.length) return null;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0 ? userId : null;
}

// ────────────────────────────────────────────────────────────────────────────
// HTML wrapper — common header/footer for every email
// ────────────────────────────────────────────────────────────────────────────

function wrapHtml({ preheader = '', body }, user, ctx) {
  // Preheader: hidden text shown in inbox previews. Rendered with
  // display:none + max-height tricks to suppress it from the body.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TradeEdge</title>
</head>
<body style="margin:0;padding:0;background:#F2EDE3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C1613">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F2EDE3">${escapeHtml(preheader)}</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F2EDE3">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#FFFFFF;border:1px solid #E0DAC8;border-radius:14px">
      <tr><td style="padding:32px 32px 24px">
        <div style="font-size:18px;font-weight:600;color:#E07A3B;letter-spacing:-0.3px;margin-bottom:24px">tradeedge.</div>
        <div style="font-size:15px;line-height:1.6;color:#1C1613">
          ${body}
        </div>
      </td></tr>
    </table>
    <div style="max-width:560px;margin:16px auto 0;font-size:11px;line-height:1.6;color:#8B8882;text-align:center">
      <p style="margin:0 0 6px">TradeEdge · Trading journal for prop firm traders</p>
      <p style="margin:0">
        <a href="${ctx.unsubscribeUrl}" style="color:#8B8882;text-decoration:underline">Unsubscribe</a>
      </p>
    </div>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Small helpers ───────────────────────────────────────────────────────────

function firstName(u) {
  const raw = u?.name || u?.user_metadata?.name || u?.email || 'trader';
  const first = String(raw).split(/[\s@]/)[0];
  // Capitalize first letter, keep the rest as written
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function hoursSinceSignup(u, now) {
  const created = u.created_at || u.createdAt;
  if (!created) return Infinity;
  const ms = now.getTime() - new Date(created).getTime();
  return ms / 3600000;
}

function trialEndLabel(u) {
  if (!u.trial_ends_at) return 'tomorrow';
  const d = new Date(u.trial_ends_at);
  if (!Number.isFinite(d.getTime())) return 'tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
