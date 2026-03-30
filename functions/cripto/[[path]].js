/**
 * Cloudflare Pages Function as a PROXY to criptoya.com
 * Handles GET requests for Dólar MEP data.
 */
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Extract the relative path after /cripto/
  // Example: /cripto/api/dolar -> /api/dolar
  const apiPath = url.pathname.replace(/^\/cripto/, '');
  const targetUrl = `https://criptoya.com${apiPath}${url.search}`;

  // Handle preflight (OPTIONS)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }
    });
  }

  try {
    // Forward the request to CriptoYa
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Cloudflare Worker Proxy',
      }
    });

    // Create a new response with CORS headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('X-Proxy-Source', 'CriptoYa');

    // CriptoYa has a rate limit (120 RPM), so we add some base caching (30s)
    if (response.ok) {
      newResponse.headers.set('Cache-Control', 'public, s-maxage=30');
    }

    return newResponse;
  } catch (error) {
    return new Response(`Proxy Error (CriptoYa): ${error.message}`, { status: 500 });
  }
}
