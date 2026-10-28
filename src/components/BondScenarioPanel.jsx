import { useMemo, useState } from 'react'
import { calculateBondScenario, SCENARIO_DAY_COUNTS } from '../utils/bondScenario'
import { formatDate, formatPctSimple } from '../utils/formatters'
import { downloadCalculation } from '../utils/downloadCalculation'

const inputClass = 'mt-1 w-full rounded border border-terminal-border bg-terminal-panel px-2 py-2 font-mono text-xs text-terminal-text'
const amount = value => Number.isFinite(value) ? value.toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '—'

export default function BondScenarioPanel({ contract, observedPrice, settlementDate }) {
  const [price, setPrice] = useState(() => observedPrice > 0 ? String(observedPrice) : '100')
  const [settlement, setSettlement] = useState(settlementDate || '')
  const [priceType, setPriceType] = useState('dirty')
  const [nominalBasis, setNominalBasis] = useState('original')
  const [accrualDayCount, setAccrualDayCount] = useState('30E/360')
  const [discountDayCount, setDiscountDayCount] = useState('30E/360')
  const result = useMemo(() => {
    try {
      if (!price.trim()) throw new Error('Ingresá un precio.')
      return { value: calculateBondScenario(contract, { price: Number(price.replace(',', '.')),
        settlementDate: settlement, priceType, nominalBasis, accrualDayCount, discountDayCount }) }
    } catch (error) { return { error: error.message } }
  }, [contract, price, settlement, priceType, nominalBasis, accrualDayCount, discountDayCount])
  const scenario = result.value
  return (
    <section className="space-y-4 rounded-lg border border-terminal-accent/30 bg-terminal-accent/5 p-4" aria-label="Laboratorio de convenciones">
      <div>
        <h3 className="text-sm font-semibold text-terminal-text">Laboratorio · mismo precio, distintas convenciones</h3>
        <p className="mt-2 text-xs leading-relaxed text-terminal-muted">Fijá las entradas para comparar cálculos. El precio queda fijo al abrir el laboratorio; no sigue los refrescos del mercado. Es un escenario manual sobre la emisión original, separado de la cotización y de los rankings.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-terminal-muted">Precio del escenario
          <input className={inputClass} inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />
        </label>
        <label className="text-xs text-terminal-muted">Liquidación del escenario
          <input className={inputClass} type="date" min={contract.issueDate} max={contract.maturityDate} value={settlement}
            onInput={e => setSettlement(e.currentTarget.value)} onChange={e => setSettlement(e.target.value)} />
        </label>
        <label className="text-xs text-terminal-muted">Naturaleza del precio
          <select className={inputClass} value={priceType} onChange={e => setPriceType(e.target.value)}><option value="dirty">Precio sucio · incluye corrido</option><option value="clean">Precio limpio · sumar corrido</option></select>
        </label>
        <label className="text-xs text-terminal-muted">Base nominal del precio
          <select className={inputClass} value={nominalBasis} onChange={e => setNominalBasis(e.target.value)}><option value="original">Por 100 VN originales</option><option value="residual">Por 100 de capital residual</option></select>
        </label>
        <label className="text-xs text-terminal-muted">Devengamiento · supuesto del escenario
          <select className={inputClass} value={accrualDayCount} onChange={e => setAccrualDayCount(e.target.value)}>{SCENARIO_DAY_COUNTS.filter(item => item.id.startsWith('30')).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        </label>
        <label className="text-xs text-terminal-muted">Tiempos de descuento
          <select className={inputClass} value={discountDayCount} onChange={e => setDiscountDayCount(e.target.value)}>{SCENARIO_DAY_COUNTS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        </label>
      </div>
      {result.error && <p role="status" className="rounded border border-down/30 bg-down/10 p-3 text-xs leading-relaxed text-down">{result.error}</p>}
      {scenario && <>
        <dl className="grid grid-cols-2 gap-3 rounded border border-terminal-border bg-terminal-panel/60 p-3 text-xs sm:grid-cols-3">
          {[['Precio sucio / VN original', amount(scenario.outputs.dirtyPrice)], ['Precio limpio / VN original', amount(scenario.outputs.cleanPrice)], ['Cupón corrido / VN original', amount(scenario.outputs.accrued)],
            ['TIR efectiva anual', formatPctSimple(scenario.outputs.ytm)], ['Nominal anual semestral', formatPctSimple(scenario.outputs.tna)], ['Capital residual por VN original 100', amount(scenario.outputs.outstandingPrincipal)]].map(([label, value]) => <div key={label}><dt className="text-[10px] text-terminal-muted">{label}</dt><dd className="mt-1 font-mono font-semibold text-terminal-text">{value}</dd></div>)}
        </dl>
        <div className="overflow-x-auto rounded border border-terminal-border">
          <table className="w-full text-xs"><caption className="p-3 text-left text-[11px] text-terminal-muted">Mismo precio sucio, liquidación y flujos. Solo cambia el descuento.</caption><thead className="border-y border-terminal-border bg-terminal-panel text-terminal-muted"><tr><th className="p-2 text-left">Convención</th><th className="p-2 text-right">TEA</th><th className="p-2 text-right">Nominal semestral</th></tr></thead><tbody>{scenario.comparisons.map(row => <tr key={row.convention} className={row.convention === discountDayCount ? 'bg-terminal-accent/10' : ''}><td className="p-2 font-mono">{row.convention}</td><td className="p-2 text-right font-mono">{formatPctSimple(row.ytm)}</td><td className="p-2 text-right font-mono">{formatPctSimple(row.tna)}</td></tr>)}</tbody></table>
        </div>
        <details className="rounded border border-terminal-border p-3 text-xs"><summary className="cursor-pointer text-terminal-text">Fechas y cobertura de los calendarios de referencia</summary><p className="mt-2 text-[11px] leading-relaxed text-terminal-muted">Cobertura conjunta: {formatDate(scenario.calendar.from)} a {formatDate(scenario.calendar.to)}. Following es una simulación; su aplicación contractual sigue pendiente. Sin cobertura, el ajuste queda sin informar.</p><div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-[11px]"><thead><tr><th className="p-1 text-left">Contractual</th><th className="p-1 text-left">Following de referencia</th></tr></thead><tbody>{scenario.cashflows.map(row => <tr key={row.date}><td className="p-1 font-mono">{formatDate(row.date)}</td><td className="p-1 font-mono">{row.adjustedDate ? formatDate(row.adjustedDate) : 'Sin cobertura conjunta'}</td></tr>)}</tbody></table></div></details>
        <button type="button" onClick={() => downloadCalculation(scenario.snapshot, 'YM34D-escenario')} className="rounded border border-terminal-accent/40 px-3 py-2 text-xs font-medium text-terminal-accent hover:bg-terminal-accent/10">Descargar escenario reproducible</button>
        <details className="text-[11px] text-terminal-muted"><summary className="cursor-pointer">Supuestos y fuentes de los calendarios</summary><ul className="mt-2 list-disc space-y-1 pl-4">{scenario.assumptions.map(assumption => <li key={assumption}>{assumption}</li>)}</ul>
          {scenario.calendar.calendars.map(calendar => <div key={calendar.id} className="mt-3"><p className="font-mono">{calendar.id} · versión {calendar.version} · {formatDate(calendar.coverage.from)} a {formatDate(calendar.coverage.to)}</p><ul className="mt-1 space-y-1">{calendar.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-terminal-accent underline">{source.title}</a></li>)}</ul></div>)}
        </details>
      </>}
    </section>
  )
}
