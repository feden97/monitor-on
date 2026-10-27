const QUOTE_FIELDS = ['q_bid', 'px_bid', 'px_ask', 'q_ask', 'v', 'q_op', 'c', 'pct_change']
const SYMBOL_COLLATOR = new Intl.Collator('es-AR')

function finiteNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function transformBonds(rows) {
  return rows
    .filter((row) => typeof row?.symbol === 'string' && /[OD]$/.test(row.symbol))
    .map((row) => ({
      symbol: row.symbol,
      ...Object.fromEntries(QUOTE_FIELDS.map((field) => [field, finiteNumber(row[field])])),
    }))
    .sort((a, b) => SYMBOL_COLLATOR.compare(a.symbol, b.symbol))
}

export function areBondListsEqual(previous, next) {
  if (previous === next) return true
  if (!Array.isArray(previous) || !Array.isArray(next) || previous.length !== next.length) return false
  return previous.every((row, index) => row.symbol === next[index].symbol &&
    QUOTE_FIELDS.every((field) => row[field] === next[index][field]))
}

export function transformMepData(data) {
  const quote = data?.mep?.al30?.['24hs']
  const price = finiteNumber(typeof quote === 'object' ? quote?.price : quote)
  const value = price > 0 ? price : finiteNumber(data?.mep?.al30?.price)
  if (!(value > 0)) throw new Error('La respuesta no contiene una cotización MEP válida.')

  const seconds = finiteNumber(data.time)
  return { value, timestamp: seconds > 0 ? seconds * 1000 : Date.now() }
}

export function transformRpData(data) {
  const value = finiteNumber(data?.valor)
  if (value == null || value < 0) throw new Error('La respuesta no contiene un riesgo país válido.')
  return { value, timestamp: data.fecha }
}
