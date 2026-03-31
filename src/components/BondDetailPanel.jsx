import React, { useMemo } from 'react'
import { analyzeBond, getNextBusinessDay } from '../utils/bondEngine'
import { formatPrice, formatPct } from '../utils/formatters'

/**
 * BondDetailPanel — Expanded detail view for a bond.
 * Shows Emission Data, Market Metrics, and Cash Flow.
 */
export default function BondDetailPanel({ bond, prospecto, dolarMEP }) {
  // ── 1. Parse Fundamental Data ─────────────────────────────────────
  const interest = useMemo(() =>
    prospecto?.coupon_rate ? { rate: prospecto.coupon_rate } : null
    , [prospecto])

  const amort = useMemo(() =>
    prospecto?.amort_type ? { type: prospecto.amort_type } : null
    , [prospecto])

  // ── 2. Calculate Financial Metrics ────────────────────────────────
  const metrics = useMemo(() => {
    if (!bond.c) return null

    // Liquidación T+1 (Tomorrow or next business day)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    // getNextBusinessDay takes a 'YYYY-MM-DD' and rolls forward over weekends/holidays
    const settlementDate = getNextBusinessDay(tomorrow.toISOString().split('T')[0])

    const dirtyPrice = bond.c

    // Use prospecto cash flows if available
    const rawFlows = prospecto?.cashflows || prospecto?.cash_flows || []
    if (rawFlows.length === 0) return null

    return analyzeBond(dirtyPrice, prospecto, settlementDate)
  }, [bond, prospecto, interest])

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
            <DataRow label="Emisora" value={prospecto?.name} />
            <DataRow label="ISIN" value={prospecto?.isin || '—'} />
            <DataRow label="Fecha Emisión" value={prospecto?.emission_date || '—'} />
            <DataRow label="Fecha Vencimiento" value={prospecto?.maturity_date || '—'} />
            <DataRow label="Ley" value={prospecto?.law} />
            <DataRow label="Dólar de Pago" value={prospecto?.currency_type || '—'} />
            <DataRow label="Cupón TNA" value={interest ? `${interest.rate}%` : '—'} subValue={`${prospecto?.frequency || 2} pagos/año`} />
            <DataRow label="Calificación" value={prospecto?.rating} />
            <DataRow label="Mínimo Nom." value={prospecto?.min_investment ? `${prospecto.min_investment} VN` : '1 VN'} />
            <DataRow label="Amortización" value={amort?.type === 'Bullet' ? 'Bullet (100% al vto)' : (amort?.type || '—')} />
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
            <DataRow label="TIR (Efectiva)" value={metrics?.ytm != null ? formatPct(metrics.ytm) : '—'} highlight />
            <DataRow label="Current Yield" value={metrics ? formatPct(metrics.currentYield) : '—'} />
            <DataRow label="Paridad" value={metrics ? formatPct(metrics.paridad) : '—'} />
            <DataRow label="Duration" value={metrics?.duration ? metrics.duration.toFixed(2) : '—'} subValue="en años" />
            <DataRow label="Mod. Duration" value={metrics?.modDuration ? metrics.modDuration.toFixed(2) : '—'} />
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
            {metrics?.futureFlows && metrics.futureFlows.length > 0 ? (
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
                  {metrics.futureFlows.map((f, i) => (
                    <tr key={i} className="hover:bg-terminal-surface/10">
                      <td className="px-3 py-2">{f.date}</td>
                      <td className="px-3 py-2 text-right text-up">{f.intAmt.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right text-terminal-accent">{f.amortAmt.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right font-bold">${f.totalAmt.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : metrics?.isMatured ? (
              <div className="p-8 text-center">
                <div className="text-terminal-muted text-xs mb-2 italic">Este bono ya ha vencido (Matured).</div>
                <div className="text-[10px] text-terminal-muted/60">No hay pagos futuros.</div>
              </div>
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
