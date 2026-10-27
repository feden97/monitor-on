/** Owns one request at a time and cancels its work when the consumer leaves. */
export function createResourceFetcher({
  url,
  timeoutMs = 10_000,
  getCallbacks = () => ({}),
  onSuccess,
  onError,
  onSettled,
}) {
  let active = true
  let pending = null

  function refresh() {
    if (!active) return Promise.resolve(null)
    if (pending) return pending.promise

    const controller = new AbortController()
    const request = {
      controller,
      timeoutId: setTimeout(() => controller.abort(), timeoutMs),
      promise: null,
    }
    pending = request

    request.promise = (async () => {
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}: ${response.statusText}`)
        }

        const json = await response.json()
        controller.signal.throwIfAborted()
        const { validateData, transformData } = getCallbacks()
        if (validateData && !validateData(json)) {
          throw new Error('Formato de respuesta inesperado.')
        }

        const nextData = transformData ? transformData(json) : json
        if (active) onSuccess?.(nextData)
        return nextData
      } catch (error) {
        if (active) onError?.(error)
        throw error
      } finally {
        clearTimeout(request.timeoutId)
        if (pending === request) pending = null
        if (active) onSettled?.()
      }
    })()

    return request.promise
  }

  function dispose() {
    active = false
    if (pending) {
      clearTimeout(pending.timeoutId)
      pending.controller.abort()
      pending = null
    }
  }

  return { refresh, dispose }
}
