/**
 * Cloudflare Pages Function — Stripe webhook receiver.
 * POST /api/stripe-webhook
 *
 * Stripe POSTs subscription lifecycle events here. We verify the signature
 * with HMAC-SHA256, then update profiles.plan / has_backtesting / stripe_*
 * via the Supabase service role.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY            (used to fetch full subscription details)
 *   STRIPE_WEBHOOK_SECRET        whsec_... — generated when registering the webhook
 *   STRIPE_PRICE_PRO             so we can recognise the Pro line item
 *   STRIPE_PRICE_BACKTEST        so we can recognise the Backtesting line item
 *   SUPABASE_URL                 https://<proj>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    service-role key (bypasses RLS — server-only)
 *
 * Events handled:
 *   checkout.session.completed
 *   customer.subscription.updated
 *   customer.subscription.deleted
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      return new Response('Missing STRIPE_WEBHOOK_SECRET', { status: 503 });
    }

    const sig = request.headers.get('stripe-signature') || '';
    const rawBody = await request.text();

    // ── Verify the signature ─────────────────────────────────────────────
    const verified = await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
    if (!verified) return new Response('Invalid signature', { status: 400 });

    const event = JSON.parse(rawBody);
    const type  = event.type;
    const obj   = event.data?.object || {};

    // ── Route by event type ──────────────────────────────────────────────
    if (type === 'checkout.session.completed') {
      // Session has client_reference_id (= our Supabase user.id) and customer
      const userId       = obj.client_reference_id || obj.metadata?.user_id;
      const customerId   = obj.customer;
      const subscriptionId = obj.subscription;
      if (!userId) return ok(); // nothing we can do

      // Fetch the subscription to inspect its line items (so we know
      // whether the Backtesting add-on is included)
      const sub = subscriptionId
        ? await stripeGet(`/v1/subscriptions/${subscriptionId}?expand[]=items.data.price`, env)
        : null;
      const hasBacktest = subHasBacktest(sub, env);

      await updateProfile(env, userId, {
        plan: 'pro',
        has_backtesting: hasBacktest,
        stripe_customer_id:      customerId || null,
        stripe_subscription_id:  subscriptionId || null,
      });
      return ok();
    }

    if (type === 'customer.subscription.updated' || type === 'customer.subscription.created') {
      const sub = obj;
      const userId = sub.metadata?.user_id;
      const status = sub.status; // active | trialing | past_due | canceled | incomplete | unpaid | paused
      const isActive = status === 'active' || status === 'trialing' || status === 'past_due';
      const hasBacktest = subHasBacktest(sub, env);
      if (!userId) return ok();
      await updateProfile(env, userId, {
        plan: isActive ? 'pro' : 'free',
        has_backtesting: isActive && hasBacktest,
        stripe_customer_id:     sub.customer,
        stripe_subscription_id: sub.id,
      });
      return ok();
    }

    if (type === 'customer.subscription.deleted') {
      const sub = obj;
      const userId = sub.metadata?.user_id;
      if (!userId) return ok();
      await updateProfile(env, userId, {
        plan: 'free',
        has_backtesting: false,
        stripe_subscription_id: null,
      });
      return ok();
    }

    // Acknowledge anything else so Stripe doesn't retry
    return ok();
  } catch (e) {
    return new Response('Webhook error: ' + (e.message || e), { status: 500 });
  }
}

function ok() { return new Response('ok', { status: 200 }); }

// ── Subscription helpers ─────────────────────────────────────────────────

function subHasBacktest(sub, env) {
  if (!sub || !env.STRIPE_PRICE_BACKTEST) return false;
  const items = sub.items?.data || [];
  return items.some(i => i.price?.id === env.STRIPE_PRICE_BACKTEST);
}

async function stripeGet(path, env) {
  const r = await fetch('https://api.stripe.com' + path, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!r.ok) throw new Error(`Stripe GET ${path} → ${r.status}`);
  return r.json();
}

// ── Supabase update via service role ─────────────────────────────────────

async function updateProfile(env, userId, patch) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase service role env');
  }
  const url = `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Supabase PATCH failed: ${r.status} ${txt}`);
  }
}

// ── Stripe signature verification (HMAC-SHA256) ──────────────────────────
//
// Stripe-Signature header looks like:
//   t=1614091199,v1=abc123def456...,v0=...
// We HMAC the string `${t}.${rawBody}` with the webhook secret and compare
// to v1. Tolerance: 5 minutes (Stripe default).

async function verifyStripeSignature(payload, header, secret) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map(p => {
      const [k, ...rest] = p.split('=');
      return [k.trim(), rest.join('=').trim()];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  // Replay protection — 5-minute tolerance
  const ageSec = Math.abs(Date.now() / 1000 - parseInt(t, 10));
  if (!Number.isFinite(ageSec) || ageSec > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  // Constant-time compare
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}
