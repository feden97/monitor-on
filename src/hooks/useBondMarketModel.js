import { useEffect, useMemo, useRef } from 'react'
import bondProspectos from '../data/bondProspectos.json'
import { formatLocalDate, getSettlementDate } from '../utils/bondEngine.js'
import { buildBondMarketModel } from '../utils/bondModel.js'

export function useBondMarketModel(bonds) {
  const previousMetrics = useRef(new Map())
  const todayKey = formatLocalDate(new Date())
  const model = useMemo(() => {
    const today = new Date(`${todayKey}T00:00:00`)
    return buildBondMarketModel(bonds, bondProspectos, getSettlementDate(today), today, previousMetrics.current)
  }, [bonds, todayKey])

  useEffect(() => {
    previousMetrics.current = model.metricsCache
  }, [model])

  return model
}
