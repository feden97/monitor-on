/**
 * Cloudflare Pages Function: Proxy /byma requests to BYMA Open Data API.
 *
 * BYMA requires a session with cookies, so this function:
 * 1. Initializes a session by visiting the dashboard
 * 2. Forwards POST requests with correct headers
 * 3. Caches responses for 1 hour (bond metadata is static)
 */

const BYMA_BASE = 'https://open.bymadata.com.ar';

const BYMA_HEADERS = {
  'Connection': 'keep-alive',
  'Accept': 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
  'Origin': BYMA_BASE,
  'Referer': `${BYMA_BASE}/`,
  'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="96"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  'Accept-Language': 'es-US,es-419;q=0.9,es;q=0.8,en;q=0.7',
};

async function getSessionCookies() {
  // Visit the dashboard to get session cookies
  const initResponse = await fetch(`${BYMA_BASE}/#/dashboard`, {
    headers: { 'User-Agent': BYMA_HEADERS['User-Agent'] },
    redirect: 'follow',
  });

  // Extract Set-Cookie headers
  const cookies = initResponse.headers.getAll?.('set-cookie') ||
                  [initResponse.headers.get('set-cookie')].filter(Boolean);

  // Parse cookie names and values
  return cookies.map(c => c.split(';')[0]).join('; ');
}

export async function onRequest(context) {
  const { request, params } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const apiSubPath = params.path ? params.path.join('/') : '';
  const targetUrl = `${BYMA_BASE}/vanoms-be-core/rest/api/bymadata/free/${apiSubPath}`;

  try {
    // Try cache first (1 hour for bond metadata)
    const cacheUrl = new URL(request.url);
    const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
    const cache = caches.default;
    let response = await cache.match(cacheKey);

    if (!response) {
      // Get session cookies
      const cookies = await getSessionCookies();

      // Read the request body
      const body = await request.text();

      // Make the proxied request
      const proxyResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...BYMA_HEADERS,
          'Cookie': cookies,
        },
        body: body,
      });

      if (proxyResponse.ok) {
        response = new Response(proxyResponse.body, proxyResponse);
        // Cache bond metadata for 1 hour (3600s)
        response.headers.set('Cache-Control', 'public, s-maxage=3600');
        context.waitUntil(cache.put(cacheKey, response.clone()));
      } else {
        response = proxyResponse;
      }
    }

    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', '*');

    return newResponse;
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
