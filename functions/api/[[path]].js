/**
 * Cloudflare Pages Function: Proxy /api requests to data912.com
 * 
 * This replaces the Vite local proxy in production.
 */
export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);

  // Extract the path after /api/
  // e.g. /api/live/arg_corp -> live/arg_corp
  const apiSubPath = params.path ? params.path.join('/') : '';
  
  // Construct the target URL
  const targetUrl = new URL(`https://data912.com/${apiSubPath}`);
  
  // Append any query parameters from the original request
  url.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  // Create a new request based on the target
  const proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'follow', // Follow redirects from the target API
  });

  // Ensure the Host header matches the target to bypass some server-side checks
  proxyRequest.headers.set('Host', 'data912.com');

  try {
    // Try to find a cached response first
    const cacheUrl = new URL(request.url);
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;
    let response = await cache.match(cacheKey);

    if (!response) {
      // If not in cache, fetch from origin
      response = await fetch(proxyRequest);

      // We only cache successful responses
      if (response.ok) {
        // Create a new response with Cache-Control headers to tell Cloudflare to cache it
        response = new Response(response.body, response);
        response.headers.set('Cache-Control', 'public, s-maxage=10');
        
        // Store in cache
        context.waitUntil(cache.put(cacheKey, response.clone()));
      }
    }

    // Clone the response so we can modify headers for the client
    const newResponse = new Response(response.body, response);
    
    // Standard CORS and security headers
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', '*');
    newResponse.headers.set('X-Proxy-Cache', response.headers.has('CF-Cache-Status') ? 'HIT' : 'MISS');

    return newResponse;
  } catch (error) {
    return new Response(`Proxy Error: ${error.message}`, { status: 500 });
  }
}
