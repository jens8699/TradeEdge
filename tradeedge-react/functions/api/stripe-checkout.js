/**
 * Cloudflare Pages Function — Stripe Checkout Session creator.
 * POST /api/stripe-checkout
 *
 * Body: { addBacktesting?: boolean }
 * Headers: Authorization: Bearer <supabase_access_token>
 *
 * Returns: { url: 'https://checkout.stripe.com/...' }
 *
 * Required env vars (Cloudflare Pages → Settings → Env vars):
 *   STRIPE_SECRET_KEY            sk_test_... (or sk_live_...)
 *   STRIPE_PRICE_PRO             price_... for the $19/mo Pro plan
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

    // 3. Parse body
    let body = {};
    try { body = await request.json(); } catch {}
    const addBacktesting = !!body.addBacktesting;

    // 4. Build line items
    //
    // Backtesting is currently "Coming soon" — even if the request body asks
    // for it, we don't add the line item. Defense in depth: prevents anyone
    // from being charged for a feature that doesn't exist yet, even if the
    // frontend regresses or someone POSTs to this endpoint directly.
    // When backtesting ships, restore the original `if (addBacktesting...)` block.
    const lineItems = [{ price: env.STRIPE_PRICE_PRO, quantity: 1 }];
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
    // 7-day free trial — card required at checkout, charged on day 8.
    // Stripe handles all the trial logic (no charge during trial, can cancel
    // anytime without being billed). New subscription = new trial; if a user
    // cancels and resubscribes, they get another trial.
    params.append('subscription_data[trial_period_days]', '7');
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
