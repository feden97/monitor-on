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
    const response = await fetch(proxyRequest);

    // Clone the response so we can modify headers if needed (e.g. CORS)
    const newResponse = new Response(response.body, response);
    
    // Add permissive CORS for the current domain just in case
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', '*');

    return newResponse;
  } catch (error) {
    return new Response(`Proxy Error: ${error.message}`, { status: 500 });
  }
}
