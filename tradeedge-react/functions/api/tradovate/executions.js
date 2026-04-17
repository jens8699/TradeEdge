// Cloudflare Pages Function — proxies Tradovate execution reports
export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const isDemo = url.searchParams.get('isDemo') === 'true';
    const auth = context.request.headers.get('Authorization') || '';

    const base = isDemo
      ? 'https://demo.tradovateapi.com/v1'
      : 'https://live.tradovateapi.com/v1';

    const res = await fetch(`${base}/executionReport/list`, {
      headers: {
        Authorization: auth,
        Accept: 'application/json',
      },
    });

    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json({ errorText: err.message || 'Proxy error' }, { status: 500 });
  }
}
