import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { TextDecoder } from 'node:util'
import { onRequest as apiProxy } from '../functions/api/[[path]].js'
import { onRequest as criptoProxy } from '../functions/cripto/[[path]].js'
import { onRequest as argdataProxy } from '../functions/argdata/[[path]].js'
import { createProxy } from '../server/proxy.js'

const originalFetch = globalThis.fetch
const originalCaches = globalThis.caches

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalCaches === undefined) delete globalThis.caches
  else globalThis.caches = originalCaches
})

function context(path, options) {
  const pending = []
  return {
    request: new Request(`https://monitor.example${path}`, options),
    waitUntil: (promise) => pending.push(promise),
    pending,
  }
}

test('each route preserves its upstream path, query, cache TTL and identification', async () => {
  const cases = [
    [apiProxy, '/api/live/arg_corp?market=on', 'https://data912.com/live/arg_corp?market=on', 10, null],
    [criptoProxy, '/cripto/api/dolar', 'https://criptoya.com/api/dolar', 30, 'CriptoYa'],
    [argdataProxy, '/argdata/v1/finanzas/indices/riesgo-pais/ultimo', 'https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo', 300, 'ArgentinaDatos'],
  ]
  for (const [handler, path, target, ttl, source] of cases) {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, target)
      assert.equal(options.method, 'GET')
      return Response.json({ value: 123 })
    }
    const response = await handler(context(path))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { value: 123 })
    assert.equal(response.headers.get('Cache-Control'), `public, s-maxage=${ttl}`)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
    assert.equal(response.headers.get('X-Proxy-Source'), source)
    if (!source) assert.equal(response.headers.get('X-Proxy-Destination'), target)
  }
})

test('preflight and unsupported methods do not fetch or touch the cache', async () => {
  globalThis.fetch = () => assert.fail('Unexpected upstream request')
  globalThis.caches = { get default() { return assert.fail('Unexpected cache access') } }
  const preflight = await apiProxy(context('/api/live/arg_corp', { method: 'OPTIONS' }))
  assert.equal(preflight.status, 200)
  assert.equal(preflight.headers.get('Access-Control-Allow-Methods'), 'GET, HEAD, POST, OPTIONS')
  const denied = await criptoProxy(context('/cripto/api/dolar', { method: 'POST' }))
  assert.equal(denied.status, 405)
  assert.equal(denied.headers.get('Allow'), 'GET, HEAD, OPTIONS')
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), '*')
})

test('POST forwards its body and content type without caching or leaking site credentials', async () => {
  globalThis.caches = { get default() { return assert.fail('POST must not use the cache') } }
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.method, 'POST')
    assert.equal(new TextDecoder().decode(options.body), '{"symbol":"TESTD"}')
    assert.equal(options.headers.get('Content-Type'), 'application/json')
    for (const name of ['Cookie', 'Authorization', 'Host', 'Referer']) {
      assert.equal(options.headers.get(name), null)
    }
    return Response.json({ ok: true })
  }
  const response = await apiProxy(context('/api/orders', {
    method: 'POST',
    body: '{"symbol":"TESTD"}',
    headers: {
      'Content-Type': 'application/json',
      Cookie: 'session=private',
      Authorization: 'Bearer private',
      Referer: 'https://monitor.example',
    },
  }))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), null)
})

test('GET cache hit avoids the upstream request', async () => {
  globalThis.fetch = () => assert.fail('Unexpected upstream request')
  globalThis.caches = { default: {
    match: async (key) => {
      assert.equal(key.method, 'GET')
      assert.equal(key.url, 'https://monitor.example/api/live/arg_corp')
      return Response.json({ cached: true })
    },
  } }
  const response = await apiProxy(context('/api/live/arg_corp'))
  assert.deepEqual(await response.json(), { cached: true })
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
})

test('successful GET cache writes use independent response bodies', async () => {
  let cached
  globalThis.fetch = async () => Response.json({ value: 42 })
  globalThis.caches = { default: {
    match: async () => undefined,
    put: async (_key, response) => { cached = await response.json() },
  } }
  const ctx = context('/api/live/arg_corp')
  const response = await apiProxy(ctx)
  assert.deepEqual(await response.json(), { value: 42 })
  await Promise.all(ctx.pending)
  assert.deepEqual(cached, { value: 42 })
})

test('cache failures do not discard valid upstream data', async () => {
  globalThis.fetch = async () => Response.json({ value: 42 })
  globalThis.caches = { default: {
    match: async () => { throw new Error('Cache offline') },
    put: async () => { throw new Error('Cache offline') },
  } }
  const ctx = context('/api/live/arg_corp')
  const response = await apiProxy(ctx)
  assert.deepEqual(await response.json(), { value: 42 })
  await Promise.all(ctx.pending)
})

test('errors and private responses are never cached', async () => {
  globalThis.caches = { default: {
    match: async () => undefined,
    put: () => assert.fail('Unexpected cache write'),
  } }
  for (const options of [
    { status: 429 },
    { headers: { 'Cache-Control': 'private, max-age=5' } },
    { headers: { 'Cache-Control': 'no-store' } },
    { headers: { 'Set-Cookie': 'session=private' } },
    { headers: { Vary: '*' } },
  ]) {
    globalThis.fetch = async () => new Response('upstream body', options)
    const ctx = context('/api/live/arg_corp')
    const response = await apiProxy(ctx)
    assert.equal(response.status, options.status || 200)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
    assert.equal(ctx.pending.length, 0)
  }
})

test('network failures include CORS and a gateway error status', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed') }
  const response = await argdataProxy(context('/argdata/v1/test'))
  assert.equal(response.status, 502)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
  assert.equal(response.headers.get('X-Proxy-Source'), 'ArgentinaDatos')
})

test('upstream timeout aborts fetch and returns 504', async () => {
  const handler = createProxy({ prefix: '/api', origin: 'https://data912.com', cacheSeconds: 10, timeoutMs: 5 })
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
  const response = await handler(context('/api/live/arg_corp'))
  assert.equal(response.status, 504)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
})

test('HEAD requests preserve the method and return no body', async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.method, 'HEAD')
    return new Response(null, { headers: { 'Content-Type': 'application/json' } })
  }
  const response = await criptoProxy(context('/cripto/api/dolar', { method: 'HEAD' }))
  assert.equal(response.status, 200)
  assert.equal(await response.text(), '')
})

test('timeout also cancels a stalled body after successful headers', async () => {
  const handler = createProxy({ prefix: '/api', origin: 'https://data912.com', cacheSeconds: 10, timeoutMs: 5 })
  globalThis.fetch = async (_url, { signal }) => ({
    ok: true,
    status: 200,
    body: {},
    arrayBuffer: () => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }),
  })
  const response = await handler(context('/api/live/arg_corp'))
  assert.equal(response.status, 504)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
})
