import { useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  Award,
  Clock,
  DollarSign,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { analyzeBond, daysBetween, getNextBusinessDay } from '../utils/bondEngine'
import { formatPct, formatPctSimple } from '../utils/formatters'
import bondProspectos from '../data/bondProspectos.json'

const formatPx = (value) => (value != null ? `$${value.toFixed(2)}` : '—')

function EmptyPanel({ message }) {
  return (
    <div className="rounded-lg border border-dashed border-terminal-border px-4 py-6 text-center text-sm text-terminal-muted">
      {message}
    </div>
  )
}

function MetricCard({ title, value, sub, icon: Icon, colorClass }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-terminal-border bg-terminal-panel p-5 shadow-sm">
      <div className={`flex-shrink-0 rounded-lg border p-3 ${colorClass}`}>
        <Icon size={20} />
      </div>
      <div>
        <h3 className="mb-1 text-[11px] font-bold uppercase tracking-widest text-terminal-muted">{title}</h3>
        <div className="text-2xl font-mono font-bold tabular-nums text-terminal-text">{value}</div>
        {sub && <div className="mt-1 text-xs text-terminal-muted">{sub}</div>}
      </div>
    </div>
  )
}

function HighlightRow({ bond, valueLabel, highlightClass = 'text-terminal-accent' }) {
  return (
    <div className="flex items-center justify-between rounded-md border-b border-terminal-border/40 px-2 py-2.5 last:border-0 hover:bg-terminal-surface/20">
      <div className="flex items-center gap-3">
        <span className="ticker-badge !border !border-terminal-border/50 !bg-terminal-surface !text-terminal-text">
          {bond.symbol}
        </span>
        {bond.law && (
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${bond.law === 'NY' ? 'bg-terminal-accent/10 text-terminal-accent' : 'bg-terminal-surface text-terminal-muted'}`}>
            {bond.law}
          </span>
        )}
      </div>
      <div className={`text-right font-mono text-sm font-bold ${highlightClass}`}>{valueLabel}</div>
    </div>
  )
}

export default function Home({ bonds, dolarMEP, riesgoPais }) {
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState('symbol')
  const [sortDir, setSortDir] = useState('asc')

  const { enriched, kpis, lowPar, topYTM, topMovers } = useMemo(() => {
    if (!bonds?.length) {
      return {
        enriched: [],
        kpis: {},
        lowPar: [],
        topYTM: [],
        topMovers: { gainers: [], losers: [] },
      }
    }

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const settlementDate = getNextBusinessDay(tomorrow.toISOString().split('T')[0])

    let upCount = 0
    let downCount = 0
    let totalVol = 0
    const dList = []

    bonds.forEach((rawRow) => {
      if (rawRow.pct_change > 0) upCount += 1
      if (rawRow.pct_change < 0) downCount += 1
      if (rawRow.v > 0) totalVol += rawRow.v

      const symbol = rawRow.symbol
      if (!symbol || !symbol.endsWith('D')) return

      const prospecto = bondProspectos[symbol]
      const px = rawRow.c
      const chg = rawRow.pct_change || 0

      let ytm = null
      let daysToCoupon = null
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
            nextPaymentAmt = nextFlow.totalAmt * 10
            daysToCoupon = daysBetween(today, new Date(`${nextFlow.rawDate}T00:00:00`))
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
        nextPaymentAmt,
      })
    })

    const lowPar = dList
      .filter((bond) => bond.px && bond.px < 100 && bond.ytm && bond.couponRate && bond.ytm > bond.couponRate)
      .sort((a, b) => b.ytm - a.ytm)
      .slice(0, 5)

    const topYTM = dList
      .filter((bond) => bond.ytm != null)
      .sort((a, b) => b.ytm - a.ytm)
      .slice(0, 5)

    const withChg = dList.filter((bond) => bond.chg !== 0).sort((a, b) => b.chg - a.chg)

    return {
      enriched: dList,
      kpis: {
        total: dList.length,
        upCount,
        downCount,
        totalVol,
      },
      lowPar,
      topYTM,
      topMovers: {
        gainers: withChg.slice(0, 5),
        losers: withChg.slice(-5).reverse(),
      },
    }
  }, [bonds])

  const filteredTable = useMemo(() => {
    let result = [...enriched]

    if (filter) {
      const query = filter.toLowerCase()
      result = result.filter((bond) =>
        bond.symbol?.toLowerCase().includes(query) ||
        bond.name?.toLowerCase().includes(query)
      )
    }

    result.sort((a, b) => {
      let va = a[sortKey]
      let vb = b[sortKey]

      if (va == null) va = sortDir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
      if (vb == null) vb = sortDir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY

      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }

      return sortDir === 'asc' ? va - vb : vb - va
    })

    return result
  }, [enriched, filter, sortDir, sortKey])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDir(['ytm', 'chg', 'px'].includes(key) ? 'desc' : 'asc')
  }

  if (!bonds?.length) return null

  const topMovementMix = [...topMovers.gainers, ...topMovers.losers].slice(0, 5)

  return (
    <div className="space-y-8 pb-12">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total instrumentos USD"
          value={kpis.total}
          sub={
            <span className="flex gap-3 font-bold">
              <span className="flex items-center text-up"><TrendingUp size={12} className="mr-1" />{kpis.upCount}</span>
              <span className="flex items-center text-down"><TrendingDown size={12} className="mr-1" />{kpis.downCount}</span>
            </span>
          }
          icon={Activity}
          colorClass="bg-terminal-surface text-terminal-text"
        />
        <MetricCard
          title="Dolar MEP"
          value={dolarMEP?.value ? `$${dolarMEP.value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—'}
          sub={dolarMEP?.timestamp ? `Act: ${new Date(dolarMEP.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : 'Sin referencia'}
          icon={DollarSign}
          colorClass="border-up/20 bg-up/10 text-up"
        />
        <MetricCard
          title="Riesgo pais"
          value={riesgoPais?.value ? `${riesgoPais.value} bps` : '—'}
          sub={riesgoPais?.timestamp ? `Fecha: ${riesgoPais.timestamp.split('-').reverse().join('/')}` : 'Sin referencia'}
          icon={Target}
          colorClass="border-terminal-accent/20 bg-terminal-accent/10 text-terminal-accent"
        />
        <MetricCard
          title="Volumen nominal"
          value={`$${((kpis.totalVol || 0) / 1000000).toFixed(1)}M`}
          sub="Millones operados en la rueda"
          icon={Activity}
          colorClass="bg-terminal-surface text-terminal-text"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-panel shadow-card">
          <div className="flex items-center gap-2 border-b border-terminal-border bg-terminal-surface/30 px-5 py-4">
            <AlertCircle size={16} className="text-terminal-accent" />
            <h3 className="text-sm font-bold text-terminal-text">Oportunidades bajo par</h3>
          </div>
          <div className="p-3">
            {lowPar.length ? lowPar.map((bond) => (
              <HighlightRow
                key={bond.symbol}
                bond={bond}
                valueLabel={(
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-medium text-terminal-muted">
                      Paridad: <span className="text-terminal-text">{formatPctSimple(bond.paridad)}</span>
                    </span>
                    <span>TIR {formatPctSimple(bond.ytm)}</span>
                  </div>
                )}
              />
            )) : <EmptyPanel message="No hay bonos bajo par destacados con la data actual." />}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-panel shadow-card">
          <div className="flex items-center gap-2 border-b border-terminal-border bg-terminal-surface/30 px-5 py-4">
            <Award size={16} className="text-up" />
            <h3 className="text-sm font-bold text-terminal-text">Mejores TIR</h3>
          </div>
          <div className="p-3">
            {topYTM.length ? topYTM.map((bond) => (
              <HighlightRow
                key={bond.symbol}
                bond={bond}
                valueLabel={formatPctSimple(bond.ytm)}
                highlightClass="text-up"
              />
            )) : <EmptyPanel message="Todavia no hay metricas suficientes para rankear TIR." />}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-panel shadow-card">
          <div className="flex items-center gap-2 border-b border-terminal-border bg-terminal-surface/30 px-5 py-4">
            <TrendingUp size={16} className="text-terminal-text" />
            <h3 className="text-sm font-bold text-terminal-text">Mayores movimientos</h3>
          </div>
          <div className="p-3">
            {topMovementMix.length ? topMovementMix.map((bond) => (
              <HighlightRow
                key={bond.symbol}
                bond={bond}
                valueLabel={formatPct(bond.chg)}
                highlightClass={bond.chg > 0 ? 'text-up' : 'text-down'}
              />
            )) : <EmptyPanel message="No hubo variaciones destacadas en la ultima carga." />}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-terminal-text">
            <ArrowRight size={18} className="text-terminal-accent" />
            Screener consolidado
          </h2>
          <div className="relative w-full sm:max-w-xs">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted" />
            <input
              type="text"
              placeholder="Buscar ticker o emisor..."
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="w-full rounded-lg border border-terminal-border bg-terminal-panel py-2 pl-9 pr-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-terminal-accent"
              aria-label="Buscar ticker o emisor"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-panel shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-terminal-border bg-terminal-surface/50">
                <tr>
                  {[
                    { k: 'symbol', l: 'Ticker' },
                    { k: 'name', l: 'Nombre' },
                    { k: 'px', l: 'Precio' },
                    { k: 'chg', l: 'Var%' },
                    { k: 'ytm', l: 'TIR' },
                    { k: 'couponRate', l: 'Cupon' },
                    { k: 'daysToCoupon', l: 'Dias al cupon' },
                    { k: 'nextPaymentAmt', l: 'Prox. USD/mil' },
                    { k: 'law', l: 'Ley' },
                    { k: 'rating', l: 'Calif.' },
                  ].map((column) => (
                    <th
                      key={column.k}
                      onClick={() => handleSort(column.k)}
                      className="cursor-pointer whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-terminal-muted hover:text-terminal-text"
                    >
                      <div className="flex items-center gap-1.5">
                        {column.l}
                        {sortKey === column.k && <ArrowUpDown size={10} className="text-terminal-accent" />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border/40">
                {filteredTable.length ? filteredTable.map((bond) => (
                  <tr key={bond.symbol} className="group hover:bg-terminal-surface/30">
                    <td className="px-4 py-2.5">
                      <span className="ticker-badge">{bond.symbol}</span>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-2.5 text-[11px] font-medium text-terminal-text" title={bond.name}>
                      {bond.name || '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold tabular-nums">{formatPx(bond.px)}</td>
                    <td className="px-4 py-2.5 font-mono">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${bond.chg > 0 ? 'bg-up/10 text-up' : bond.chg < 0 ? 'bg-down/10 text-down' : 'text-terminal-muted'}`}>
                        {bond.chg ? formatPct(bond.chg) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold tabular-nums text-terminal-accent">
                      {bond.ytm != null ? formatPctSimple(bond.ytm) : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">{bond.couponRate != null ? `${bond.couponRate}%` : '—'}</td>
                    <td className="px-4 py-2.5 text-center font-mono">
                      {bond.daysToCoupon != null ? (
                        <span className={`flex items-center justify-center gap-1 font-bold tabular-nums ${bond.daysToCoupon < 15 ? 'text-down' : bond.daysToCoupon < 30 ? 'text-[#FBBF24]' : 'text-terminal-muted'}`}>
                          {bond.daysToCoupon <= 30 && <Clock size={12} />}
                          {bond.daysToCoupon}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-up">
                      {bond.nextPaymentAmt != null ? `$${bond.nextPaymentAmt.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {bond.law ? (
                        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${bond.law === 'NY' ? 'border-terminal-accent/20 bg-terminal-accent/10 text-terminal-accent' : 'border-terminal-border bg-transparent text-terminal-muted'}`}>
                          {bond.law}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center text-[10px] font-bold text-terminal-muted">
                      {bond.rating || '—'}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={10} className="px-4 py-10">
                      <EmptyPanel message="No hubo resultados para ese filtro. Probá con ticker o nombre del emisor." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
