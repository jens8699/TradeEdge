/**
 * Cloudflare Pages Function — Stripe Customer Portal session.
 * POST /api/stripe-portal
 *
 * Headers: Authorization: Bearer <supabase_access_token>
 *
 * Returns: { url: 'https://billing.stripe.com/p/session/...' }
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY  (to look up profiles.stripe_customer_id)
 */
export async function onRequestPost(context) {
  const { env, request } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    if (!env.STRIPE_SECRET_KEY) {
      return json({ error: 'Server not configured' }, 503, cors);
    }

    // Auth
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return json({ error: 'Unauthorized' }, 401, cors);

    const userResp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userResp.ok) return json({ error: 'Unauthorized' }, 401, cors);
    const user = await userResp.json();
    if (!user?.id) return json({ error: 'Unauthorized' }, 401, cors);

    // Look up the Stripe customer ID for this user from their profile
    const profResp = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=stripe_customer_id`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!profResp.ok) return json({ error: 'Profile lookup failed' }, 500, cors);
    const rows = await profResp.json();
    const customerId = rows?.[0]?.stripe_customer_id;
    if (!customerId) {
      return json({ error: 'No Stripe customer on file. Subscribe first.' }, 400, cors);
    }

    // Create a portal session
    const origin = request.headers.get('origin') || 'https://tradeedge.today';
    const params = new URLSearchParams();
    params.append('customer', customerId);
    params.append('return_url', `${origin}/?from=portal`);

    const portalResp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await portalResp.json();
    if (!portalResp.ok) {
      return json({ error: data?.error?.message || `Stripe HTTP ${portalResp.status}` }, 502, cors);
    }
    return json({ url: data.url }, 200, cors);
  } catch (e) {
    return json({ error: e.message || String(e) }, 500, cors);
  }
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers });
}
