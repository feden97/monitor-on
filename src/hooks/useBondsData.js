import { useState, useEffect, useCallback } from 'react'

// Vite proxy rewrites '/api' → 'https://data912.com' (see vite.config.js)
// This avoids browser CORS restrictions during local development.
const API_URL = '/api/live/arg_corp'

// Refresh interval in milliseconds (10 seconds)
const REFRESH_INTERVAL = 10_000

/**
 * Custom hook to fetch and periodically refresh Argentine corporate bond data.
 *
 * @returns {{ data: Array, loading: boolean, error: string|null, lastUpdated: Date|null, refresh: Function }}
 */
export function useBondsData() {
  const [data, setData]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    setError(null)

    try {
      const controller = new AbortController()
      const timeoutId  = setTimeout(() => controller.abort(), 10_000) // 10s timeout

      const response = await fetch(API_URL, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}: ${response.statusText}`)
      }

      const json = await response.json()

      if (!Array.isArray(json)) {
        throw new Error('Formato de respuesta inesperado: se esperaba un array.')
      }

      // Normalise & filter out 'C' tickers and rows with no symbol
      const normalised = json
        .filter((row) => row.symbol && (row.symbol.endsWith('O') || row.symbol.endsWith('D')))
        .map((row) => ({
          symbol:     row.symbol     ?? '—',
          q_bid:      row.q_bid      ?? null,
          px_bid:     row.px_bid     ?? null,
          px_ask:     row.px_ask     ?? null,
          q_ask:      row.q_ask      ?? null,
          v:          row.v          ?? null,
          q_op:       row.q_op       ?? null,
          c:          row.c          ?? null,
          pct_change: row.pct_change ?? null,
        }))

      setData(normalised)
      setLastUpdated(new Date())
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('La solicitud tardó demasiado. Verifique su conexión.')
      } else {
        setError(err.message || 'Error desconocido al obtener datos.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch on mount
  useEffect(() => {
    fetchData(true)
  }, [fetchData])

  // Periodic refresh
  useEffect(() => {
    const id = setInterval(() => fetchData(false), REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [fetchData])

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh: () => fetchData(true),
  }
}
