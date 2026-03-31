import { useMemo } from 'react'
import { analyzeBond, getNextBusinessDay } from '../utils/bondEngine'
import { formatDate, formatPctSimple } from '../utils/formatters'

function DataRow({ label, value, subValue, highlight = false }) {
  return (
    <div className="flex items-center justify-between border-b border-terminal-border/30 px-1 py-2 last:border-0 hover:bg-terminal-surface/20">
      <span className="text-xs font-medium text-terminal-muted">{label}</span>
      <div className="text-right">
        <div className={`text-sm font-mono font-bold ${highlight ? 'text-terminal-accent' : 'text-terminal-text'}`}>
          {value || '—'}
        </div>
        {subValue && <div className="text-[10px] font-mono text-terminal-muted">{subValue}</div>}
      </div>
    </div>
  )
}

export default function BondDetailPanel({ bond, prospecto, dolarMEP }) {
  const metrics = useMemo(() => {
    if (!bond.c) return null

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const settlementDate = getNextBusinessDay(tomorrow.toISOString().split('T')[0])

    const rawFlows = prospecto?.cashflows || prospecto?.cash_flows || []
    if (!rawFlows.length) return null

    return analyzeBond(bond.c, prospecto, settlementDate)
  }, [bond.c, prospecto])

  const interestRate = prospecto?.coupon_rate
  const amortType = prospecto?.amort_type
  const nextFlow = metrics?.futureFlows?.[0]

  return (
    <div className="animate-in slide-in-from-top-4 border-t border-terminal-border bg-terminal-surface/40 p-6 duration-300">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-terminal-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-terminal-accent" />
            Datos de emision
          </h4>
          <div className="rounded-lg border border-terminal-border bg-terminal-panel p-4 shadow-sm">
            <DataRow label="Emisora" value={prospecto?.name} />
            <DataRow label="ISIN" value={prospecto?.isin} />
            <DataRow label="Fecha emision" value={formatDate(prospecto?.emission_date)} />
            <DataRow label="Fecha vencimiento" value={formatDate(prospecto?.maturity_date)} />
            <DataRow label="Ley" value={prospecto?.law} />
            <DataRow label="Moneda de pago" value={prospecto?.currency_type} />
            <DataRow
              label="Cupon TNA"
              value={interestRate != null ? `${interestRate}%` : '—'}
              subValue={`${prospecto?.frequency || 2} pagos/año`}
            />
            <DataRow
              label="Proximo pago"
              value={formatDate(nextFlow?.date)}
              subValue={nextFlow ? `$${nextFlow.totalAmt.toFixed(2)} c/100` : null}
              highlight
            />
            <DataRow label="Calificacion" value={prospecto?.rating} />
            <DataRow label="Minimo nominal" value={prospecto?.min_investment ? `${prospecto.min_investment} VN` : '1 VN'} />
            <DataRow label="Amortizacion" value={amortType === 'Bullet' ? 'Bullet (100% al vto)' : (amortType || '—')} />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-terminal-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-terminal-accent" />
            Metricas financieras
          </h4>
          <div className="rounded-lg border border-terminal-border bg-terminal-panel p-4 shadow-sm">
            <DataRow label="Precio dirty (USD)" value={bond.c ? `$${bond.c.toFixed(2)}` : '—'} highlight />
            <DataRow label="Precio clean (USD)" value={metrics ? `$${metrics.cleanPrice.toFixed(2)}` : '—'} />
            <DataRow label="TIR efectiva" value={metrics?.ytm != null ? formatPctSimple(metrics.ytm) : '—'} highlight />
            <DataRow label="Current yield" value={metrics ? formatPctSimple(metrics.currentYield) : '—'} />
            <DataRow label="Paridad" value={metrics ? formatPctSimple(metrics.paridad) : '—'} />
            <DataRow label="Duration" value={metrics?.duration ? metrics.duration.toFixed(2) : '—'} subValue="años" />
            <DataRow label="Mod. duration" value={metrics?.modDuration ? metrics.modDuration.toFixed(2) : '—'} />
            <DataRow label="Cupon corrido" value={metrics ? `$${metrics.accrued.toFixed(4)}` : '—'} />
            {dolarMEP?.value && bond.c && (
              <DataRow
                label="Equiv. en pesos"
                value={`$${(bond.c * dolarMEP.value).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                subValue={`Base MEP $${dolarMEP.value}`}
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-terminal-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-terminal-accent" />
            Flujo de fondos
          </h4>
          <div className="max-h-[460px] overflow-y-auto rounded-lg border border-terminal-border bg-terminal-panel shadow-sm">
            {metrics?.futureFlows?.length ? (
              <table className="w-full text-xs font-mono">
                <thead className="sticky top-0 bg-terminal-surface/30">
                  <tr className="border-b border-terminal-border">
                    <th className="px-3 py-2 text-left text-terminal-muted">Fecha</th>
                    <th className="px-3 py-2 text-right text-terminal-muted">Cupon</th>
                    <th className="px-3 py-2 text-right text-terminal-muted">Amort.</th>
                    <th className="px-3 py-2 text-right text-terminal-muted">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terminal-border/20">
                  {metrics.futureFlows.map((flow, index) => (
                    <tr key={`${flow.date}-${index}`} className="hover:bg-terminal-surface/10">
                      <td className="px-3 py-2">{formatDate(flow.date)}</td>
                      <td className="px-3 py-2 text-right text-up">{flow.intAmt.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right text-terminal-accent">{flow.amortAmt.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right font-bold">${flow.totalAmt.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : metrics?.isMatured ? (
              <div className="p-8 text-center">
                <div className="mb-2 text-xs italic text-terminal-muted">Este bono ya vencio.</div>
                <div className="text-[10px] text-terminal-muted/60">No hay pagos futuros disponibles.</div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="mb-2 text-xs italic text-terminal-muted">No hay datos de flujo disponibles para este ticker.</div>
                <div className="text-[10px] text-terminal-muted/60">Completá los cashflows en `bondProspectos.json` para ver el detalle.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
