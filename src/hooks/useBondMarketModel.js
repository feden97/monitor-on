import { useEffect, useMemo, useRef, useState } from 'react'
import bondProspectos from '../data/bondProspectos.json'
import { buildBondMarketModel } from '../utils/bondModel.js'
import { marketDateKey } from '../utils/marketClock.js'
import { estimateSettlementDate } from '../utils/settlementReference.js'

export function useBondMarketModel(bonds, { receivedAt = null, fetchError = null } = {}) {
  const previousMetrics = useRef(new Map())
  const [asOf, setAsOf] = useState(() => new Date())
  useEffect(() => {
    const updateClock = () => setAsOf(new Date())
    const interval = setInterval(updateClock, 30_000)
    document.addEventListener('visibilitychange', updateClock)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', updateClock)
    }
  }, [])
  const todayKey = marketDateKey(asOf)
  const model = useMemo(() => {
    const today = new Date(`${todayKey}T00:00:00`)
    const settlementReference = estimateSettlementDate(todayKey)
    const settlement = settlementReference.date ? new Date(`${settlementReference.date}T00:00:00`) : null
    const options = { asOf, receivedAt, fetchError, settlementReference }
    const market = buildBondMarketModel(bonds, bondProspectos, settlement, today, previousMetrics.current, options)
    // Contract evidence remains reachable during a market-provider outage.
    const auditedReference = market.rows.find(row => row.symbol === 'YM34D')
      ?? buildBondMarketModel([{ symbol: 'YM34D', c: null }], bondProspectos, settlement, today, new Map(), options).rows[0]
    return { ...market, auditedReference }
  }, [bonds, todayKey, asOf, receivedAt, fetchError])

  useEffect(() => {
    previousMetrics.current = model.metricsCache
  }, [model])

  return model
}
