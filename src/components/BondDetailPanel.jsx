import { formatDate, formatPctSimple } from '../utils/formatters'
import QualityStatus from './QualityStatus'
import BondAuditPanel from './BondAuditPanel'
import BondScenarioPanel from './BondScenarioPanel'
import { displayedPaymentDate } from '../utils/paymentDateReview'

function money(value, digits = 2) {
  return Number.isFinite(value) ? `$${value.toFixed(digits)}` : '—'
}

function DataRow({ label, value, subValue, highlight = false }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-sm border-b border-terminal-border/30 px-1 py-2.5 last:border-0">
      <span className="text-xs text-terminal-muted">{label}</span>
      <div className="min-w-0 text-right">
        <div className={`break-words text-sm font-mono font-semibold ${highlight ? 'text-terminal-accent' : 'text-terminal-text'}`}>{value ?? '—'}</div>
        {subValue && <div className="mt-0.5 text-[10px] text-terminal-muted/80">{subValue}</div>}
      </div>
    </div>
  )
}

function Heading({ children }) {
  return <h4 className="text-[10px] font-semibold uppercase tracking-wider text-terminal-accent">{children}</h4>
}

export default function BondDetailPanel({ bond, prospecto, dolarMEP, metrics, quality, calculationSnapshot, contract }) {
  const interestRate = contract?.annualCouponRate != null ? contract.annualCouponRate * 100 : prospecto?.coupon_rate
  const frequency = contract?.frequency ?? prospecto?.frequency
  const nextFlow = metrics?.futureFlows?.[0]
  const indicative = quality?.calculation?.status === 'indicative'
  const matured = quality?.schedule?.status === 'matured' || metrics?.isMatured
  const flows = metrics?.futureFlows || []

  return (
    <div className="flex flex-col gap-6 p-1">
      <QualityStatus quality={quality} />
      {contract?.instrumentId === 'ypf-international-xxxiv-2025-01-17' && <BondScenarioPanel key={contract.instrumentId}
        contract={contract} observedPrice={bond?.c} settlementDate={calculationSnapshot?.settlementDate} />}

      <section className="space-y-3">
        <Heading>Datos de emisión</Heading>
        <div className="rounded-lg border border-terminal-border bg-terminal-surface/30 p-4">
          <DataRow label="Emisora" value={contract?.issuer || prospecto?.name} />
          <DataRow label="ISIN Reg S" value={contract?.isinRegS || prospecto?.isin} />
          {contract?.isin144A && <DataRow label="ISIN 144A" value={contract.isin144A} />}
          <DataRow label="Fecha emisión" value={formatDate(contract?.issueDate || prospecto?.emission_date)} />
          <DataRow label="Fecha vencimiento" value={formatDate(contract?.maturityDate || prospecto?.maturity_date)} />
          <DataRow label="Ley declarada" value={prospecto?.law} />
          <DataRow label="Moneda contractual" value={contract?.currency} />
          <DataRow label="Especie de negociación" value={bond?.symbol} subValue={prospecto?.currency_type ? `Tipo declarado: ${prospecto.currency_type}` : null} />
          <DataRow label="Cupón anual" value={interestRate != null ? `${interestRate}%` : null} subValue={frequency != null ? `${frequency} pagos/año` : 'Frecuencia sin informar'} />
          <DataRow label="Próximo pago contractual" value={formatDate(nextFlow?.rawDate)} subValue={nextFlow ? `${money(nextFlow.totalAmt, 4)} por 100 VN originales` : null} highlight />
          {nextFlow && <DataRow label="Fecha ajustada estimada" value={displayedPaymentDate(nextFlow) ? formatDate(displayedPaymentDate(nextFlow)) : 'Sin verificar'} subValue="Sujeta a calendario y regla contractual" />}
          <DataRow label="Calificación declarada" value={prospecto?.rating} subValue="Agencia, escala y vigencia sin verificar" />
          <DataRow label="Mínimo nominal declarado" value={prospecto?.min_investment != null ? `${prospecto.min_investment} VN` : null} />
          <DataRow label="Amortización declarada" value={prospecto?.amort_type === 'Bullet' ? '100% al vencimiento' : prospecto?.amort_type} />
        </div>
      </section>

      <section className="space-y-3">
        <Heading>Métricas financieras{indicative ? ' · escenario indicativo' : ''}</Heading>
        {indicative && <p className="text-xs leading-relaxed text-terminal-muted">Estos valores dependen de supuestos pendientes de verificar. Se excluyen de los rankings de rendimientos comparables.</p>}
        {!metrics && <p className="rounded border border-terminal-border bg-terminal-surface/30 p-3 text-xs leading-relaxed text-terminal-muted">No se publican rendimientos ni sensibilidades con estos datos. Revisá los motivos en el estado de calidad.</p>}
        <div className="rounded-lg border border-terminal-border bg-terminal-surface/30 p-4">
          <DataRow label="Precio observado (USD)" value={money(bond?.c)} subValue="Naturaleza y base nominal según fuente" highlight />
          <DataRow label="Precio sucio del escenario" value={money(metrics?.dirtyPrice)} subValue={calculationSnapshot?.price?.type === 'dirty' ? 'Precio identificado como sucio por la fuente' : 'Cotización asumida como sucia; ver entradas'} />
          <DataRow label="Precio limpio del escenario" value={money(metrics?.cleanPrice)} />
          <DataRow label="Cupón corrido" value={money(metrics?.accrued, 4)} subValue="USD por 100 VN originales" />
          <DataRow label="TIR al vencimiento · TEA" value={formatPctSimple(metrics?.ytm)} highlight />
          <DataRow label="Nominal anual equivalente" value={formatPctSimple(metrics?.tna)} subValue={frequency != null ? `${frequency} capitalizaciones/año` : null} />
          <DataRow label="Current yield" value={formatPctSimple(metrics?.currentYield)} />
          <DataRow label="Paridad" value={formatPctSimple(metrics?.paridad)} />
          <DataRow label="Duración Macaulay" value={metrics?.duration != null ? metrics.duration.toFixed(4) : null} subValue="años · hasta vencimiento" />
          <DataRow label="Duración modificada" value={metrics?.modDuration != null ? metrics.modDuration.toFixed(4) : null} subValue="Sensibilidad a tasa nominal anual" />
          {metrics?.effectiveModDuration != null && <DataRow label="Duración modificada · TEA" value={metrics.effectiveModDuration.toFixed(4)} />}
          {metrics?.convexity != null && <DataRow label="Convexidad · TEA" value={metrics.convexity.toFixed(4)} subValue="P″ / P; el escenario usa factor ½" />}
          {dolarMEP?.value && bond?.c > 0 ? <DataRow label="Equivalente en pesos" value={`$${(bond.c * dolarMEP.value).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`} subValue={`Referencia MEP $${dolarMEP.value}; no incluye gastos`} /> : null}
        </div>
      </section>

      <BondAuditPanel contract={contract} snapshot={calculationSnapshot} symbol={bond?.symbol} />

      <section className="space-y-3">
        <Heading>Flujo de fondos · USD por 100 VN originales</Heading>
        {flows.length > 0 && <p className="text-[11px] leading-relaxed text-terminal-muted">El descuento utiliza fechas contractuales. El ajuste de pago se muestra por separado y depende del calendario disponible.</p>}
        <div className="max-h-[800px] overflow-auto rounded-lg border border-terminal-border bg-terminal-surface/30">
          {flows.length > 0 ? (
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 bg-terminal-panel">
                <tr className="border-b border-terminal-border">
                  <th className="px-3 py-2 text-left font-medium text-terminal-muted">Contractual</th>
                  <th className="px-3 py-2 text-left font-medium text-terminal-muted">Ajuste estimado</th>
                  <th className="px-3 py-2 text-right font-medium text-terminal-muted">Interés USD</th>
                  <th className="px-3 py-2 text-right font-medium text-terminal-muted">Capital USD</th>
                  <th className="px-3 py-2 text-right font-medium text-terminal-muted">Total USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border/20">
                {flows.map((flow, index) => <tr key={`${flow.rawDate}-${index}`} className="hover:bg-terminal-surface/10"><td className="whitespace-nowrap px-3 py-2">{formatDate(flow.rawDate)}</td><td className="whitespace-nowrap px-3 py-2 text-terminal-muted">{displayedPaymentDate(flow) ? formatDate(displayedPaymentDate(flow)) : 'Sin verificar'}</td><td className="px-3 py-2 text-right text-up">{flow.intAmt.toFixed(4)}</td><td className="px-3 py-2 text-right text-terminal-accent">{flow.amortAmt.toFixed(2)}</td><td className="px-3 py-2 text-right font-bold">{flow.totalAmt.toFixed(4)}</td></tr>)}
              </tbody>
            </table>
          ) : <div className="p-6 text-center text-xs leading-relaxed text-terminal-muted">{matured ? 'La fecha de vencimiento declarada ya transcurrió. Esto no certifica que todos los pagos se hayan realizado.' : 'El cronograma no permite presentar un flujo utilizable. Se necesita revisar su integridad y las condiciones contractuales.'}</div>}
        </div>
      </section>
    </div>
  )
}
