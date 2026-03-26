import React, { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { formatPrice, formatNumber, formatPct, getChangeDirection } from '../utils/formatters'

const columnHelper = createColumnHelper()

// ── Sub-components ─────────────────────────────────────────────────────────

function SortIcon({ column }) {
  const sorted = column.getIsSorted()
  if (!sorted) return <ArrowUpDown size={12} className="opacity-30 ml-1 inline" />
  if (sorted === 'asc') return <ArrowUp size={12} className="text-highlight ml-1 inline" />
  return <ArrowDown size={12} className="text-highlight ml-1 inline" />
}

function ChangePill({ value }) {
  if (value == null || isNaN(value)) return <span className="text-terminal-muted font-mono text-xs">—</span>
  const dir = getChangeDirection(value)
  const cls = dir === 'up' ? 'change-up' : dir === 'down' ? 'change-down' : 'change-flat'
  return (
    <span className={cls}>
      {dir === 'up' && <ArrowUp size={10} />}
      {dir === 'down' && <ArrowDown size={10} />}
      {formatPct(value)}
    </span>
  )
}

function SkeletonRow({ cols }) {
  return (
    <tr className="tr-row">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="td-cell">
          <div className="skeleton h-4 w-full" style={{ maxWidth: i === 0 ? '80px' : '100px' }} />
        </td>
      ))}
    </tr>
  )
}

// ── Column definitions ──────────────────────────────────────────────────────

function buildColumns() {
  return [
    columnHelper.accessor('symbol', {
      id: 'symbol',
      header: 'Ticker',
      cell: (info) => (
        <span className="ticker-badge">{info.getValue()}</span>
      ),
      sortingFn: 'alphanumeric',
      size: 100,
    }),

    columnHelper.accessor('c', {
      id: 'c',
      header: 'Último',
      cell: (info) => (
        <span className="font-mono text-terminal-text font-medium">
          {formatPrice(info.getValue(), info.row.original.symbol)}
        </span>
      ),
      sortingFn: 'basic',
      size: 130,
    }),

    columnHelper.accessor('px_bid', {
      id: 'px_bid',
      header: 'Compra',
      cell: (info) => (
        <span className="font-mono text-up font-medium">
          {formatPrice(info.getValue(), info.row.original.symbol)}
        </span>
      ),
      sortingFn: 'basic',
      size: 130,
    }),

    columnHelper.accessor('px_ask', {
      id: 'px_ask',
      header: 'Venta',
      cell: (info) => (
        <span className="font-mono text-down font-medium">
          {formatPrice(info.getValue(), info.row.original.symbol)}
        </span>
      ),
      sortingFn: 'basic',
      size: 130,
    }),

    columnHelper.accessor('v', {
      id: 'v',
      header: 'Volumen',
      cell: (info) => (
        <span className="font-mono text-terminal-muted">
          {formatNumber(info.getValue())}
        </span>
      ),
      sortingFn: 'basic',
      size: 100,
    }),

    columnHelper.accessor('q_op', {
      id: 'q_op',
      header: 'Operaciones',
      cell: (info) => (
        <span className="font-mono text-terminal-muted">
          {formatNumber(info.getValue())}
        </span>
      ),
      sortingFn: 'basic',
      size: 110,
    }),

    columnHelper.accessor('pct_change', {
      id: 'pct_change',
      header: 'Variación %',
      cell: (info) => <ChangePill value={info.getValue()} />,
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.pct_change ?? 0
        const b = rowB.original.pct_change ?? 0
        return a < b ? -1 : a > b ? 1 : 0
      },
      size: 130,
    }),
  ]
}

// ── Main component ──────────────────────────────────────────────────────────

export default function BondsTable({ data, loading, globalFilter, setGlobalFilter }) {
  const [sorting, setSorting] = useState([{ id: 'pct_change', desc: true }])

  const columns = useMemo(buildColumns, [])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _colId, filterValue) => {
      const q = String(filterValue).toLowerCase()
      return row.original.symbol?.toLowerCase().includes(q)
    },
  })

  const rows = table.getRowModel().rows
  const headers = table.getHeaderGroups()

  return (
    <div className="overflow-x-auto rounded-lg border border-terminal-border shadow-sm">
      <table className="w-full border-collapse bg-terminal-panel text-sm">
        {/* ── Head ── */}
        <thead className="bg-terminal-surface">
          {headers.map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const canSort = header.column.getCanSort()
                return (
                  <th
                    key={header.id}
                    className={`th-cell ${canSort ? 'sortable' : ''}`}
                    style={{ width: header.column.columnDef.size }}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    title={canSort ? 'Ordenar columna' : undefined}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {canSort && <SortIcon column={header.column} />}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>

        {/* ── Body ── */}
        <tbody>
          {loading ? (
            // Skeleton rows while loading
            Array.from({ length: 12 }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="td-cell text-center text-terminal-muted py-12"
              >
                No se encontraron resultados.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="tr-row">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="td-cell">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Footer count ── */}
      {!loading && rows.length > 0 && (
        <div className="px-4 py-2 bg-terminal-surface border-t border-terminal-border text-xs text-terminal-muted font-mono">
          {rows.length} instrumento{rows.length !== 1 ? 's' : ''} mostrado{rows.length !== 1 ? 's' : ''}
          {data.length !== rows.length && ` de ${data.length} totales`}
        </div>
      )}
    </div>
  )
}
