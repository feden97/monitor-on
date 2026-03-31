import { useState, useEffect, useCallback } from 'react'

const RP_API_URL = 'https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo'
// Only fetch once or rarely since it updates once a day
const REFRESH_INTERVAL = 300_000 // 5 minutes

export function useRiesgoPais() {
  const [riesgoPais, setRiesgoPais] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRP = useCallback(async () => {
    try {
      const response = await fetch(RP_API_URL, {
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()

      if (data && data.valor) {
        setRiesgoPais({
          value: data.valor,
          // The API returns "YYYY-MM-DD", we convert it roughly to timestamp to format it later
          timestamp: data.fecha, 
        })
      }
      setError(null)
    } catch (err) {
      console.warn('Riesgo Pais fetch error:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRP()
  }, [fetchRP])

  useEffect(() => {
    const id = setInterval(fetchRP, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [fetchRP])

  return { riesgoPais, loading, error, refresh: fetchRP }
}
