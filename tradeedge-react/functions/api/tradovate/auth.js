// Cloudflare Pages Function — proxies Tradovate auth to avoid CORS.
// Auth-gated by Supabase token so this can't be used as an open Tradovate
// proxy from outside the app.
export async function onRequestPost(context) {
  try {
    const { env, request } = context;
    const unauthorized = await requireSupabaseUser(request, env);
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const isDemo = !!body.isDemo;
    delete body.isDemo; // don't forward this field to Tradovate

    const base = isDemo
      ? 'https://demo.tradovateapi.com/v1'
      : 'https://live.tradovateapi.com/v1';

    const res = await fetch(`${base}/auth/accesstokenrequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json({ errorText: err.message || 'Proxy error' }, { status: 500 });
  }
}

// Returns null when the caller is a valid signed-in Supabase user; otherwise
// returns a 401 Response that the handler should return directly.
async function requireSupabaseUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const tvToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  // The frontend reuses this Authorization header for the upstream Tradovate
  // call after auth, so we can't read OUR Supabase token from the same
  // header. Instead we look at a custom header.
  const sbToken = request.headers.get('X-Supabase-Auth') || '';
  if (!sbToken || !env?.SUPABASE_URL || !env?.SUPABASE_ANON_KEY) {
    return Response.json({ errorText: 'Unauthorized' }, { status: 401 });
  }
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${sbToken}`, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!r.ok) return Response.json({ errorText: 'Unauthorized' }, { status: 401 });
  const user = await r.json();
  if (!user?.id) return Response.json({ errorText: 'Unauthorized' }, { status: 401 });
  // Used to silence "unused var" when no other consumer needs tvToken
  void tvToken;
  return null;
}
