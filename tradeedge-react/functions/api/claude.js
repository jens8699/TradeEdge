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
      model      = 'claude-3-5-sonnet-20241022',
      max_tokens = 1024,
      system,
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages array required' }), {
        status: 400, headers: corsHeaders,
      });
    }

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server not configured (missing ANTHROPIC_API_KEY)' }), {
        status: 503, headers: corsHeaders,
      });
    }

    const payload = { model, max_tokens, messages };
    if (system) payload.system = system;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      status: resp.status, headers: corsHeaders,
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
