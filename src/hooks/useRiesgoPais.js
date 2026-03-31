import { usePollingResource } from './usePollingResource'

const RP_API_URL = '/argdata/v1/finanzas/indices/riesgo-pais/ultimo'
const REFRESH_INTERVAL = 300_000

export function useRiesgoPais() {
  const resource = usePollingResource({
    url: RP_API_URL,
    intervalMs: REFRESH_INTERVAL,
    areEqual: (previous, next) =>
      previous?.value === next?.value && previous?.timestamp === next?.timestamp,
    transformData: (data) => {
      if (!data?.valor) {
        return null
      }

      return {
        value: data.valor,
        timestamp: data.fecha,
      }
    },
    getErrorMessage: (err) => err?.message || 'No se pudo obtener el riesgo país.',
  })

  return {
    riesgoPais: resource.data,
    loading: resource.loading,
    error: resource.error,
    lastUpdated: resource.lastUpdated,
    refresh: resource.refresh,
  }
}
