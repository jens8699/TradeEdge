/**
 * Cloudflare Pages Function — Market news proxy.
 * GET /api/news[?q=AAPL]
 *
 * Returns fresh US-market news from Marketaux (primary) or NewsAPI (fallback).
 * Edge-cached 10 min via Cloudflare's `caches.default` so all users share the
 * same payload — keeps free-tier API quotas alive.
 *
 * Required env vars (set at least one):
 *   MARKETAUX_TOKEN    free token at https://www.marketaux.com (100 reqs/day)
 *   NEWSAPI_KEY        fallback, https://newsapi.org (100 reqs/day on free)
 *
 * Response shape:
 *   {
 *     articles: [{
 *       title, summary, source, url, image, publishedAt,
 *       tickers: ["AAPL", "MSFT"],
 *       sentiment: -1.0 .. 1.0   // 0 if unknown
 *     }],
 *     provider: "marketaux" | "newsapi",
 *     fetchedAt: ISO timestamp
 *   }
 */

const CACHE_TTL_SEC = 600; // 10 min — covers ~1 fetch every 10 min worst-case

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);

  // Build a sanitized cache key that ONLY includes the q param (and the
  // canonical origin). Without this, an attacker could vary unknown query
  // params (?z=1, ?z=2, ...) to bypass the cache and exhaust our Marketaux
  // free-tier quota (100 reqs/day) in minutes — breaking news for legit users.
  const canonicalUrl = new URL(url.pathname, url.origin);
  if (q) canonicalUrl.searchParams.set('q', q);
  const cacheKey = new Request(canonicalUrl.toString(), { method: 'GET' });
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  // Try Marketaux first; fall back to NewsAPI when:
  //   (a) Marketaux errors out (quota / outage / network)
  //   (b) Marketaux returns zero articles
  //   (c) Marketaux's newest article is > 24h old (stale cache / quota burn)
  // This is the fix for the "14d ago headlines" issue from the May 13 QA pass.
  // Marketaux's free tier (100 reqs/day) can return stale cached data when
  // exhausted; NewsAPI's free tier (100 reqs/day) is independent so failing
  // over keeps the feature alive.
  let articles = [];
  let provider = '';
  const STALE_AGE_MS = 24 * 60 * 60 * 1000;
  const isStale = (arts) => {
    if (!arts.length) return true;
    const newest = Math.max(
      ...arts.map(a => a.publishedAt ? new Date(a.publishedAt).getTime() : 0)
    );
    return !Number.isFinite(newest) || newest <= 0 || (Date.now() - newest) > STALE_AGE_MS;
  };

  if (env.MARKETAUX_TOKEN) {
    try {
      articles = await fetchMarketaux(env.MARKETAUX_TOKEN, q);
      provider = 'marketaux';
    } catch (e) {
      // Swallow — try the fallback below
      articles = [];
    }
  }

  // Fall back to NewsAPI if Marketaux gave us nothing useful
  if (env.NEWSAPI_KEY && isStale(articles)) {
    try {
      const fallback = await fetchNewsAPI(env.NEWSAPI_KEY, q);
      if (fallback.length > 0 && !isStale(fallback)) {
        articles = fallback;
        provider = 'newsapi';
      }
    } catch (e) {
      // Last-resort: return whatever Marketaux gave us, even if stale.
      // Better stale news than no news for the user.
    }
  }

  if (!provider) {
    // No providers configured at all
    return json({ error: 'No news provider configured. Set MARKETAUX_TOKEN or NEWSAPI_KEY.' }, 503);
  }

  if (articles.length === 0) {
    // Both providers returned empty — surface as a 502 so the client knows
    // to show "couldn't load news" rather than silently render zero items.
    return json({ error: 'No fresh market news available right now. Try again in a few minutes.' }, 502);
  }

  const body = JSON.stringify({
    articles,
    provider,
    fetchedAt: new Date().toISOString(),
  });
  const resp = new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': `public, max-age=${CACHE_TTL_SEC}`,
      'access-control-allow-origin': '*',
    },
  });
  // Don't await put — fire-and-forget so we don't slow the response
  context.waitUntil(caches.default.put(cacheKey, resp.clone()));
  return resp;
}

// ── Marketaux (preferred — finance-native) ────────────────────────────────
async function fetchMarketaux(token, q) {
  const params = new URLSearchParams({
    api_token: token,
    language: 'en',
    limit: '10',
    filter_entities: 'true',
    countries: 'us',
    sort: 'published_desc',
  });
  if (q) {
    params.set('search', q);
  } else {
    // Default: broad market coverage — major industries that move indices
    params.set('industries', 'Technology,Financial,Energy,Healthcare,Industrials,Consumer Cyclical');
  }

  const r = await fetch('https://api.marketaux.com/v1/news/all?' + params.toString());
  if (!r.ok) {
    let msg = `Marketaux ${r.status}`;
    try { const j = await r.json(); if (j.error?.message) msg = j.error.message; } catch {}
    throw new Error(msg);
  }
  const data = await r.json();
  return (data.data || []).map(a => ({
    title:       a.title || '',
    summary:     a.snippet || a.description || '',
    source:      a.source || '',
    url:         a.url || '',
    image:       a.image_url || null,
    publishedAt: a.published_at || null,
    tickers:     (a.entities || [])
                   .filter(e => e.type === 'equity' && e.symbol)
                   .map(e => e.symbol)
                   .slice(0, 4),
    sentiment:   medianSentiment(a.entities),
  }));
}

function medianSentiment(entities) {
  if (!entities || !entities.length) return 0;
  const scores = entities
    .map(e => Number(e.sentiment_score))
    .filter(n => Number.isFinite(n));
  if (!scores.length) return 0;
  scores.sort((a, b) => a - b);
  return scores[Math.floor(scores.length / 2)];
}

// ── NewsAPI (fallback) ────────────────────────────────────────────────────
async function fetchNewsAPI(key, q) {
  const baseParams = new URLSearchParams({
    apiKey: key,
    language: 'en',
    pageSize: '10',
  });

  const url = q
    ? `https://newsapi.org/v2/everything?sortBy=publishedAt&q=${encodeURIComponent(q)}&${baseParams}`
    : `https://newsapi.org/v2/top-headlines?country=us&category=business&${baseParams}`;

  const r = await fetch(url, {
    // NewsAPI's free tier requires a User-Agent
    headers: { 'User-Agent': 'TradeEdge/1.0' },
  });
  if (!r.ok) {
    let msg = `NewsAPI ${r.status}`;
    try { const j = await r.json(); if (j.message) msg = j.message; } catch {}
    throw new Error(msg);
  }
  const data = await r.json();
  return (data.articles || []).map(a => ({
    title:       a.title || '',
    summary:     a.description || '',
    source:      a.source?.name || '',
    url:         a.url || '',
    image:       a.urlToImage || null,
    publishedAt: a.publishedAt || null,
    tickers:     [],
    sentiment:   0,
  }));
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
    },
  });
}
