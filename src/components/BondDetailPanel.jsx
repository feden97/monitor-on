import { useMemo } from 'react'
import { analyzeBond, getNextBusinessDay } from '../utils/bondEngine'
import { formatDate, formatPctSimple } from '../utils/formatters'

function DataRow({ label, value, subValue, highlight = false }) {
  return (
    <div className="flex items-center justify-between border-b border-terminal-border/30 px-1 py-2.5 last:border-0 hover:bg-terminal-surface/20 rounded-sm">
      <span className="text-xs text-terminal-muted">{label}</span>
      <div className="text-right">
        <div className={`text-sm font-mono font-semibold ${highlight ? 'text-terminal-accent' : 'text-terminal-text'}`}>
          {value || '—'}
        </div>
        {subValue && <div className="text-[10px] font-mono text-terminal-muted/60">{subValue}</div>}
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
    <div className="flex flex-col gap-6 p-1">
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-terminal-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-terminal-accent" />
          Datos de emisión
        </h4>
        <div className="rounded-lg border border-terminal-border bg-terminal-surface/30 p-4">
          <DataRow label="Emisora" value={prospecto?.name} />
          <DataRow label="ISIN" value={prospecto?.isin} />
          <DataRow label="Fecha emisión" value={formatDate(prospecto?.emission_date)} />
          <DataRow label="Fecha vencimiento" value={formatDate(prospecto?.maturity_date)} />
          <DataRow label="Ley" value={prospecto?.law} />
          <DataRow label="Moneda de pago" value={prospecto?.currency_type} />
          <DataRow
            label="Cupón TNA"
            value={interestRate != null ? `${interestRate}%` : '—'}
            subValue={`${prospecto?.frequency || 2} pagos/año`}
          />
          <DataRow
            label="Próximo pago"
            value={formatDate(nextFlow?.date)}
            subValue={nextFlow ? `$${nextFlow.totalAmt.toFixed(2)} c/100` : null}
            highlight
          />
          <DataRow label="Calificación" value={prospecto?.rating} />
          <DataRow label="Mínimo nominal" value={prospecto?.min_investment ? `${prospecto.min_investment} VN` : '1 VN'} />
          <DataRow label="Amortización" value={amortType === 'Bullet' ? 'Bullet (100% al vto)' : (amortType || '—')} />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-terminal-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-terminal-accent" />
          Métricas financieras
        </h4>
        <div className="rounded-lg border border-terminal-border bg-terminal-surface/30 p-4">
          <DataRow label="Precio dirty (USD)" value={bond.c ? `$${bond.c.toFixed(2)}` : '—'} highlight />
          <DataRow label="Precio clean (USD)" value={metrics ? `$${metrics.cleanPrice.toFixed(2)}` : '—'} />
          <DataRow label="TIR efectiva" value={metrics?.ytm != null ? formatPctSimple(metrics.ytm) : '—'} highlight />
          <DataRow label="Current yield" value={metrics ? formatPctSimple(metrics.currentYield) : '—'} />
          <DataRow label="Paridad" value={metrics ? formatPctSimple(metrics.paridad) : '—'} />
          <DataRow label="Duration" value={metrics?.duration ? metrics.duration.toFixed(2) : '—'} subValue="años" />
          <DataRow label="Mod. duration" value={metrics?.modDuration ? metrics.modDuration.toFixed(2) : '—'} />
          <DataRow label="Cupón corrido" value={metrics ? `$${metrics.accrued.toFixed(4)}` : '—'} />
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
        <h4 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-terminal-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-terminal-accent" />
          Flujo de fondos
        </h4>
        <div className="max-h-[800px] overflow-hidden rounded-lg border border-terminal-border bg-terminal-surface/30">
          {metrics?.futureFlows?.length ? (
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 bg-terminal-surface/30">
                <tr className="border-b border-terminal-border">
                  <th className="px-3 py-2 text-left text-terminal-muted/60">Fecha</th>
                  <th className="px-3 py-2 text-right text-terminal-muted/60">Cupón</th>
                  <th className="px-3 py-2 text-right text-terminal-muted/60">Amort.</th>
                  <th className="px-3 py-2 text-right text-terminal-muted/60">Total</th>
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
              <div className="mb-2 text-xs italic text-terminal-muted">Este bono ya venció.</div>
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
  )
}
