/** Shared by the Cloudflare Pages routes; kept outside functions/ to avoid a route. */
export function createProxy({
  prefix,
  origin,
  source,
  methods = ['GET', 'HEAD'],
  cacheSeconds,
  timeoutMs = 10_000,
  includeDestination = false,
}) {
  const allowedMethods = [...methods, 'OPTIONS'].join(', ')

  return async function onRequest(context) {
    const { request } = context
    const url = new URL(request.url)
    const targetUrl = `${origin}${url.pathname.slice(prefix.length)}${url.search}`
    const headers = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': allowedMethods,
      'Access-Control-Allow-Headers': '*',
    })
    if (source) headers.set('X-Proxy-Source', source)
    if (includeDestination) headers.set('X-Proxy-Destination', targetUrl)

    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Max-Age', '86400')
      return new Response(null, { headers })
    }

    if (!methods.includes(request.method)) {
      headers.set('Allow', allowedMethods)
      return new Response('Method Not Allowed', { status: 405, headers })
    }

    // Cache API only accepts GET. Requests with bodies always bypass the cache.
    const cache = request.method === 'GET' ? globalThis.caches?.default : null
    const cacheKey = cache ? new Request(url.toString(), { method: 'GET' }) : null
    let response
    if (cache) {
      try {
        response = await cache.match(cacheKey)
      } catch {
        // A cache outage must not prevent fetching fresh market data.
      }
    }

    if (!response) {
      const controller = new AbortController()
      const abort = () => controller.abort()
      const timeoutId = setTimeout(abort, timeoutMs)
      request.signal.addEventListener('abort', abort, { once: true })
      if (request.signal.aborted) abort()

      try {
        // Forward only API headers, never the site's cookies or credentials.
        const upstreamHeaders = new Headers({
          Accept: request.headers.get('Accept') || 'application/json',
          'User-Agent': 'Cloudflare Worker Proxy',
        })
        const contentType = request.headers.get('Content-Type')
        if (contentType) upstreamHeaders.set('Content-Type', contentType)

        response = await fetch(targetUrl, {
          method: request.method,
          headers: upstreamHeaders,
          body: request.method === 'POST' ? await request.arrayBuffer() : undefined,
          signal: controller.signal,
          redirect: 'follow',
        })
        // These endpoints return finite JSON payloads. Read the body before
        // clearing the timeout so stalled downloads are cancelled as well.
        if (request.method !== 'HEAD' && response.body) {
          const body = await response.arrayBuffer()
          controller.signal.throwIfAborted()
          response = new Response(body, response)
        }
      } catch {
        const status = controller.signal.aborted ? 504 : 502
        const label = source ? `Proxy Error (${source})` : 'Proxy Error'
        return new Response(`${label}: ${status === 504 ? 'Upstream timeout' : 'Upstream unavailable'}`, {
          status,
          headers,
        })
      } finally {
        clearTimeout(timeoutId)
        request.signal.removeEventListener('abort', abort)
      }

      // Respect upstream responses that must not be shared between visitors.
      const cacheControl = response.headers.get('Cache-Control') || ''
      const isPublicResponse = !/\b(private|no-store|no-cache)\b/i.test(cacheControl)
        && !response.headers.has('Set-Cookie')
        && response.headers.get('Vary')?.trim() !== '*'

      if (request.method === 'GET' && response.status === 200 && isPublicResponse) {
        response = new Response(response.body, response)
        response.headers.set('Cache-Control', `public, s-maxage=${cacheSeconds}`)
        if (cache) {
          // Clone before returning the stream to the caller.
          const cacheResponse = response.clone()
          const cacheWrite = Promise.resolve()
            .then(() => cache.put(cacheKey, cacheResponse))
            .catch(() => {})
          context.waitUntil(cacheWrite)
        }
      }
    }

    const result = new Response(request.method === 'HEAD' ? null : response.body, response)
    for (const [key, value] of headers) result.headers.set(key, value)
    return result
  }
}
