import { useCallback, useEffect, useRef, useState } from 'react'
import { createResourceFetcher } from '../lib/resourceFetcher.js'

export function usePollingResource({
  url,
  intervalMs,
  timeoutMs = 10_000,
  initialData = null,
  transformData,
  validateData,
  getErrorMessage,
  areEqual,
}) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const latestDataRef = useRef(initialData)
  const resourceRef = useRef(null)
  const callbacksRef = useRef({ transformData, validateData, getErrorMessage, areEqual })

  useEffect(() => {
    callbacksRef.current = { transformData, validateData, getErrorMessage, areEqual }
  })

  // A separate resource per effect prevents an old response updating a new URL
  // or a StrictMode remount, even if the upstream ignores cancellation.
  useEffect(() => {
    setLoading(true)
    const resource = createResourceFetcher({
      url,
      timeoutMs,
      getCallbacks: () => callbacksRef.current,
      onSuccess(nextData) {
        const compare = callbacksRef.current.areEqual
        if (!compare || !compare(latestDataRef.current, nextData)) {
          latestDataRef.current = nextData
          setData(nextData)
        }
        setError(null)
        setLastUpdated(new Date())
      },
      onError(err) {
        const getMessage = callbacksRef.current.getErrorMessage
        setError(getMessage ? getMessage(err) : err?.message || 'Error desconocido al obtener datos.')
      },
      onSettled: () => setLoading(false),
    })
    resourceRef.current = resource
    resource.refresh().catch(() => {})

    return () => {
      resource.dispose()
      if (resourceRef.current === resource) resourceRef.current = null
    }
  }, [url, timeoutMs])

  const refresh = useCallback(() => resourceRef.current?.refresh() ?? Promise.resolve(null), [])

  useEffect(() => {
    if (!(intervalMs > 0)) return undefined

    function refreshWhenVisible() {
      if (document.visibilityState !== 'hidden') refresh().catch(() => {})
    }

    const id = setInterval(refreshWhenVisible, intervalMs)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refresh, intervalMs])

  return { data, loading, error, lastUpdated, refresh }
}
