/**
 * Cloudflare Pages Function as a proxy to api.argentinadatos.com.
 * Keeps browser requests same-origin and avoids CORS issues.
 */
export async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)
  const apiPath = url.pathname.replace(/^\/argdata/, '')
  const targetUrl = `https://api.argentinadatos.com${apiPath}${url.search}`

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Cloudflare Worker Proxy',
      },
    })

    const proxiedResponse = new Response(response.body, response)
    proxiedResponse.headers.set('Access-Control-Allow-Origin', '*')
    proxiedResponse.headers.set('X-Proxy-Source', 'ArgentinaDatos')

    if (response.ok) {
      proxiedResponse.headers.set('Cache-Control', 'public, s-maxage=300')
    }

    return proxiedResponse
  } catch (error) {
    return new Response(`Proxy Error (ArgentinaDatos): ${error.message}`, { status: 500 })
  }
}
