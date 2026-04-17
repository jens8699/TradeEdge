// Cloudflare Pages Function — proxies Tradovate auth to avoid CORS
export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
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
