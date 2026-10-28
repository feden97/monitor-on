import { effectiveToNominal, riskMeasures, yieldFromPrice } from './fixedIncomeMath.js'
import { FINANCIAL_ENGINE_VERSION } from './bondQuality.js'

/** Replay the numerical valuation, using the archived discount times rather
 * than today's quote, calendar or static catalog. Reproduction is not approval
 * of the contractual assumptions or market freshness.
 */
export function replayCalculation(snapshot) {
  if (snapshot?.format !== 'monitor-on-calculation/v1'
    || !['fixed-income-2.0.0', FINANCIAL_ENGINE_VERSION].includes(snapshot.engineVersion)) {
    throw new Error('Formato o versión de motor no compatible con este reproductor.')
  }
  if (!['indicative', 'valid'].includes(snapshot.quality?.calculation?.status)
    || !Number.isFinite(snapshot.outputs?.ytm)) {
    throw new Error('Este archivo no contiene un cálculo habilitado para reproducir.')
  }
  if (snapshot.yieldBasis !== 'effective-annual' || snapshot.scenario !== 'hold-to-maturity') {
    throw new Error('Escenario o convención no compatible.')
  }
  if (!Array.isArray(snapshot.cashflows) || snapshot.cashflows.length === 0) {
    throw new Error('Faltan flujos y tiempos de descuento.')
  }
  const flows = snapshot.cashflows.map(flow => ({ time: flow.yearFraction, amount: flow.total }))
  const rate = yieldFromPrice(flows, snapshot.price?.value, { basis: 'effective-annual' })
  if (rate == null) throw new Error('No se obtuvo una TIR reproducible con estas entradas.')
  const effective = riskMeasures(flows, rate, { basis: 'effective-annual' })
  const frequency = snapshot.nominalFrequency
  const nominalRate = Number.isSafeInteger(frequency) && frequency > 0 ? effectiveToNominal(rate, frequency) : null
  const nominal = nominalRate == null ? null : riskMeasures(flows, nominalRate, { basis: 'nominal', frequency })
  const computed = {
    ytm: rate * 100,
    tna: nominalRate == null ? null : nominalRate * 100,
    duration: effective.macaulayDuration,
    modDuration: nominal?.modifiedDuration ?? null,
    effectiveModDuration: effective.modifiedDuration,
    convexity: effective.convexity,
    nominalConvexity: nominal?.convexity ?? null,
  }
  const differences = Object.entries(computed).flatMap(([field, value]) => {
    const stored = snapshot.outputs[field]
    const matches = value === null ? stored === null
      : Number.isFinite(stored) && Math.abs(value - stored) <= 1e-8 * Math.max(1, Math.abs(value))
    return matches ? [] : [{ field, stored: stored ?? null, computed: value }]
  })
  return {
    status: differences.length ? 'differs' : 'reproduced',
    inputId: snapshot.id ?? null,
    computed,
    differences,
    scope: 'Reproducción numérica de TIR y sensibilidades con precio y tiempos archivados; no certifica contrato, cupón corrido, calendario ni cotización.',
  }
}
