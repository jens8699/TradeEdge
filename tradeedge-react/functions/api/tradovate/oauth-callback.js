// Cloudflare Pages Function — Tradovate OAuth callback
// Exchanges auth code for access token server-side (protects client_secret)
// Set TRADOVATE_CLIENT_ID and TRADOVATE_CLIENT_SECRET in Cloudflare Pages env vars

export async function onRequestGet(context) {
  const url    = new URL(context.request.url);
  const code   = url.searchParams.get('code');
  const state  = url.searchParams.get('state') || '';
  const error  = url.searchParams.get('error');

  const clientId     = context.env.TRADOVATE_CLIENT_ID;
  const clientSecret = context.env.TRADOVATE_CLIENT_SECRET;
  const isDemo       = state.includes('demo');
  const redirectUri  = `${url.origin}/api/tradovate/oauth-callback`;

  // If Tradovate returned an error, redirect back with it
  if (error || !code) {
    return Response.redirect(`${url.origin}/?tab=connections&oauth_error=${encodeURIComponent(error || 'no_code')}`, 302);
  }

  // If client credentials not configured yet, redirect with helpful error
  if (!clientId || !clientSecret) {
    return Response.redirect(
      `${url.origin}/?tab=connections&oauth_error=${encodeURIComponent('Tradovate OAuth not configured — add TRADOVATE_CLIENT_ID and TRADOVATE_CLIENT_SECRET to Cloudflare Pages env vars')}`,
      302
    );
  }

  try {
    const base = isDemo ? 'https://demo.tradovateapi.com/v1' : 'https://live.tradovateapi.com/v1';

    const tokenRes = await fetch(`${base}/auth/oauthtoken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'authorization_code',
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      const msg = tokenData.error_description || tokenData.error || 'Token exchange failed';
      return Response.redirect(
        `${url.origin}/?tab=connections&oauth_error=${encodeURIComponent(msg)}`,
        302
      );
    }

    // Pass token back to the app via URL fragment (never hits server)
    const params = new URLSearchParams({
      access_token:    tokenData.access_token,
      expiration_time: tokenData.expiration_time || '',
      user_id:         tokenData.userId || '',
      is_demo:         isDemo ? '1' : '0',
    });

    return Response.redirect(
      `${url.origin}/?tab=connections&oauth_success=1#tv_token=${params.toString()}`,
      302
    );
  } catch (err) {
    return Response.redirect(
      `${url.origin}/?tab=connections&oauth_error=${encodeURIComponent(err.message || 'Unknown error')}`,
      302
    );
  }
}
