const QUOTE_FIELDS = ['q_bid', 'px_bid', 'px_ask', 'q_ask', 'v', 'q_op', 'c', 'pct_change']
const QUOTE_CONTEXT_FIELDS = ['source', 'marketTimestamp', 'priceType', 'faceValueBasis', 'settlementTerm']
const SYMBOL_COLLATOR = new Intl.Collator('es-AR')

function finiteNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** Only an explicitly identified market timestamp with a zone is meaningful.
 * Never reinterpret a fetch time, date-only value or ambiguous numeric epoch.
 */
export function normalizeMarketTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null
  const civil = value.slice(0, 10)
  const civilTime = Date.parse(`${civil}T00:00:00Z`)
  if (!Number.isFinite(civilTime) || new Date(civilTime).toISOString().slice(0, 10) !== civil) return null
  const milliseconds = Date.parse(value)
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null
}

export function transformBonds(rows) {
  return rows
    .filter((row) => typeof row?.symbol === 'string' && /[OD]$/.test(row.symbol))
    .map((row) => ({
      symbol: row.symbol,
      ...Object.fromEntries(QUOTE_FIELDS.map((field) => [field, finiteNumber(row[field])])),
      source: 'data912',
      // The present data912 adapter does not infer these from ticker suffixes
      // or response time. Explicit fields support future documented adapters.
      marketTimestamp: normalizeMarketTimestamp(row.marketTimestamp),
      priceType: ['clean', 'dirty'].includes(row.priceType) ? row.priceType : 'unknown',
      faceValueBasis: ['original', 'residual'].includes(row.faceValueBasis) ? row.faceValueBasis : 'unknown',
      settlementTerm: typeof row.settlementTerm === 'string' && row.settlementTerm.trim() ? row.settlementTerm : null,
    }))
    .sort((a, b) => SYMBOL_COLLATOR.compare(a.symbol, b.symbol))
}

export function areBondListsEqual(previous, next) {
  if (previous === next) return true
  if (!Array.isArray(previous) || !Array.isArray(next) || previous.length !== next.length) return false
  return previous.every((row, index) => row.symbol === next[index].symbol &&
    [...QUOTE_FIELDS, ...QUOTE_CONTEXT_FIELDS].every((field) => row[field] === next[index][field]))
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
