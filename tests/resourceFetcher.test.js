import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createResourceFetcher } from '../src/lib/resourceFetcher.js'

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

test('manual refresh and polling share the same pending request', async (t) => {
  const upstream = deferred()
  const fetchMock = t.mock.method(globalThis, 'fetch', () => upstream.promise)
  const successes = []
  const resource = createResourceFetcher({ url: '/quotes', onSuccess: (data) => successes.push(data) })
  t.after(() => resource.dispose())

  const first = resource.refresh()
  assert.equal(resource.refresh(), first)
  assert.equal(fetchMock.mock.callCount(), 1)
  upstream.resolve(Response.json([1, 2]))
  assert.deepEqual(await first, [1, 2])
  assert.deepEqual(successes, [[1, 2]])
})

test('disposing cancels old work without changing the next resource state', async (t) => {
  const upstream = deferred()
  let signal
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    signal = options.signal
    return upstream.promise
  })
  const events = []
  const resource = createResourceFetcher({
    url: '/old',
    onSuccess: () => events.push('success'),
    onError: () => events.push('error'),
    onSettled: () => events.push('settled'),
  })
  const pending = resource.refresh()
  resource.dispose()
  assert.equal(signal.aborted, true)
  upstream.resolve(Response.json({ stale: true }))
  await assert.rejects(pending, { name: 'AbortError' })
  assert.deepEqual(events, [])
  assert.equal(await resource.refresh(), null)
})

test('a timed out request reports an error and a subsequent refresh can recover', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const fetchMock = t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }))
  const errors = []
  const resource = createResourceFetcher({ url: '/quotes', timeoutMs: 50, onError: (err) => errors.push(err) })
  t.after(() => resource.dispose())
  const pending = resource.refresh()
  const rejected = assert.rejects(pending, { name: 'AbortError' })
  t.mock.timers.tick(50)
  await rejected
  assert.equal(errors.length, 1)
  fetchMock.mock.mockImplementation(async () => Response.json({ recovered: true }))
  assert.deepEqual(await resource.refresh(), { recovered: true })
})

test('invalid responses preserve the previous successful data and can be retried', async (t) => {
  const responses = [Response.json([10]), Response.json({ invalid: true }), new Response('', { status: 503 }), Response.json([20])]
  t.mock.method(globalThis, 'fetch', async () => responses.shift())
  let data = null
  let settled = 0
  const resource = createResourceFetcher({
    url: '/quotes',
    getCallbacks: () => ({ validateData: Array.isArray, transformData: (rows) => rows[0] }),
    onSuccess: (value) => { data = value },
    onSettled: () => { settled += 1 },
  })
  t.after(() => resource.dispose())
  await resource.refresh()
  await assert.rejects(resource.refresh(), /Formato de respuesta/)
  assert.equal(data, 10)
  await assert.rejects(resource.refresh(), /HTTP 503/)
  assert.equal(data, 10)
  await resource.refresh()
  assert.equal(data, 20)
  assert.equal(settled, 4)
})
