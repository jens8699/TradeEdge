/**
 * Cloudflare Pages Function — Claude proxy
 * POST /api/claude  { messages, model?, max_tokens? }
 *
 * Set env var ANTHROPIC_API_KEY in Cloudflare Pages → Settings → Environment variables.
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
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
