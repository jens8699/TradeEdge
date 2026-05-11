/**
 * Cloudflare Pages Function — Stripe Checkout Session creator.
 * POST /api/stripe-checkout
 *
 * Body: { interval?: 'monthly' | 'annual', addBacktesting?: boolean }
 * Headers: Authorization: Bearer <supabase_access_token>
 *
 * Returns: { url: 'https://checkout.stripe.com/...' }
 *
 * Required env vars (Cloudflare Pages → Settings → Env vars):
 *   STRIPE_SECRET_KEY            sk_test_... (or sk_live_...)
 *   STRIPE_PRICE_PRO             price_... for the $19/mo Pro plan (monthly)
 *   STRIPE_PRICE_PRO_ANNUAL      price_... for the $190/yr Pro plan (annual)
 *   STRIPE_PRICE_BACKTEST        price_... for the +$10/mo Backtesting add-on
 *   SUPABASE_URL                 the project URL (used to verify the auth token)
 *   SUPABASE_ANON_KEY            anon public key (for the JWT verify call)
 *   SUPABASE_SERVICE_ROLE_KEY    service-role key — used to look up the
 *                                 user's existing stripe_customer_id so
 *                                 resubscribers reuse the same Stripe
 *                                 customer record instead of duplicating.
 */
export async function onRequestPost(context) {
  const { env, request } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // 1. Validate env wiring
    if (!env.STRIPE_SECRET_KEY) {
      return json({ error: 'Server not configured: missing STRIPE_SECRET_KEY' }, 503, cors);
    }
    if (!env.STRIPE_PRICE_PRO) {
      return json({ error: 'Server not configured: missing STRIPE_PRICE_PRO' }, 503, cors);
    }

    // 2. Verify the user via their Supabase access token
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return json({ error: 'Unauthorized' }, 401, cors);

    const userResp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });
    if (!userResp.ok) return json({ error: 'Unauthorized' }, 401, cors);
    const user = await userResp.json();
    if (!user?.id) return json({ error: 'Unauthorized' }, 401, cors);

    // 2.5 Look up the user's existing stripe_customer_id so resubscribers
    //     reuse the same Stripe customer record (one customer = one history,
    //     one consolidated billing view, no duplicates over time).
    let existingCustomerId = null;
    if (env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const profResp = await fetch(
          `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=stripe_customer_id`,
          {
            headers: {
              apikey: env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
          },
        );
        if (profResp.ok) {
          const rows = await profResp.json();
          existingCustomerId = rows?.[0]?.stripe_customer_id || null;
        }
      } catch (e) {
        // Soft-fail: if profile lookup fails, fall back to customer_email
        // and Stripe will create a new customer. Better than blocking checkout.
        console.warn('Profile lookup failed, falling back to customer_email:', e.message);
      }
    }

    // 2.6 Duplicate-subscription guard.
    //
    // If the user already has an active subscription on their Stripe customer,
    // don't let them create a second one — they'd get billed twice. Refuse
    // checkout and direct them to the customer portal instead (to update card,
    // switch interval, or cancel).
    //
    // Blocked statuses: active, trialing, past_due — all are billable / consume
    // a subscription slot. NOT blocked: canceled, incomplete, unpaid, paused —
    // those genuinely need a new subscription to resume.
    //
    // Fail-open: if the Stripe call fails (network, etc.), we proceed with
    // checkout. Better to risk a rare duplicate than block legitimate signups.
    if (existingCustomerId) {
      try {
        const subsResp = await fetch(
          `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(existingCustomerId)}&status=all&limit=10`,
          { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } },
        );
        if (subsResp.ok) {
          const subsData = await subsResp.json();
          const blocked = new Set(['active', 'trialing', 'past_due']);
          const hasActive = (subsData.data || []).some(s => blocked.has(s.status));
          if (hasActive) {
            return json({
              error: 'already_subscribed',
              message: "You're already subscribed. Open the Customer Portal to switch plan, update your card, or cancel.",
            }, 409, cors);
          }
        }
      } catch (e) {
        // Fail-open intentionally — see comment above.
        console.warn('Subscription check failed, proceeding with checkout:', e.message);
      }
    }

    // 3. Parse body
    let body = {};
    try { body = await request.json(); } catch {}
    const addBacktesting = !!body.addBacktesting;

    // 3.5 Resolve billing interval → price id
    //
    // Validate strictly: only 'monthly' or 'annual' are allowed. Any other
    // value (or missing) defaults to monthly. This prevents a malformed
    // request from accidentally selecting an unconfigured/wrong price.
    const interval = body.interval === 'annual' ? 'annual' : 'monthly';
    const priceId  = interval === 'annual'
      ? env.STRIPE_PRICE_PRO_ANNUAL
      : env.STRIPE_PRICE_PRO;
    if (!priceId) {
      // Branch the error message based on which interval was missing, so if
      // anyone refactors the early monthly-validation block away, this still
      // surfaces a sensible message.
      return json({
        error: interval === 'annual'
          ? 'Annual pricing not configured yet — please use monthly for now.'
          : 'Server not configured: missing price.',
      }, 503, cors);
    }

    // 4. Build line items
    //
    // Backtesting is currently "Coming soon" — even if the request body asks
    // for it, we don't add the line item. Defense in depth: prevents anyone
    // from being charged for a feature that doesn't exist yet, even if the
    // frontend regresses or someone POSTs to this endpoint directly.
    // When backtesting ships, restore the original `if (addBacktesting...)` block.
    const lineItems = [{ price: priceId, quantity: 1 }];
    void addBacktesting; // intentionally ignored until feature ships

    // 5. Resolve return URLs from the Origin header (works in any environment)
    const origin = request.headers.get('origin') || 'https://tradeedge.today';
    const successUrl = `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${origin}/?checkout=cancel`;

    // 6. Create the Stripe Checkout Session via x-www-form-urlencoded REST call
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('success_url', successUrl);
    params.append('cancel_url',  cancelUrl);
    params.append('client_reference_id', user.id);
    if (existingCustomerId) {
      // Reuse the user's existing Stripe customer record
      params.append('customer', existingCustomerId);
    } else if (user.email) {
      // First-time subscriber: prefill the email so Checkout doesn't ask
      params.append('customer_email', user.email);
    }
    params.append('allow_promotion_codes', 'true');
    params.append('billing_address_collection', 'auto');
    params.append('subscription_data[metadata][user_id]', user.id);
    if (addBacktesting) {
      params.append('subscription_data[metadata][has_backtesting]', 'true');
    }
    // 7-day free trial for FIRST-TIME subscribers only.
    //
    // Returning customers (anyone who has had any past subscription on this
    // Supabase account) get charged immediately on resub — prevents trial
    // abuse via same-account cancel→resub cycles. We detect "returning"
    // by the presence of an existing stripe_customer_id in their profile
    // (set by the webhook on first successful subscription).
    //
    // Multi-account abuse (different Supabase user, same card) is a
    // separate Layer 2 problem — would need card fingerprint tracking.
    if (!existingCustomerId) {
      params.append('subscription_data[trial_period_days]', '7');
    }
    lineItems.forEach((li, i) => {
      params.append(`line_items[${i}][price]`, li.price);
      params.append(`line_items[${i}][quantity]`, String(li.quantity));
    });

    const stripeResp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await stripeResp.json();
    if (!stripeResp.ok) {
      return json({ error: data?.error?.message || `Stripe HTTP ${stripeResp.status}` }, 502, cors);
    }
    return json({ url: data.url, id: data.id }, 200, cors);
  } catch (e) {
    return json({ error: e.message || String(e) }, 500, cors);
  }
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers });
}
