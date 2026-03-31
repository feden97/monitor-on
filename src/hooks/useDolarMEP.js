import { usePollingResource } from './usePollingResource'

const DOLAR_API_URL = '/cripto/api/dolar'
const REFRESH_INTERVAL = 60_000

export function useDolarMEP() {
  const resource = usePollingResource({
    url: DOLAR_API_URL,
    intervalMs: REFRESH_INTERVAL,
    areEqual: (previous, next) =>
      previous?.value === next?.value && previous?.timestamp === next?.timestamp,
    transformData: (data) => {
      if (!data?.mep) {
        return null
      }

      const rawMep = data.mep.al30?.['24hs']
      const value = typeof rawMep === 'object'
        ? rawMep.price
        : (rawMep || data.mep.al30?.price || null)

      if (!value) {
        return null
      }

      return {
        value,
        timestamp: data.time ? data.time * 1000 : Date.now(),
      }
    },
    getErrorMessage: (err) => err?.message || 'No se pudo obtener el dólar MEP.',
  })

  return {
    mep: resource.data,
    loading: resource.loading,
    error: resource.error,
    lastUpdated: resource.lastUpdated,
    refresh: resource.refresh,
  }
}
