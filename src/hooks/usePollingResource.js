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

      if (validateData && !validateData(json)) {
        throw new Error('Formato de respuesta inesperado.')
      }

      const nextData = transformData ? transformData(json) : json

      if (mountedRef.current) {
        setError(null)

        const hasChanged = !areEqual || !areEqual(latestDataRef.current, nextData)

        if (hasChanged) {
          latestDataRef.current = nextData
          setData(nextData)
          setLastUpdated(new Date())
        }
      }

      return nextData
    } catch (err) {
      const nextError = getErrorMessage
        ? getErrorMessage(err)
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
  }, [areEqual, getErrorMessage, timeoutMs, transformData, url, validateData])

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
    refresh: () => fetchResource(true),
  }
}
