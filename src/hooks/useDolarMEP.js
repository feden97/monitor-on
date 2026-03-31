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
        // Obtenemos el precio directamente, asegurándote de que sea un número
        const rawMep = data.mep.al30?.['24hs']
        const value = typeof rawMep === 'object' ? rawMep.price : (rawMep || data.mep.al30?.price || null)
        
        setMep({
          value: value,
          timestamp: data.time ? data.time * 1000 : Date.now(),
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
