export const MARKET_TIME_ZONE = 'America/Argentina/Buenos_Aires'

/** Financial civil date follows the market, independently of browser zone. */
export function marketDateKey(instant = new Date()) {
  const date = instant instanceof Date ? instant : new Date(instant)
  if (!Number.isFinite(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: MARKET_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = (type) => parts.find((value) => value.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
