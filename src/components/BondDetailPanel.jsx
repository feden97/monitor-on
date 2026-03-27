import React, { useMemo } from 'react'
import {
  calcTIR,
  calcParidad,
  calcCurrentYield,
  calcDuration,
  calcModDuration,
  calcCouponAccrued,
  calcCleanPrice,
  generateCashFlows,
  parseInterestString,
  parseAmortString
} from '../utils/bondMath'
import { formatPrice, formatPct } from '../utils/formatters'

/**
 * BondDetailPanel — Expanded detail view for a bond.
 * Shows Emission Data, Market Metrics, and Cash Flow.
 */
export default function BondDetailPanel({ bond, metadata, prospecto, dolarMEP }) {
  // ── 1. Parse Fundamental Data ─────────────────────────────────────
  const interest = useMemo(() => 
    metadata ? parseInterestString(metadata.interes) : (prospecto?.coupon_rate ? { rate: prospecto.coupon_rate } : null)
  , [metadata, prospecto])
  
  const amort = useMemo(() => 
    metadata ? parseAmortString(metadata.formaAmortizacion) : (prospecto?.amortization ? { type: prospecto.amortization.type } : null)
  , [metadata, prospecto])

  // ── 2. Calculate Financial Metrics ────────────────────────────────
  const metrics = useMemo(() => {
    if (!bond.c) return null

    const settlementDate = new Date() // Today
    const dirtyPrice = bond.c
    
    // Use prospecto cash flows if available, otherwise generated ones
    const flows = prospecto?.cash_flows || (metadata ? generateCashFlows(metadata) : [])
    if (flows.length === 0) return null

    const accrued = calcCouponAccrued(flows, settlementDate)
    const cleanPrice = calcCleanPrice(dirtyPrice, accrued)
    const tir = calcTIR(flows, dirtyPrice, settlementDate)
    const paridad = calcParidad(dirtyPrice, flows, settlementDate)
    const currentYield = calcCurrentYield(interest?.rate || 0, dirtyPrice)
    const duration = calcDuration(flows, dirtyPrice, settlementDate)
    const modDuration = calcModDuration(duration, tir)

    return {
      accrued,
      cleanPrice,
      tir,
      paridad,
      currentYield,
      duration,
      modDuration,
      flows
    }
  }, [bond, metadata, prospecto, interest])

  // ── 3. Render Helper ──────────────────────────────────────────────
  const DataRow = ({ label, value, subValue, highlight = false }) => (
    <div className="flex justify-between items-center py-2 border-b border-terminal-border/30 last:border-0 hover:bg-terminal-surface/20 px-1">
      <span className="text-xs text-terminal-muted font-sans font-medium">{label}</span>
      <div className="text-right">
        <div className={`text-sm font-mono font-bold ${highlight ? 'text-terminal-accent' : 'text-terminal-text'}`}>
          {value || '—'}
        </div>
        {subValue && <div className="text-[10px] text-terminal-muted font-mono">{subValue}</div>}
      </div>
    </div>
  )

  return (
    <div className="p-6 bg-terminal-surface/40 border-t border-terminal-border animate-in slide-in-from-top-4 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* ── Col 1: Datos de Emisión ── */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-terminal-accent flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-terminal-accent"></span>
            Datos de Emisión
          </h4>
          <div className="bg-terminal-panel rounded-lg p-4 border border-terminal-border shadow-sm">
            <DataRow label="Emisora" value={metadata?.emisor || prospecto?.name} />
            <DataRow label="ISIN" value={metadata?.isin || prospecto?.isin} />
            <DataRow label="Fecha Emisión" value={metadata?.fechaEmision || prospecto?.issue_date} />
            <DataRow label="Fecha Vencimiento" value={metadata?.fechaVencimiento || prospecto?.maturity_date} />
            <DataRow label="Ley" value={prospecto?.law || metadata?.ley} />
            <DataRow label="Dólar de Pago" value={prospecto?.currency_type || '—'} />
            <DataRow label="Cupón TNA" value={interest ? `${interest.rate}%` : '—'} subValue={`${prospecto?.frequency || 2} pagos/año`} />
            <DataRow label="Calificación" value={prospecto?.rating || metadata?.rating} />
            <DataRow label="Mínimo Nom." value={prospecto?.min_investment ? `${prospecto.min_investment} VN` : '1 VN'} />
            <DataRow label="Amortización" value={amort?.type === 'bullet' ? 'Bullet (100% al vto)' : 'Amortizable'} />
          </div>
        </div>

        {/* ── Col 2: Datos de Mercado + Métricas ── */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-terminal-accent flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-terminal-accent"></span>
            Métricas Financieras
          </h4>
          <div className="bg-terminal-panel rounded-lg p-4 border border-terminal-border shadow-sm">
            <DataRow label="Precio Dirty (u$s)" value={bond.c ? `$${bond.c.toFixed(2)}` : '—'} highlight />
            <DataRow label="Precio Clean (u$s)" value={metrics ? `$${metrics.cleanPrice.toFixed(2)}` : '—'} />
            <DataRow label="TIR (Efectiva)" value={metrics ? formatPct(metrics.tir) : '—'} highlight />
            <DataRow label="Current Yield" value={metrics ? formatPct(metrics.currentYield) : '—'} />
            <DataRow label="Paridad" value={metrics ? formatPct(metrics.paridad) : '—'} />
            <DataRow label="Duration" value={metrics ? metrics.duration.toFixed(2) : '—'} subValue="en años" />
            <DataRow label="Mod. Duration" value={metrics ? metrics.modDuration.toFixed(2) : '—'} />
            <DataRow label="Cupón Corrido" value={metrics ? `$${metrics.accrued.toFixed(4)}` : '—'} />
            {dolarMEP?.value && bond.c && (
              <DataRow label="Equiv. Pesos" value={`$${(bond.c * dolarMEP.value).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`} subValue={`Base MEP $${dolarMEP.value}`} />
            )}
          </div>
        </div>

        {/* ── Col 3: Flujo de Fondos Futuros ── */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-terminal-accent flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-terminal-accent"></span>
            Flujo de Fondos
          </h4>
          <div className="bg-terminal-panel rounded-lg overflow-hidden border border-terminal-border shadow-sm max-h-[460px] overflow-y-auto">
            {metrics?.flows && metrics.flows.length > 0 ? (
              <table className="w-full text-xs font-mono">
                <thead className="bg-terminal-surface/30 sticky top-0">
                  <tr className="border-b border-terminal-border">
                    <th className="px-3 py-2 text-left text-terminal-muted">Fecha</th>
                    <th className="px-3 py-2 text-right text-terminal-muted">Cupón</th>
                    <th className="px-3 py-2 text-right text-terminal-muted">Amort.</th>
                    <th className="px-3 py-2 text-right text-terminal-muted">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terminal-border/20">
                  {metrics.flows
                    .filter(f => new Date(f.date) >= new Date())
                    .map((f, i) => (
                      <tr key={i} className="hover:bg-terminal-surface/10">
                        <td className="px-3 py-2">{f.date}</td>
                        <td className="px-3 py-2 text-right text-up">{f.interest.toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right text-terminal-accent">{f.amortization.toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right font-bold">${(f.interest + f.amortization).toFixed(2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center">
                <div className="text-terminal-muted text-xs mb-2 italic">No hay datos de flujo disponibles para este ticker.</div>
                <div className="text-[10px] text-terminal-muted/60">Agregá las fechas en bondProspectos.json o corre el sync-spreadsheet script.</div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
