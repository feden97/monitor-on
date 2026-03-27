import { useState, useEffect, useCallback } from 'react'

/**
 * Hook to fetch and periodically refresh Dólar MEP from CriptoYa API.
 * Endpoint: https://criptoya.com/api/dolar
 * Rate limit: 120 RPM, updates every 1 minute.
 */

const DOLAR_API_URL = '/cripto/api/dolar'
const REFRESH_INTERVAL = 60_000 // 60 seconds

export function useDolarMEP() {
  const [mep, setMep] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDolar = useCallback(async () => {
    try {
      const response = await fetch(DOLAR_API_URL, {
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`CriptoYa error: ${response.status}`)
      }

      const data = await response.json()

      if (data && data.mep) {
        setMep({
          buy: data.mep.ci?.bid ?? data.mep.al30?.bid ?? null,
          sell: data.mep.ci?.ask ?? data.mep.al30?.ask ?? null,
          // Fallback: use the first available MEP value
          value: data.mep.ci?.price ?? data.mep.al30?.price ?? null,
        })
      }
      setError(null)
    } catch (err) {
      console.warn('Dólar MEP fetch error:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDolar()
  }, [fetchDolar])

  useEffect(() => {
    const id = setInterval(fetchDolar, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [fetchDolar])

  return { mep, loading, error, refresh: fetchDolar }
}
