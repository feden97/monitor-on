/**
 * Cloudflare Pages Function as a PROXY to data912.com
 * Handles GET/POST requests and bypasses CORS.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Extract the relative path after /api/
  // Example: /api/live/arg_corp -> /live/arg_corp
  const apiPath = url.pathname.replace(/^\/api/, '');
  const targetUrl = `https://data912.com${apiPath}${url.search}`;

  // Handle preflight (OPTIONS)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  // --- Caching Strategy ---
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  
  // Try to get from cache first
  let response = await cache.match(cacheKey);

  if (!response) {
    // If not in cache, fetch from target
    const newHeaders = new Headers(request.headers);
    newHeaders.set('Host', 'data912.com');
    newHeaders.delete('Referer'); // Some APIs block based on referer
    
    try {
      response = await fetch(targetUrl, {
        method: request.method,
        headers: newHeaders,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.clone().arrayBuffer() : null,
        redirect: 'follow',
      });

      // We only cache successful responses
      if (response.ok) {
        response = new Response(response.body, response);
        // Cache for 10 seconds (standard for financial instruments)
        response.headers.set('Cache-Control', 'public, s-maxage=10');
        context.waitUntil(cache.put(cacheKey, response.clone()));
      }
    } catch (error) {
      return new Response(`Proxy Error: ${error.message}`, { status: 500 });
    }
  }

  // Final response with CORS headers
  const finalResponse = new Response(response.body, response);
  finalResponse.headers.set('Access-Control-Allow-Origin', '*');
  finalResponse.headers.set('X-Proxy-Destination', targetUrl);
  
  return finalResponse;
}
