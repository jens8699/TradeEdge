// Cloudflare Pages Function — proxies Tradovate account list.
// Auth-gated: Supabase token in X-Supabase-Auth header, Tradovate token in
// Authorization header (passed straight through to Tradovate).
export async function onRequestGet(context) {
  try {
    const { env, request } = context;
    const sbToken = request.headers.get('X-Supabase-Auth') || '';
    if (!sbToken || !env?.SUPABASE_URL || !env?.SUPABASE_ANON_KEY) {
      return Response.json({ errorText: 'Unauthorized' }, { status: 401 });
    }
    const verify = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${sbToken}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!verify.ok) return Response.json({ errorText: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const isDemo = url.searchParams.get('isDemo') === 'true';
    const tvAuth = request.headers.get('Authorization') || '';

    const base = isDemo
      ? 'https://demo.tradovateapi.com/v1'
      : 'https://live.tradovateapi.com/v1';

    const res = await fetch(`${base}/account/list`, {
      headers: {
        Authorization: tvAuth,
        Accept: 'application/json',
      },
    });

    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json({ errorText: err.message || 'Proxy error' }, { status: 500 });
  }
}
