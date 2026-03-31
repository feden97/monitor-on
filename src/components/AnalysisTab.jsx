import { Fragment, useMemo, useState } from 'react'
import { ArrowUpDown, ChevronDown, ChevronRight, Search } from 'lucide-react'
import BondDetailPanel from './BondDetailPanel'
import { daysBetween, getNextBusinessDay } from '../utils/bondEngine'
import { formatPct, formatTime } from '../utils/formatters'
import bondProspectos from '../data/bondProspectos.json'

function EmptyState({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-terminal-border px-5 py-10 text-center text-sm text-terminal-muted">
      {message}
    </div>
  )
}

export default function AnalysisTab({ bonds, loading, error, dolarMEP, lastUpdated, filter = '', onFilterChange }) {
  const [expandedTicker, setExpandedTicker] = useState(null)
  const [sortKey, setSortKey] = useState('symbol')
  const [sortDir, setSortDir] = useState('asc')

  const dTickers = useMemo(
    () => bonds.filter((row) => row.symbol && row.symbol.endsWith('D')),
    [bonds]
  )

  const globalSettlementDate = useMemo(() => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    return getNextBusinessDay(tomorrow.toISOString().split('T')[0])
  }, [])

  const filteredData = useMemo(() => {
    let filtered = [...dTickers]

    if (filter) {
      const query = filter.toLowerCase()
      filtered = filtered.filter((row) => {
        const prospecto = bondProspectos[row.symbol]
        const name = prospecto?.name?.toLowerCase() || ''
        return row.symbol.toLowerCase().includes(query) || name.includes(query)
      })
    }

    filtered.sort((a, b) => {
      const prosA = bondProspectos[a.symbol]
      const prosB = bondProspectos[b.symbol]
      let va
      let vb

      switch (sortKey) {
        case 'symbol':
          va = a.symbol
          vb = b.symbol
          break
        case 'emisor':
          va = prosA?.name || ''
          vb = prosB?.name || ''
          break
        case 'precio':
          va = a.c || 0
          vb = b.c || 0
          break
        case 'pct_change':
          va = a.pct_change || 0
          vb = b.pct_change || 0
          break
        case 'dias':
          va = prosA?.maturity_date ? daysBetween(globalSettlementDate, new Date(`${prosA.maturity_date}T00:00:00`)) : Number.POSITIVE_INFINITY
          vb = prosB?.maturity_date ? daysBetween(globalSettlementDate, new Date(`${prosB.maturity_date}T00:00:00`)) : Number.POSITIVE_INFINITY
          break
        case 'ley':
          va = prosA?.law || ''
          vb = prosB?.law || ''
          break
        case 'calif':
          va = prosA?.rating || ''
          vb = prosB?.rating || ''
          break
        default:
          va = a[sortKey] || 0
          vb = b[sortKey] || 0
      }

      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }

      return sortDir === 'asc' ? va - vb : vb - va
    })

    return filtered
  }, [dTickers, filter, globalSettlementDate, sortDir, sortKey])

  function toggleExpand(ticker) {
    setExpandedTicker((prev) => (prev === ticker ? null : ticker))
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDir(key === 'pct_change' || key === 'precio' ? 'desc' : 'asc')
  }

  if (loading && !bonds.length) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="skeleton h-12 rounded-md" />
        ))}
      </div>
    )
  }

  if (error && !bonds.length) {
    return <EmptyState message="No se pudieron cargar bonos para el panel de analisis." />
  }

  const columns = [
    { key: 'expand', label: '', sortable: false },
    { key: 'symbol', label: 'Ticker', sortable: true },
    { key: 'emisor', label: 'Emisora', sortable: true },
    { key: 'dias', label: 'Dias', sortable: true },
    { key: 'ley', label: 'Ley', sortable: true },
    { key: 'precio', label: 'Precio', sortable: true },
    { key: 'pct_change', label: 'Var %', sortable: true },
    { key: 'cupon', label: 'Cupon', sortable: false },
    { key: 'dolar', label: 'Moneda', sortable: false },
    { key: 'calif', label: 'Calif.', sortable: true },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted" />
          <input
            type="text"
            placeholder="Buscar ticker o emisora..."
            value={filter}
            onChange={(event) => onFilterChange?.(event.target.value)}
            className="w-full rounded-lg border border-terminal-border bg-terminal-panel py-2 pl-10 pr-4 text-sm font-mono text-terminal-text focus:outline-none focus:ring-1 focus:ring-terminal-accent"
            aria-label="Buscar ticker o emisora"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-terminal-border bg-terminal-surface px-3 py-1.5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-terminal-muted">Bonos USD</span>
            <div className="text-sm font-mono font-bold tabular-nums text-terminal-text">{dTickers.length}</div>
          </div>
          {dolarMEP?.value && (
            <div className="rounded-lg border border-terminal-border bg-terminal-surface px-3 py-1.5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-terminal-muted">Dolar MEP</span>
              <div className="text-sm font-mono font-bold tabular-nums text-terminal-accent">
                ${dolarMEP.value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}
          {lastUpdated && (
            <div className="rounded-lg border border-terminal-border bg-terminal-surface px-3 py-1.5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-terminal-muted">Mercado</span>
              <div className="text-sm font-mono font-bold tabular-nums text-terminal-text">{formatTime(lastUpdated, false)}</div>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-terminal-border bg-terminal-panel shadow-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-terminal-border bg-terminal-surface/50">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-terminal-muted ${column.sortable ? 'cursor-pointer hover:text-terminal-text' : ''}`}
                  onClick={column.sortable ? () => handleSort(column.key) : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    {column.label}
                    {column.sortable && sortKey === column.key && (
                      <ArrowUpDown size={10} className="text-terminal-accent" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-terminal-border/40">
            {filteredData.length ? filteredData.map((row) => {
              const prospecto = bondProspectos[row.symbol]
              const dias = prospecto?.maturity_date
                ? daysBetween(globalSettlementDate, new Date(`${prospecto.maturity_date}T00:00:00`))
                : null
              const isExpanded = expandedTicker === row.symbol

              return (
                <Fragment key={row.symbol}>
                  <tr
                    className={`tr-row cursor-pointer ${isExpanded ? 'bg-terminal-surface' : 'hover:bg-terminal-surface/30'}`}
                    onClick={() => toggleExpand(row.symbol)}
                  >
                    <td className="px-4 py-3 text-center">
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-terminal-accent" />
                      ) : (
                        <ChevronRight size={14} className="text-terminal-muted" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="ticker-badge rounded px-2 py-0.5 text-[11px] font-bold">{row.symbol}</span>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 font-medium text-terminal-text" title={prospecto?.name}>
                      {prospecto?.name || <span className="text-terminal-muted opacity-50">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">
                      {dias != null ? (
                        <span className={dias < 365 ? 'font-bold text-down' : 'text-terminal-text'}>{dias}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prospecto?.law ? (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${prospecto.law === 'NY' ? 'bg-terminal-accent text-terminal-bg' : 'border border-terminal-border bg-terminal-surface text-terminal-muted'}`}>
                          {prospecto.law}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                      {row.c != null ? row.c.toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.pct_change != null ? (
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold font-mono ${row.pct_change > 0 ? 'bg-up/10 text-up' : row.pct_change < 0 ? 'bg-down/10 text-down' : 'bg-terminal-surface text-terminal-muted'}`}>
                          {formatPct(row.pct_change)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold tabular-nums text-terminal-accent">
                      {prospecto?.coupon_rate ? `${prospecto.coupon_rate}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prospecto?.currency_type ? (
                        <span className="rounded border border-terminal-border bg-terminal-surface px-1.5 py-0.5 text-[10px] font-bold uppercase text-terminal-muted">
                          {prospecto.currency_type}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-[11px] font-mono font-bold text-terminal-muted">{prospecto?.rating || '—'}</span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={columns.length} className="bg-terminal-bg/50 p-0">
                        <BondDetailPanel bond={row} prospecto={prospecto} dolarMEP={dolarMEP} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            }) : (
              <tr>
                <td colSpan={columns.length} className="p-6">
                  <EmptyState message="No hay bonos que coincidan con el filtro actual." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
