import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight, Search, ArrowUpDown } from 'lucide-react'
import { useBondsData } from '../hooks/useBondsData'
import { useDolarMEP } from '../hooks/useDolarMEP'
import BondDetailPanel from './BondDetailPanel'
import { parseInterestString, parseAmortString } from '../utils/bondMath'
import { getNextBusinessDay, daysBetween } from '../utils/bondEngine'
import { formatPct } from '../utils/formatters'
import bondProspectos from '../data/bondProspectos.json'

/**
 * AnalysisTab — Enriched bond data table.
 * Static-first approach for performance.
 */
export default function AnalysisTab() {
  const { data, loading, error, lastUpdated } = useBondsData()
  const { mep } = useDolarMEP()

  const [expandedTicker, setExpandedTicker] = useState(null)
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState('symbol')
  const [sortDir, setSortDir] = useState('asc')

  const dTickers = useMemo(() => {
    return data.filter(row => row.symbol && row.symbol.endsWith('D'))
  }, [data])

  const globalSettlementDate = useMemo(() => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    return getNextBusinessDay(tomorrow.toISOString().split('T')[0])
  }, [])

  // Metadata fetching removed as all data is now static in bondProspectos.json

  const filteredData = useMemo(() => {
    let filtered = [...dTickers]

    if (filter) {
      const q = filter.toLowerCase()
      filtered = filtered.filter(row => {
        const prospecto = bondProspectos[row.symbol]
        const name = prospecto?.name?.toLowerCase() || ''
        return row.symbol.toLowerCase().includes(q) || name.includes(q)
      })
    }

    filtered.sort((a, b) => {
      let va, vb
      const prosA = bondProspectos[a.symbol]
      const prosB = bondProspectos[b.symbol]

      if (sortKey === 'symbol') {
        va = a.symbol; vb = b.symbol
      } else if (sortKey === 'emisor') {
        va = prosA?.name || ''; vb = prosB?.name || ''
      } else if (sortKey === 'precio') {
        va = a.c || 0; vb = b.c || 0
      } else if (sortKey === 'pct_change') {
        va = a.pct_change || 0; vb = b.pct_change || 0
      } else if (sortKey === 'dias') {
        const d1 = prosA?.maturity_date ? daysBetween(globalSettlementDate, new Date(prosA.maturity_date + 'T00:00:00')) : 99999
        const d2 = prosB?.maturity_date ? daysBetween(globalSettlementDate, new Date(prosB.maturity_date + 'T00:00:00')) : 99999
        va = d1; vb = d2;
      } else if (sortKey === 'ley') {
        va = prosA?.law || ''; vb = prosB?.law || ''
      } else if (sortKey === 'calif') {
        va = prosA?.rating || ''; vb = prosB?.rating || ''
      } else {
        va = a[sortKey] || 0; vb = b[sortKey] || 0
      }

      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })

    return filtered
  }, [dTickers, filter, sortKey, sortDir])

  const toggleExpand = useCallback((ticker) => {
    setExpandedTicker(prev => prev === ticker ? null : ticker)
  }, [])

  const handleSort = useCallback((key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  if (loading && data.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-12 skeleton rounded-md" />
        ))}
      </div>
    )
  }

  const columns = [
    { key: 'expand', label: '', width: 'w-8' },
    { key: 'symbol', label: 'Ticker', sortable: true },
    { key: 'emisor', label: 'Emisora', sortable: true },
    { key: 'dias', label: 'Días', sortable: true },
    { key: 'ley', label: 'Ley', sortable: true },
    { key: 'precio', label: 'Precio', sortable: true },
    { key: 'pct_change', label: 'Var %', sortable: true },
    { key: 'cupon', label: 'Cupón', sortable: false },
    { key: 'dolar', label: 'Dólar', sortable: false },
    { key: 'calif', label: 'Calif.', sortable: true },
  ]

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted" />
          <input
            type="text"
            placeholder="Buscar ticker, emisora o prospecto..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-terminal-panel border border-terminal-border rounded-lg 
                       text-sm font-mono text-terminal-text focus:outline-none focus:ring-1 focus:ring-terminal-accent"
          />
        </div>

        <div className="flex items-center gap-4">
          {mep?.value && (
            <div className="px-3 py-1.5 bg-terminal-surface rounded-lg border border-terminal-border flex items-center gap-2 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-terminal-muted tracking-wider">Dólar MEP</span>
              <span className="text-sm font-mono font-bold text-terminal-accent">${mep.value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-terminal-border bg-terminal-panel shadow-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-terminal-surface/50 border-b border-terminal-border">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-terminal-muted 
                             ${col.sortable ? 'cursor-pointer hover:text-terminal-text' : ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      <ArrowUpDown size={10} className="text-terminal-accent" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-terminal-border/40">
            {filteredData.map(row => {
              const prospecto = bondProspectos[row.symbol]
              const interest = prospecto?.coupon_rate ? { rate: prospecto.coupon_rate } : null
              const dias = prospecto?.maturity_date ? daysBetween(globalSettlementDate, new Date(prospecto.maturity_date + 'T00:00:00')) : null
              const isExpanded = expandedTicker === row.symbol

              return (
                <React.Fragment key={row.symbol}>
                  <tr
                    className={`tr-row cursor-pointer ${isExpanded ? 'bg-terminal-surface' : 'hover:bg-terminal-surface/30'}`}
                    onClick={() => toggleExpand(row.symbol)}
                  >
                    <td className="px-4 py-3 text-center">
                      {isExpanded ? <ChevronDown size={14} className="text-terminal-accent" /> : <ChevronRight size={14} className="text-terminal-muted" />}
                    </td>
                    <td className="px-4 py-3">
                      <span className="ticker-badge px-2 py-0.5 rounded text-[11px] font-bold">{row.symbol}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-terminal-text truncate max-w-[180px]" title={prospecto?.name}>
                      {prospecto?.name || <span className="text-terminal-muted opacity-50">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-center">
                      {dias != null ? (
                        <span className={dias < 365 ? 'text-down font-bold' : 'text-terminal-text'}>{dias}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prospecto?.law && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${prospecto.law === 'NY' ? 'bg-terminal-accent text-terminal-bg' : 'bg-terminal-surface text-terminal-muted border border-terminal-border'}`}>
                          {prospecto.law}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-right">
                      {row.c != null ? row.c.toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                       {row.pct_change != null ? (
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold font-mono ${row.pct_change > 0 ? 'bg-up/10 text-up' : row.pct_change < 0 ? 'bg-down/10 text-down' : 'bg-terminal-surface text-terminal-muted'}`}>
                          {formatPct(row.pct_change)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-center text-terminal-accent">
                      {interest?.rate ? `${interest.rate}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prospecto?.currency_type && (
                        <span className="text-[10px] font-bold uppercase text-terminal-muted bg-terminal-surface px-1.5 py-0.5 rounded border border-terminal-border">
                          {prospecto.currency_type}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-[11px] font-mono font-bold text-terminal-muted">{prospecto?.rating || '—'}</span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={columns.length} className="bg-terminal-bg/50 p-0">
                        <BondDetailPanel
                          bond={row}
                          prospecto={prospecto}
                          dolarMEP={mep}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
