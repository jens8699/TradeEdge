/**
 * Cloudflare Pages Function — Email sequence tick.
 *
 * GET/POST /api/email-sequence-tick
 * GET     /api/email-sequence-tick?user_id=<uuid>
 *
 * Two callers:
 *   1. Cloudflare Worker Cron Trigger (hourly) — no user_id, processes all
 *      eligible users.
 *   2. Client-side after signup — passes user_id, processes only that user
 *      (so Day 0 fires within seconds, not within the next hour).
 *
 * Both callers must include header `X-Email-Cron-Secret: <EMAIL_CRON_SECRET>`.
 * Without it, the endpoint returns 401. This prevents random people on the
 * internet from triggering email blasts by hitting the URL.
 *
 * Idempotent: a UNIQUE(user_id, step) constraint on email_sequence_log
 * means duplicate sends are impossible even if the function runs twice
 * concurrently. We log BEFORE sending and rely on the uniqueness check,
 * but if the send fails we delete the log row so the next tick retries.
 *
 * Required env:
 *   EMAIL_CRON_SECRET            shared secret with the Worker / client
 *   EMAIL_TOKEN_SECRET           HMAC secret for unsubscribe tokens
 *   RESEND_API_KEY               re_...
 *   SUPABASE_URL                 https://<proj>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    bypasses RLS — server-only
 */

import {
  EMAIL_TEMPLATES, STEP_ELIGIBILITY, STEP_ORDER,
  resendSend, signToken,
} from './_email_lib.js';

const SITE_BASE = 'https://tradeedge.today';

export async function onRequest(context) {
  const { env, request } = context;
  return handle(env, request);
}

async function handle(env, request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  if (!env.EMAIL_CRON_SECRET) {
    return json({ ok: false, error: 'Missing EMAIL_CRON_SECRET' }, 503);
  }
  const presented = request.headers.get('x-email-cron-secret') || '';
  if (!constantTimeEquals(presented, env.EMAIL_CRON_SECRET)) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }
  if (!env.RESEND_API_KEY) {
    return json({ ok: false, error: 'Missing RESEND_API_KEY' }, 503);
  }
  if (!env.EMAIL_TOKEN_SECRET) {
    return json({ ok: false, error: 'Missing EMAIL_TOKEN_SECRET' }, 503);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: 'Missing Supabase service env' }, 503);
  }

  const url = new URL(request.url);
  const singleUserId = url.searchParams.get('user_id');

  // ── Load candidates ─────────────────────────────────────────────────────
  // We need email + created_at from auth.users (not on profiles), and
  // plan/trial_ends_at/unsubscribed_at/name from profiles. Two queries
  // merged in JS — simpler than a Postgres view.
  const [authUsers, profiles] = await Promise.all([
    listAuthUsers(env, singleUserId),
    sbGet(env,
      `/rest/v1/profiles?select=id,name,plan,trial_ends_at,unsubscribed_at,expectation${
        singleUserId ? `&id=eq.${encodeURIComponent(singleUserId)}` : ''
      }`,
    ),
  ]);
  if (!Array.isArray(authUsers) || !Array.isArray(profiles)) {
    return json({ ok: false, error: 'Could not load users' }, 500);
  }

  // Merge: auth.users.id ↔ profiles.id
  const profileById = new Map(profiles.map(p => [p.id, p]));
  const candidates = authUsers
    .map(au => {
      const p = profileById.get(au.id) || {};
      return {
        id:              au.id,
        email:           au.email,
        created_at:      au.created_at,
        name:            p.name || au.user_metadata?.name || null,
        plan:            p.plan || 'free',
        trial_ends_at:   p.trial_ends_at || null,
        unsubscribed_at: p.unsubscribed_at || null,
        expectation:     p.expectation || null,
      };
    })
    .filter(u => u.email && u.created_at && !u.unsubscribed_at);
  if (candidates.length === 0) return json({ ok: true, processed: 0, sent: [] });

  // ── Pull existing log rows in one query (so we don't N+1) ───────────────
  const ids = candidates.map(c => c.id);
  const inList = ids.map(encodeURIComponent).join(',');
  const log = await sbGet(
    env,
    `/rest/v1/email_sequence_log?select=user_id,step&user_id=in.(${inList})`,
  );
  const sentSet = new Set(); // "userId:step"
  for (const row of (log || [])) sentSet.add(`${row.user_id}:${row.step}`);

  // ── Process each candidate ──────────────────────────────────────────────
  const now = new Date();
  const results = [];

  for (const u of candidates) {
    for (const step of STEP_ORDER) {
      const key = `${u.id}:${step}`;
      if (sentSet.has(key)) continue;
      const eligible = STEP_ELIGIBILITY[step]?.(u, now);
      if (!eligible) continue;

      // Build the unsubscribe URL. Goes to /api/unsubscribe which renders
      // its own HTML confirmation page.
      const token = await signToken(u.id, env.EMAIL_TOKEN_SECRET);
      const unsubscribeUrl = `${SITE_BASE}/api/unsubscribe?token=${encodeURIComponent(token)}`;

      // Render template.
      const tpl = EMAIL_TEMPLATES[step](u, { unsubscribeUrl });

      // Best-effort send. Insert log first to grab the unique slot;
      // if send fails we delete the log row so the next tick retries.
      const inserted = await sbInsert(env, '/rest/v1/email_sequence_log', {
        user_id: u.id, step, sent_at: now.toISOString(),
      });
      if (!inserted) {
        // Race: another tick is sending. Skip — they'll handle it.
        continue;
      }

      const resendId = await resendSend(env, {
        to: u.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
        },
      });

      if (resendId) {
        // Patch the log row with Resend ID for traceability.
        await sbPatch(env,
          `/rest/v1/email_sequence_log?user_id=eq.${u.id}&step=eq.${step}`,
          { resend_id: resendId });
        results.push({ user: u.id, step, ok: true, resend_id: resendId });
      } else {
        // Roll back the log row so the next tick retries.
        await sbDelete(env,
          `/rest/v1/email_sequence_log?user_id=eq.${u.id}&step=eq.${step}`);
        results.push({ user: u.id, step, ok: false });
      }
    }
  }

  return json({ ok: true, processed: candidates.length, sent: results });
}

// ── Supabase Auth admin API ────────────────────────────────────────────────
// GET /auth/v1/admin/users returns up to 1000 users per page. Pages start
// at 1. For TradeEdge's scale (4 → couple hundred) one page is fine; we
// paginate defensively up to 5 pages.
//
// Single-user mode hits /auth/v1/admin/users/{id} which returns one user.

async function listAuthUsers(env, singleUserId) {
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
  if (singleUserId) {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(singleUserId)}`, { headers });
    if (!r.ok) return [];
    const u = await r.json().catch(() => null);
    return u && u.id ? [u] : [];
  }
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers });
    if (!r.ok) break;
    const data = await r.json().catch(() => null);
    const users = data?.users || [];
    if (!users.length) break;
    all.push(...users);
    if (users.length < 1000) break;
  }
  return all;
}

// ── Supabase REST helpers (service role) ───────────────────────────────────

async function sbGet(env, path) {
  const r = await fetch(env.SUPABASE_URL + path, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

async function sbInsert(env, path, row) {
  const r = await fetch(env.SUPABASE_URL + path, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  // 201 = success. 409 = unique constraint violation = race lost = skip.
  return r.ok;
}

async function sbPatch(env, path, patch) {
  const r = await fetch(env.SUPABASE_URL + path, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  return r.ok;
}

async function sbDelete(env, path) {
  const r = await fetch(env.SUPABASE_URL + path, {
    method: 'DELETE',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  return r.ok;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function constantTimeEquals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
