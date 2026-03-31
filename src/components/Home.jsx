import React, { useMemo, useState, useCallback } from 'react'
import { analyzeBond, getNextBusinessDay, daysBetween } from '../utils/bondEngine'
import { formatPct, formatPctSimple, formatDate } from '../utils/formatters'
import bondProspectos from '../data/bondProspectos.json'
import { 
  TrendingUp, TrendingDown, Activity, AlertCircle, Award, 
  DollarSign, ArrowUpDown, Search, Clock, Target, ArrowRight 
} from 'lucide-react'

// Internal Helper for price display inside Home since we need 2 decimals mostly
const formatPx = (val) => val != null ? `$${val.toFixed(2)}` : '—'

export default function Home({ bonds, dolarMEP, riesgoPais }) {
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState('ytm')
  const [sortDir, setSortDir] = useState('desc')

  // ── 1. CORE ENGINE AGGREGATION ──
  const { enriched, kpis, lowPar, topYTM, topMovers } = useMemo(() => {
    if (!bonds || bonds.length === 0) return { enriched: [], kpis: {}, lowPar: [], topYTM: [], topMovers: { gainers: [], losers: [] } }

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const settlementDate = getNextBusinessDay(tomorrow.toISOString().split('T')[0])

    let upCount = 0
    let downCount = 0
    let totalVol = 0
    const dList = []

    bonds.forEach(rawRow => {
      // Global metrics
      if (rawRow.pct_change > 0) upCount++
      if (rawRow.pct_change < 0) downCount++
      if (rawRow.v > 0) totalVol += rawRow.v

      const symbol = rawRow.symbol
      if (!symbol || !symbol.endsWith('D')) return

      const prospecto = bondProspectos[symbol]
      const px = rawRow.c
      const chg = rawRow.pct_change || 0
      
      let ytm = null
      let daysToCoupon = null
      let nextPaymentDate = null
      let nextPaymentAmt = null
      let couponRate = prospecto?.coupon_rate || null
      let paridad = null

      if (px > 0 && prospecto) {
        const metrics = analyzeBond(px, prospecto, settlementDate)
        if (metrics) {
          ytm = metrics.ytm
          paridad = metrics.paridad
          
          const nextFlow = metrics.futureFlows?.[0]
          if (nextFlow) {
            nextPaymentDate = nextFlow.date
            // The engine computes totalAmt per 100 VN. User requested u$s/1000 VN -> multiply by 10
            nextPaymentAmt = nextFlow.totalAmt * 10 
            daysToCoupon = daysBetween(today, new Date(nextFlow.rawDate + 'T00:00:00'))
          }
        }
      }

      dList.push({
        symbol,
        name: prospecto?.name,
        law: prospecto?.law,
        rating: prospecto?.rating,
        px,
        chg,
        ytm,
        paridad,
        couponRate,
        daysToCoupon,
        nextPaymentDate,
        nextPaymentAmt
      })
    })

    // HIGHLIGHTS COMPUTATION
    const lowPar = dList
      .filter(b => b.px && b.px < 100 && b.ytm && b.couponRate && b.ytm > b.couponRate)
      .sort((a, b) => b.ytm - a.ytm)
      .slice(0, 5)

    const topYTM = dList
      .filter(b => b.ytm != null)
      .sort((a, b) => b.ytm - a.ytm)
      .slice(0, 5)

    const withChg = dList.filter(b => b.chg !== 0).sort((a, b) => b.chg - a.chg)
    const gainers = withChg.slice(0, 5)
    const losers = withChg.slice(-5).reverse()

    return {
      enriched: dList,
      kpis: { 
        total: dList.length, 
        upCount, 
        downCount, 
        totalVol 
      },
      lowPar,
      topYTM,
      topMovers: { gainers, losers }
    }
  }, [bonds])

  // ── 2. TABLE FILTERING & SORTING ──
  const filteredTable = useMemo(() => {
    let result = [...enriched]
    
    if (filter) {
      const q = filter.toLowerCase()
      result = result.filter(b => 
        (b.symbol && b.symbol.toLowerCase().includes(q)) || 
        (b.name && b.name.toLowerCase().includes(q))
      )
    }

    result.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey]
      
      // Handle nulls safely
      if (va == null) va = sortDir === 'asc' ? Infinity : -Infinity
      if (vb == null) vb = sortDir === 'asc' ? Infinity : -Infinity

      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })

    return result
  }, [enriched, filter, sortKey, sortDir])

  const handleSort = useCallback((key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc') // Reset to ascending on new column
      // Exceptions: YTM, Chg, and Px usually make more sense descending first, but we keep it simple
    }
  }, [sortKey])

  if (!bonds || bonds.length === 0) return null

  // ── RENDER HELPERS ──
  const MetricCard = ({ title, value, sub, icon: Icon, colorClass }) => (
    <div className="bg-terminal-panel border border-terminal-border rounded-xl p-5 flex items-start gap-4 shadow-sm">
      <div className={`p-3 rounded-lg flex-shrink-0 ${colorClass}`}>
        <Icon size={20} />
      </div>
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-terminal-muted mb-1">{title}</h3>
        <div className="text-2xl font-mono font-bold text-terminal-text">{value}</div>
        {sub && <div className="text-xs text-terminal-muted mt-1 font-sans">{sub}</div>}
      </div>
    </div>
  )

  const HighlightRow = ({ bond, valueLabel, highlightClass = 'text-terminal-accent' }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-terminal-border/40 last:border-0 hover:bg-terminal-surface/20 px-2 rounded-md cursor-default">
      <div className="flex items-center gap-3">
        <span className="ticker-badge !bg-terminal-surface !text-terminal-text !border !border-terminal-border/50">{bond.symbol}</span>
        {bond.law && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${bond.law === 'NY' ? 'bg-terminal-accent/10 text-terminal-accent' : 'bg-terminal-surface text-terminal-muted'}`}>
            {bond.law}
          </span>
        )}
      </div>
      <div className={`font-mono font-bold text-sm ${highlightClass}`}>
        {valueLabel}
      </div>
    </div>
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* ── 1. KPI HEADER ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Total Instrumentos" 
          value={kpis.total} 
          sub={
            <span className="font-bold flex gap-3">
              <span className="text-up flex items-center"><TrendingUp size={12} className="mr-1"/>{kpis.upCount}</span>
              <span className="text-down flex items-center"><TrendingDown size={12} className="mr-1"/>{kpis.downCount}</span>
            </span>
          }
          icon={Activity} 
          colorClass="bg-terminal-surface text-terminal-text border border-terminal-border" 
        />
        <MetricCard 
          title="Dólar MEP Actual" 
          value={dolarMEP?.value ? `$${dolarMEP.value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—'} 
          sub={dolarMEP?.timestamp ? `Act: ${new Date(dolarMEP.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : '—'}
          icon={DollarSign} 
          colorClass="bg-up/10 text-up border border-up/20" 
        />
        <MetricCard 
          title="Riesgo País (EMBI+)" 
          value={riesgoPais?.value ? `${riesgoPais.value} bps` : '—'} 
          sub={riesgoPais?.timestamp ? `Act: ${riesgoPais.timestamp.split('-').reverse().join('/')}` : 'Actualizando...'}
          icon={Target} 
          colorClass="bg-terminal-accent/10 text-terminal-accent border border-terminal-accent/20" 
        />
        <MetricCard 
          title="Volumen Nominal Diario" 
          value={`$${(kpis.totalVol / 1000000).toFixed(1)}M`} 
          sub="Millones operados hoy"
          icon={Activity} 
          colorClass="bg-terminal-surface text-terminal-text border border-terminal-border" 
        />
      </section>

      {/* ── 2. HIGHLIGHTS / ALERTAS ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Col 1: Bonos Bajo Par */}
        <div className="bg-terminal-panel rounded-xl border border-terminal-border overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-terminal-border bg-terminal-surface/30 flex items-center gap-2">
            <AlertCircle size={16} className="text-terminal-accent" />
            <h3 className="text-sm font-bold text-terminal-text">Oportunidades Bajo Par</h3>
          </div>
          <div className="p-3">
            {lowPar.map(b => (
               <HighlightRow 
                 key={b.symbol} 
                 bond={b} 
                 valueLabel={
                   <div className="flex flex-col items-end">
                     <span className="text-[10px] text-terminal-muted font-sans font-medium">Paridad: <span className="text-terminal-text">{formatPctSimple(b.paridad)}</span></span>
                     <span className="text-sm">TIR {formatPctSimple(b.ytm)}</span>
                   </div>
                 } 
               />
            ))}
          </div>
        </div>

        {/* Col 2: Mejores TIR Hoy */}
        <div className="bg-terminal-panel rounded-xl border border-terminal-border overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-terminal-border bg-terminal-surface/30 flex items-center gap-2">
            <Award size={16} className="text-up" />
            <h3 className="text-sm font-bold text-terminal-text">Mejores TIR (Efectiva)</h3>
          </div>
          <div className="p-3">
            {topYTM.map(b => (
               <HighlightRow 
                 key={b.symbol} 
                 bond={b} 
                 valueLabel={formatPctSimple(b.ytm)}
                 highlightClass="text-up"
               />
            ))}
          </div>
        </div>

        {/* Col 3: Mayores Movimientos */}
        <div className="bg-terminal-panel rounded-xl border border-terminal-border overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-terminal-border bg-terminal-surface/30 flex items-center gap-2">
            <TrendingUp size={16} className="text-terminal-text" />
            <h3 className="text-sm font-bold text-terminal-text">Mayores Movimientos</h3>
          </div>
          <div className="p-3">
            {[...topMovers.gainers, ...topMovers.losers].slice(0, 5).map(b => (
               <HighlightRow 
                 key={b.symbol} 
                 bond={b} 
                 valueLabel={formatPct(b.chg)}
                 highlightClass={b.chg > 0 ? 'text-up' : 'text-down'}
               />
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. TABLA RESUMEN EXTENDIDA ── */}
      <section>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <h2 className="text-lg font-bold font-sans tracking-tight text-terminal-text flex items-center gap-2">
            <ArrowRight size={18} className="text-terminal-accent" />
            Screener Consolidado
          </h2>
          <div className="relative w-full sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar ticker..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm font-mono bg-terminal-panel border border-terminal-border rounded-lg focus:ring-1 focus:ring-terminal-accent focus:outline-none"
            />
          </div>
        </div>

        <div className="bg-terminal-panel border border-terminal-border rounded-xl overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-terminal-surface/50 border-b border-terminal-border">
                <tr>
                  {[
                    { k: 'symbol', l: 'Ticker' },
                    { k: 'name', l: 'Nombre' },
                    { k: 'px', l: 'Precio' },
                    { k: 'chg', l: 'Var%' },
                    { k: 'ytm', l: 'TIR' },
                    { k: 'couponRate', l: 'Cupón' },
                    { k: 'daysToCoupon', l: 'Días al Cupón' },
                    { k: 'nextPaymentAmt', l: 'Próx. u$s/mil' },
                    { k: 'law', l: 'Ley' },
                    { k: 'rating', l: 'Calif' }
                  ].map(c => (
                    <th 
                      key={c.k} 
                      onClick={() => handleSort(c.k)}
                      className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-terminal-muted cursor-pointer hover:text-terminal-text select-none whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5">
                        {c.l}
                        {sortKey === c.k && <ArrowUpDown size={10} className="text-terminal-accent" />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border/40">
                {filteredTable.map(b => (
                  <tr key={b.symbol} className="hover:bg-terminal-surface/30 group">
                    <td className="px-4 py-2.5">
                      <span className="ticker-badge">{b.symbol}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] font-medium text-terminal-text truncate max-w-[150px]" title={b.name}>
                        {b.name || '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold">{formatPx(b.px)}</td>
                    <td className="px-4 py-2.5 font-mono">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${b.chg > 0 ? 'bg-up/10 text-up' : b.chg < 0 ? 'bg-down/10 text-down' : 'text-terminal-muted'}`}>
                          {b.chg ? formatPct(b.chg) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-terminal-accent">{b.ytm != null ? formatPctSimple(b.ytm) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono">{b.couponRate != null ? `${b.couponRate}%` : '—'}</td>
                    
                    {/* The critical Semaforo Días */}
                    <td className="px-4 py-2.5 font-mono text-center">
                      {b.daysToCoupon != null ? (
                        <span className={`flex items-center justify-center gap-1 font-bold ${b.daysToCoupon < 15 ? 'text-down animate-pulse' : b.daysToCoupon < 30 ? 'text-[#FBBF24]' : 'text-terminal-muted'}`}>
                          {b.daysToCoupon <= 30 && <Clock size={12} />}
                          {b.daysToCoupon}
                        </span>
                      ) : '—'}
                    </td>

                    <td className="px-4 py-2.5 font-mono font-bold text-right text-up">
                      {b.nextPaymentAmt != null ? `$${b.nextPaymentAmt.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {b.law && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${b.law === 'NY' ? 'bg-terminal-accent/10 border-terminal-accent/20 text-terminal-accent' : 'bg-transparent border-terminal-border text-terminal-muted'}`}>
                          {b.law}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-bold text-terminal-muted text-center">
                      {b.rating || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
