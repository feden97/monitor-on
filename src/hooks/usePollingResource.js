import { useCallback, useEffect, useRef, useState } from 'react'

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
  const mountedRef = useRef(false)
  const latestDataRef = useRef(initialData)

  // Use refs for callbacks to avoid re-triggering fetchResource on every render
  const callbacksRef = useRef({ transformData, validateData, getErrorMessage, areEqual })
  callbacksRef.current = { transformData, validateData, getErrorMessage, areEqual }

  const fetchResource = useCallback(async (isInitial = false) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    if (isInitial) {
      setLoading(true)
    }

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}: ${response.statusText}`)
      }

      const json = await response.json()

      const {
        validateData: validate,
        transformData: transform,
        areEqual: compare,
      } = callbacksRef.current

      if (validate && !validate(json)) {
        throw new Error('Formato de respuesta inesperado.')
      }

      const nextData = transform ? transform(json) : json

      if (mountedRef.current) {
        setError(null)

        const hasChanged = !compare || !compare(latestDataRef.current, nextData)

        if (hasChanged) {
          latestDataRef.current = nextData
          setData(nextData)
          setLastUpdated(new Date())
        }
      }

      return nextData
    } catch (err) {
      const { getErrorMessage: getErrorMsg } = callbacksRef.current
      const nextError = getErrorMsg
        ? getErrorMsg(err)
        : (err?.message || 'Error desconocido al obtener datos.')

      if (mountedRef.current) {
        setError(nextError)
      }

      throw err
    } finally {
      clearTimeout(timeoutId)

      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [url, timeoutMs]) // Stripped callbacks from dependencies

  useEffect(() => {
    mountedRef.current = true
    fetchResource(true).catch(() => {})

    return () => {
      mountedRef.current = false
    }
  }, [fetchResource])

  useEffect(() => {
    if (!intervalMs) {
      return undefined
    }

    const id = setInterval(() => {
      fetchResource(false).catch(() => {})
    }, intervalMs)

    return () => clearInterval(id)
  }, [fetchResource, intervalMs])

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh: () => fetchResource(false),
  }
}
