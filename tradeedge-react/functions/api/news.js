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

  // Edge cache lookup — keyed on full URL incl. query
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  let articles = [];
  let provider = '';
  try {
    if (env.MARKETAUX_TOKEN) {
      articles = await fetchMarketaux(env.MARKETAUX_TOKEN, q);
      provider = 'marketaux';
    } else if (env.NEWSAPI_KEY) {
      articles = await fetchNewsAPI(env.NEWSAPI_KEY, q);
      provider = 'newsapi';
    } else {
      return json({ error: 'No news provider configured. Set MARKETAUX_TOKEN or NEWSAPI_KEY.' }, 503);
    }
  } catch (e) {
    return json({ error: e.message || 'News fetch failed' }, 502);
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
