import { useState, useCallback, useRef } from 'react'

/**
 * Hook to fetch bond metadata from BYMA's ficha técnica endpoint.
 * Caches results in a Map to avoid re-fetching static data.
 *
 * In development, calls go through the Vite proxy.
 * In production (Cloudflare), calls go through /byma/ function.
 */

const BYMA_PROFILE_URL = '/byma/bnown/fichatecnica/especies/general'

export function useBondMetadata() {
  const cacheRef = useRef(new Map())
  const [loading, setLoading] = useState(false)

  /**
   * Fetch metadata for a single bond ticker.
   * Returns cached data if available.
   */
  const fetchMetadata = useCallback(async (symbol) => {
    // Check cache first
    if (cacheRef.current.has(symbol)) {
      return cacheRef.current.get(symbol)
    }

    setLoading(true)

    try {
      const response = await fetch(BYMA_PROFILE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, 'Content-Type': 'application/json' }),
      })

      if (!response.ok) {
        console.warn(`BYMA metadata fetch failed for ${symbol}: ${response.status}`)
        return null
      }

      const result = await response.json()

      if (result.data && result.data.length > 0) {
        const raw = result.data[0]
        const metadata = {
          emisor: raw.emisor || '—',
          isin: raw.codigoIsin || '—',
          fechaEmision: raw.fechaEmision ? raw.fechaEmision.split(' ')[0] : '—',
          fechaVencimiento: raw.fechaVencimiento ? raw.fechaVencimiento.split(' ')[0] : '—',
          moneda: raw.moneda || '—',
          interes: raw.interes || '—',
          formaAmortizacion: raw.formaAmortizacion || '—',
          denominacionMinima: raw.denominacionMinima || 1,
          montoResidual: raw.montoResidual || 0,
          montoNominal: raw.montoNominal || 0,
          tipoGarantia: raw.tipoGarantia || '—',
          denominacion: raw.denominacion || '—',
          ley: raw.paisLey || raw.ley || '—',
        }

        cacheRef.current.set(symbol, metadata)
        return metadata
      }

      return null
    } catch (err) {
      console.warn(`BYMA metadata error for ${symbol}:`, err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Fetch metadata for multiple tickers in parallel.
   */
  const fetchMultiple = useCallback(async (symbols) => {
    const results = new Map()
    const uncached = symbols.filter(s => !cacheRef.current.has(s))

    // Return all cached immediately
    for (const s of symbols) {
      if (cacheRef.current.has(s)) {
        results.set(s, cacheRef.current.get(s))
      }
    }

    if (uncached.length > 0) {
      setLoading(true)
      // Fetch uncached in batches of 5 to avoid overwhelming API
      const batchSize = 5
      for (let i = 0; i < uncached.length; i += batchSize) {
        const batch = uncached.slice(i, i + batchSize)
        const promises = batch.map(s => fetchMetadata(s))
        const batchResults = await Promise.allSettled(promises)

        batchResults.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value) {
            results.set(batch[idx], result.value)
          }
        })
      }
      setLoading(false)
    }

    return results
  }, [fetchMetadata])

  return {
    fetchMetadata,
    fetchMultiple,
    loading,
    cache: cacheRef.current,
  }
}
