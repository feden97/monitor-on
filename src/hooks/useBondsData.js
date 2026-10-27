import { usePollingResource } from './usePollingResource'
import { areBondListsEqual, transformBonds } from '../utils/marketData.js'

const API_URL = '/api/live/arg_corp'
const REFRESH_INTERVAL = 10_000

const getBondsErrorMessage = (err) => {
  if (err?.name === 'AbortError') {
    return 'La solicitud tardó demasiado. Verificá tu conexión.'
  }
  return err?.message || 'Error desconocido al obtener datos.'
}

export function useBondsData() {
  return usePollingResource({
    url: API_URL,
    intervalMs: REFRESH_INTERVAL,
    initialData: [],
    areEqual: areBondListsEqual,
    validateData: Array.isArray,
    transformData: transformBonds,
    getErrorMessage: getBondsErrorMessage,
  })
}
