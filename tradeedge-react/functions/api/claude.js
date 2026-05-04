/**
 * Cloudflare Pages Function — Claude proxy
 * POST /api/claude  { messages, model?, max_tokens? }
 *
 * Headers: Authorization: Bearer <supabase_access_token>
 *
 * Auth-gated so randoms can't drain our Anthropic quota by hitting this
 * endpoint directly. Verifies the caller's Supabase token before forwarding
 * to Anthropic — same pattern as stripe-checkout.js / stripe-portal.js.
 *
 * Set env vars in Cloudflare Pages → Settings → Environment variables:
 *   ANTHROPIC_API_KEY        primary key
 *   ANTHROPIC_API_KEY2       optional fallback key (used on 401/403 from primary)
 *   SUPABASE_URL             https://<proj>.supabase.co
 *   SUPABASE_ANON_KEY        anon public key (for the JWT verify call)
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Verify the user via their Supabase access token. Without this gate the
    // endpoint is a free Claude API for the public — easy way to drain our
    // Anthropic bill in a few minutes of malicious scripting.
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: corsHeaders,
      });
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: 'Server not configured (missing Supabase env)' }), {
        status: 503, headers: corsHeaders,
      });
    }
    const userResp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });
    if (!userResp.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: corsHeaders,
      });
    }
    const user = await userResp.json();
    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: corsHeaders,
      });
    }

    const body = await request.json();
    const {
      messages,
      model      = 'claude-haiku-4-5-20251001',
      max_tokens = 1024,
      system,
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages array required' }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Try ANTHROPIC_API_KEY first; if it 401s (dead/rotated), retry with the
    // backup ANTHROPIC_API_KEY2 so the platform doesn't blackhole on a single
    // expired key.
    const keys = [env.ANTHROPIC_API_KEY, env.ANTHROPIC_API_KEY2].filter(Boolean);
    if (!keys.length) {
      return new Response(JSON.stringify({ error: 'Server not configured (missing ANTHROPIC_API_KEY)' }), {
        status: 503, headers: corsHeaders,
      });
    }

    const payload = { model, max_tokens, messages };
    if (system) payload.system = system;

    let lastResp, lastData;
    for (const apiKey of keys) {
      lastResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      lastData = await lastResp.json().catch(() => ({}));
      if (lastResp.ok) break;
      // Only fall through on auth failures — other errors are real and shouldn't retry
      if (lastResp.status !== 401 && lastResp.status !== 403) break;
    }

    return new Response(JSON.stringify(lastData), {
      status: lastResp.status, headers: corsHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: corsHeaders,
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
