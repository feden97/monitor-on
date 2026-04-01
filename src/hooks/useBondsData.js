import { usePollingResource } from './usePollingResource'

const API_URL = '/api/live/arg_corp'
const REFRESH_INTERVAL = 10_000

function areBondListsEqual(previous = [], next = []) {
  if (previous === next) return true
  if (!Array.isArray(previous) || !Array.isArray(next)) return false
  if (previous.length !== next.length) return false

  for (let index = 0; index < previous.length; index += 1) {
    const prevBond = previous[index]
    const nextBond = next[index]

    if (
      prevBond.symbol !== nextBond.symbol ||
      prevBond.q_bid !== nextBond.q_bid ||
      prevBond.px_bid !== nextBond.px_bid ||
      prevBond.px_ask !== nextBond.px_ask ||
      prevBond.q_ask !== nextBond.q_ask ||
      prevBond.v !== nextBond.v ||
      prevBond.q_op !== nextBond.q_op ||
      prevBond.c !== nextBond.c ||
      prevBond.pct_change !== nextBond.pct_change
    ) {
      return false
    }
  }

  return true
}

function transformBonds(json) {
  if (!json || !Array.isArray(json)) return []
  
  return json
    .filter((row) => row.symbol && (row.symbol.endsWith('O') || row.symbol.endsWith('D')))
    .map((row) => ({
      symbol: row.symbol ?? '—',
      q_bid: row.q_bid ?? null,
      px_bid: row.px_bid ?? null,
      px_ask: row.px_ask ?? null,
      q_ask: row.q_ask ?? null,
      v: row.v ?? null,
      q_op: row.q_op ?? null,
      c: row.c ?? null,
      pct_change: row.pct_change ?? null,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
}

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
