import { usePollingResource } from './usePollingResource'
import { transformMepData } from '../utils/marketData.js'

const DOLAR_API_URL = '/cripto/api/dolar'
const REFRESH_INTERVAL = 60_000

const areMepStatesEqual = (previous, next) =>
  previous?.value === next?.value && previous?.timestamp === next?.timestamp

const getMepErrorMessage = (err) => err?.message || 'No se pudo obtener el dólar MEP.'

export function useDolarMEP() {
  const resource = usePollingResource({
    url: DOLAR_API_URL,
    intervalMs: REFRESH_INTERVAL,
    areEqual: areMepStatesEqual,
    transformData: transformMepData,
    getErrorMessage: getMepErrorMessage,
  })

  return {
    mep: resource.data,
    loading: resource.loading,
    error: resource.error,
    lastUpdated: resource.lastUpdated,
    refresh: resource.refresh,
  }
}
