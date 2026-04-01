import { memo, useMemo, useState, useRef, useEffect } from 'react'
import { ArrowUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { analyzeBond, daysBetween, getNextBusinessDay } from '../utils/bondEngine'
import { formatDate, formatNumber, formatPctSimple } from '../utils/formatters'
import bondProspectos from '../data/bondProspectos.json'
import BondDetailPanel from './BondDetailPanel'

const DASH = '-'
const NAME_COL_WIDTH = 320
const USD_TICKER_COL_WIDTH = 80
const ARS_TICKER_COL_WIDTH = 80

const FOCUS_OPTIONS = [
  { id: 'all', label: 'Todo' },
  { id: 'coupon-soon', label: 'Pago cercano' },
  { id: 'discount', label: 'Bajo residual' },
  { id: 'income', label: 'Prox. cobro' },
]

function formatUsd(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return DASH
  return `$${value.toLocaleString('es-AR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function formatArs(value, digits = 0) {
  if (value == null || Number.isNaN(value)) return DASH
  return `$${value.toLocaleString('es-AR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function badgeTone(value, type) {
  if (value == null) return 'text-terminal-muted'

  if (type === 'days') {
    if (value <= 30) return 'bg-[#fde8e8] text-[#b42318] dark:bg-[#2d1414] dark:text-[#fca5a5]'
    if (value <= 90) return 'bg-[#fff4db] text-[#b45309] dark:bg-[#3b2a12] dark:text-[#fcd34d]'
    return 'bg-transparent text-terminal-text'
  }

  if (type === 'paridad') {
    if (value < 85) return 'bg-[#fde8e8] text-[#b42318] dark:bg-[#2d1414] dark:text-[#fca5a5]'
    if (value < 100) return 'bg-[#fff4db] text-[#b45309] dark:bg-[#3b2a12] dark:text-[#fcd34d]'
    return 'bg-transparent text-terminal-text'
  }

  if (type === 'ytm') {
    if (value >= 15) return 'bg-[#fde8e8] text-[#b42318] dark:bg-[#2d1414] dark:text-[#fca5a5]'
    if (value >= 10) return 'bg-[#fff4db] text-[#b45309] dark:bg-[#3b2a12] dark:text-[#fcd34d]'
    return 'bg-transparent text-terminal-text'
  }

  if (type === 'income') {
    if (value >= 60) return 'bg-[#e7f8ee] text-[#0f7a38] dark:bg-[#14281A] dark:text-[#86efac]'
    if (value >= 35) return 'bg-terminal-accent/10 text-terminal-accent'
    return 'bg-transparent text-terminal-text'
  }

  return 'bg-transparent text-terminal-text'
}

function cellPill(content, tone) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'min-w-[72px] justify-center rounded-sm font-mono font-medium',
        tone
      )}
    >
      {content}
    </Badge>
  )
}

function topRowsBy(rows, selector, comparator = 'max', limit = 5) {
  return [...rows]
    .filter((row) => {
      const value = selector(row)
      return value != null && !Number.isNaN(value)
    })
    .sort((a, b) => {
      const valueA = selector(a)
      const valueB = selector(b)
      return comparator === 'min' ? valueA - valueB : valueB - valueA
    })
    .slice(0, limit)
}

function RankingCard({ title, description, rows, renderValue, emptyLabel }) {
  return (
    <Card className="border-terminal-border bg-terminal-panel">
      <CardHeader className="px-4 py-3 pb-2">
        <CardTitle className="text-[11px] font-bold uppercase tracking-[0.16em] text-terminal-muted">
          {title}
        </CardTitle>
        <CardDescription className="text-xs text-terminal-muted">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-terminal-border/70 border-t border-terminal-border">
          {rows.length ? (
            rows.map((row, index) => (
              <div
                key={`${title}-${row.symbol}`}
                className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"
              >
                <div className="font-mono text-xs tabular-nums text-terminal-muted">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm font-semibold text-terminal-text">
                    {row.symbol}
                  </div>
                  <div className="truncate text-xs text-terminal-muted">
                    {row.name}
                  </div>
                </div>
                <div className="text-right font-mono text-sm font-semibold tabular-nums text-terminal-text">
                  {renderValue(row)}
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-terminal-muted">
              {emptyLabel}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const BondRow = memo(({
  row,
  stickyTickerStart,
  stickyTickerArsStart,
  NAME_COL_WIDTH,
  USD_TICKER_COL_WIDTH,
  ARS_TICKER_COL_WIDTH,
  onSelect,
  isMobile,
}) => {
  return (
    <TableRow
      className="cursor-pointer hover:bg-terminal-surface/40"
      onClick={() => onSelect(row)}
    >
      <TableCell
        style={!isMobile ? { left: 0, minWidth: NAME_COL_WIDTH, width: NAME_COL_WIDTH } : undefined}
        className={cn(
          "border-r border-b border-terminal-border px-2 py-1.5 align-middle",
          !isMobile && "sheet-sticky-name sticky z-10"
        )}
      >
        <div className="truncate font-medium text-terminal-text">{row.name}</div>
      </TableCell>
      <TableCell
        style={{
          left: isMobile ? 0 : stickyTickerStart,
          minWidth: USD_TICKER_COL_WIDTH,
          width: USD_TICKER_COL_WIDTH,
        }}
        className="sheet-sticky-cell sticky z-[9] border-r border-b border-terminal-border px-2 py-1 text-center font-mono text-terminal-text"
      >
        {row.symbol}
      </TableCell>
      <TableCell
        style={{
          left: isMobile ? USD_TICKER_COL_WIDTH : stickyTickerArsStart,
          minWidth: ARS_TICKER_COL_WIDTH,
          width: ARS_TICKER_COL_WIDTH,
        }}
        className={cn(
          "border-r border-b border-terminal-border px-2 py-1 text-center font-mono text-terminal-text",
          isMobile ? "sheet-sticky-cell sticky z-[9]" : "sheet-sticky-cell sticky z-[9]"
        )}
      >
        {row.tickerArs || DASH}
      </TableCell>
      <TableCell className="border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {row.couponRate != null ? formatPctSimple(row.couponRate) : DASH}
      </TableCell>
      <TableCell className="hidden md:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {row.frequency ?? DASH}
      </TableCell>
      <TableCell className="hidden lg:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {formatDate(row.maturityDate)}
      </TableCell>
      <TableCell className="border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {cellPill(
          row.daysToMaturity ?? DASH,
          badgeTone(row.daysToMaturity, 'days')
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {formatDate(row.nextCouponDate)}
      </TableCell>
      <TableCell className="border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {cellPill(row.daysToCoupon ?? DASH, badgeTone(row.daysToCoupon, 'days'))}
      </TableCell>
      <TableCell className="border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {formatUsd(row.priceUsd)}
      </TableCell>
      <TableCell className="hidden sm:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {formatArs(row.priceArs)}
      </TableCell>
      <TableCell className="hidden xl:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {formatUsd(row.impliedUsdFromPesos)}
      </TableCell>
      <TableCell className="border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {cellPill(formatPctSimple(row.ytm), badgeTone(row.ytm, 'ytm'))}
      </TableCell>
      <TableCell className="border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {cellPill(formatPctSimple(row.paridad), badgeTone(row.paridad, 'paridad'))}
      </TableCell>
      <TableCell className="hidden md:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {formatPctSimple(row.currentYield)}
      </TableCell>
      <TableCell className="hidden md:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {formatPctSimple(row.residualValue)}
      </TableCell>
      <TableCell className="hidden lg:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {row.amortType || DASH}
      </TableCell>
      <TableCell className="hidden xl:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {formatNumber(row.nominalesPerBase)}
      </TableCell>
      <TableCell className="hidden sm:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {formatUsd(row.nextCouponBase)}
      </TableCell>
      <TableCell className="hidden sm:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {formatUsd(row.nextAmortBase)}
      </TableCell>
      <TableCell className="border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {cellPill(
          formatUsd(row.nextTotalBase),
          badgeTone(row.nextTotalBase, 'income')
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {row.duration != null ? row.duration.toFixed(2) : DASH}
      </TableCell>
      <TableCell className="hidden lg:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {formatNumber(row.minInvestment)}
      </TableCell>
      <TableCell className="hidden lg:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {row.law || DASH}
      </TableCell>
      <TableCell className="hidden lg:table-cell border-r border-b border-terminal-border px-2 py-1 text-center font-mono">
        {row.currencyType || DASH}
      </TableCell>
      <TableCell className="hidden lg:table-cell border-b border-terminal-border px-2 py-1 text-center font-mono">
        {row.rating || DASH}
      </TableCell>
    </TableRow>
  )
})

BondRow.displayName = 'BondRow'

export default function Home({ bonds, dolarMEP, filter = '', onFilterChange }) {
  const [selectedBond, setSelectedBond] = useState(null)
  const [focus, setFocus] = useState('all')
  const [sortKey, setSortKey] = useState('symbol')
  const [sortDir, setSortDir] = useState('asc')
  const [investmentAmount, setInvestmentAmount] = useState('1000')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  const metricsCache = useRef(new Map())
  const lastSettlementDateStr = useRef('')

  const model = useMemo(() => {
    if (!bonds?.length) {
      return {
        rows: [],
        summary: null,
        coverage: null,
      }
    }

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const settlementDate = getNextBusinessDay(tomorrow.toISOString().split('T')[0])
    const settlementDateStr = settlementDate.toISOString().split('T')[0]

    // Reset cache if settlement date changes (new business day)
    if (lastSettlementDateStr.current !== settlementDateStr) {
      metricsCache.current.clear()
      lastSettlementDateStr.current = settlementDateStr
    }

    const arsQuotes = new Map(
      bonds
        .filter((bond) => bond.symbol?.endsWith('O'))
        .map((bond) => [bond.symbol, bond])
    )

    let missingProspecto = 0
    let missingCashflows = 0
    let missingRating = 0
    let missingTickerArs = 0

    const capitalBase = Number(investmentAmount)
    const validCapitalBase = Number.isFinite(capitalBase) && capitalBase > 0 ? capitalBase : 1000

    const rows = bonds
      .filter((bond) => bond.symbol?.endsWith('D'))
      .map((bond) => {
        const prospecto = bondProspectos[bond.symbol]
        if (!prospecto) missingProspecto += 1

        const tickerArs = prospecto?.ticker_o || `${bond.symbol.slice(0, -1)}O`
        const arsQuote = arsQuotes.get(tickerArs)?.c ?? null

        // Cache logic: only re-calculate metrics if price or prospecto changed
        const cacheKey = `${bond.symbol}-${bond.c}`
        let metrics = metricsCache.current.get(cacheKey)

        if (!metrics && bond.c > 0 && prospecto) {
          metrics = analyzeBond(bond.c, prospecto, settlementDate)
          metricsCache.current.set(cacheKey, metrics)
        }

        const nextFlow = metrics?.futureFlows?.[0] || null

        if (prospecto && !metrics) missingCashflows += 1
        if (!prospecto?.rating) missingRating += 1
        if (!arsQuote) missingTickerArs += 1

        const nominalesPerBase = bond.c > 0 ? (validCapitalBase / bond.c) * 100 : null
        const impliedUsdFromPesos = arsQuote && dolarMEP?.value ? arsQuote / dolarMEP.value : null
        const nextCouponBase = nextFlow && nominalesPerBase ? (nextFlow.intAmt * nominalesPerBase) / 100 : null
        const nextAmortBase = nextFlow && nominalesPerBase ? (nextFlow.amortAmt * nominalesPerBase) / 100 : null
        const nextTotalBase = nextFlow && nominalesPerBase ? (nextFlow.totalAmt * nominalesPerBase) / 100 : null
        const daysToCoupon = nextFlow ? daysBetween(today, new Date(`${nextFlow.rawDate}T00:00:00`)) : null
        const daysToMaturity = prospecto?.maturity_date
          ? daysBetween(settlementDate, new Date(`${prospecto.maturity_date}T00:00:00`))
          : null
        const residualValue = metrics?.futureFlows?.reduce((sum, flow) => sum + flow.amortAmt, 0) ?? null

        return {
          symbol: bond.symbol,
          tickerArs,
          name: prospecto?.name || bond.symbol,
          law: prospecto?.law || null,
          couponRate: prospecto?.coupon_rate ?? null,
          frequency: prospecto?.frequency ?? null,
          maturityDate: prospecto?.maturity_date ?? null,
          daysToMaturity,
          nextCouponDate: nextFlow?.date ?? null,
          daysToCoupon,
          priceUsd: bond.c ?? null,
          priceArs: arsQuote,
          impliedUsdFromPesos,
          ytm: metrics?.ytm ?? null,
          paridad: metrics?.paridad ?? null,
          currentYield: metrics?.currentYield ?? null,
          residualValue,
          amortType: prospecto?.amort_type ?? null,
          nominalesPerBase,
          nextCouponBase,
          nextAmortBase,
          nextTotalBase,
          duration: metrics?.duration ?? null,
          volumeNominales: bond.v ?? null,
          operations: bond.q_op ?? null,
          minInvestment: prospecto?.min_investment ?? 1,
          currencyType: prospecto?.currency_type ?? null,
          rating: prospecto?.rating ?? null,
        }
      })

    const rowsWithYtm = rows.filter((row) => row.ytm != null)
    const averageYtm = rowsWithYtm.length
      ? rowsWithYtm.reduce((sum, row) => sum + row.ytm, 0) / rowsWithYtm.length
      : null

    return {
      rows,
      summary: {
        total: rows.length,
        averageYtm,
        lowParityCount: rows.filter((row) => row.paridad != null && row.paridad < 100).length,
        paymentSoonCount: rows.filter((row) => row.daysToCoupon != null && row.daysToCoupon <= 45).length,
        bestYtmRows: topRowsBy(rows, (row) => row.ytm, 'max'),
        lowestParityRows: topRowsBy(rows, (row) => row.paridad, 'min'),
        mostActiveRows: topRowsBy(rows, (row) => row.operations ?? row.volumeNominales, 'max'),
        coverageScore: rows.length
          ? Math.round(((rows.length * 4 - missingProspecto - missingCashflows - missingRating - missingTickerArs) / (rows.length * 4)) * 100)
          : 0,
      },
      coverage: {
        missingProspecto,
        missingCashflows,
        missingTickerArs,
        missingRating,
      },
    }
  }, [bonds, dolarMEP?.value, investmentAmount])

  const filteredRows = useMemo(() => {
    const query = filter.trim().toLowerCase()
    let rows = [...model.rows]

    if (query) {
      rows = rows.filter((row) =>
        row.symbol.toLowerCase().includes(query) ||
        row.tickerArs.toLowerCase().includes(query) ||
        row.name.toLowerCase().includes(query)
      )
    }

    if (focus === 'coupon-soon') {
      rows = rows.filter((row) => row.daysToCoupon != null && row.daysToCoupon <= 90)
    }
    if (focus === 'discount') {
      rows = rows.filter((row) => row.paridad != null && row.paridad < 100)
    }
    if (focus === 'income') {
      rows = rows.filter((row) => row.nextTotalBase != null && row.nextTotalBase > 0)
    }

    rows.sort((a, b) => {
      let va = a[sortKey]
      let vb = b[sortKey]

      if (va == null) va = sortDir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
      if (vb == null) vb = sortDir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY

      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }

      return sortDir === 'asc' ? va - vb : vb - va
    })

    return rows
  }, [filter, focus, model.rows, sortDir, sortKey])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDir(['ytm', 'paridad', 'nextTotalBase', 'operations', 'volumeNominales'].includes(key) ? 'desc' : 'asc')
  }

  if (!model.rows.length) return null

  const investmentBase = Number(investmentAmount) || 1000
  const coverageNotes = [
    model.coverage.missingProspecto ? `${model.coverage.missingProspecto} sin prospecto` : null,
    model.coverage.missingCashflows ? `${model.coverage.missingCashflows} sin cashflows` : null,
    model.coverage.missingTickerArs ? `${model.coverage.missingTickerArs} sin ticker ARS` : null,
    model.coverage.missingRating ? `${model.coverage.missingRating} sin calificacion` : null,
  ].filter(Boolean)

  const stickyTickerStart = NAME_COL_WIDTH
  const stickyTickerArsStart = NAME_COL_WIDTH + USD_TICKER_COL_WIDTH

  return (
    <div className="space-y-4 pb-10">
      <div className="grid gap-4 xl:grid-cols-3">
        <RankingCard
          title="Mejor TIR"
          description="Top instrumentos por TIR efectiva anual."
          rows={model.summary.bestYtmRows}
          renderValue={(row) => formatPctSimple(row.ytm)}
          emptyLabel="No hay TIR disponible para armar el ranking."
        />
        <RankingCard
          title="Menor paridad"
          description="Top instrumentos por menor paridad actual."
          rows={model.summary.lowestParityRows}
          renderValue={(row) => formatPctSimple(row.paridad)}
          emptyLabel="No hay paridades disponibles para armar el ranking."
        />
        <RankingCard
          title="Mas operadas"
          description="Top instrumentos por cantidad de operaciones, con VN como referencia."
          rows={model.summary.mostActiveRows}
          renderValue={(row) => `${formatNumber(row.operations)} ops`}
          emptyLabel="No hay datos de operaciones disponibles."
        />
      </div>

      <section className="rounded-lg border border-terminal-border bg-terminal-panel px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-terminal-text">Claves de lectura</div>
            <div className="text-xs text-terminal-muted">
              <span className="font-medium text-terminal-text">Cada U$S {formatNumber(investmentBase)}</span> muestra cuantos nominales compras hoy y cuanto cobrarias en el proximo cupon, en la proxima amortizacion y en el proximo cobro total.
            </div>
            <div className="text-xs text-terminal-muted">
              <span className="font-medium text-terminal-text">Comprando en $</span> divide la cotizacion en pesos por el dolar MEP y deja visible el precio implicito en dolares para compararlo contra la especie en U$S.
            </div>
            {coverageNotes.length > 0 && (
              <div className="text-xs text-terminal-muted">
                Faltantes detectados: {coverageNotes.join(' | ')}.
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-sm border border-terminal-border bg-terminal-panel px-2 py-1">
              <span className="text-[11px] uppercase tracking-[0.14em] text-terminal-muted">Base U$S</span>
              <Input
                type="number"
                min="1"
                step="100"
                value={investmentAmount}
                onChange={(event) => setInvestmentAmount(event.target.value)}
                className="h-7 w-24 border-0 bg-transparent px-1 text-right font-mono text-sm text-terminal-text shadow-none focus-visible:ring-0"
              />
            </div>
            {FOCUS_OPTIONS.map((option) => (
              <Button
                key={option.id}
                variant={focus === option.id ? 'secondary' : 'outline'}
                size="sm"
                className={cn(
                  'rounded-sm border-terminal-border px-2.5',
                  focus !== option.id && 'bg-terminal-panel text-terminal-muted hover:bg-terminal-surface hover:text-terminal-text'
                )}
                onClick={() => setFocus(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="isolate overflow-hidden rounded-lg border border-terminal-border bg-terminal-panel">
        <div className="border-b border-terminal-border px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-terminal-text">Obligaciones negociables</div>
              <div className="text-xs text-terminal-muted">Vista tipo spreadsheet para monitoreo diario y comparacion rapida.</div>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted" />
              <Input
                value={filter}
                onChange={(event) => onFilterChange?.(event.target.value)}
                placeholder="Buscar ticker o emisora..."
                className="h-8 rounded-sm border-terminal-border bg-terminal-panel pl-9 text-sm text-terminal-text placeholder:text-terminal-muted"
              />
            </div>
          </div>
        </div>

        <Table className="sheet-grid-table min-w-max md:min-w-[2050px] text-[12px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead
                rowSpan={2}
                style={!isMobile ? { left: 0, minWidth: NAME_COL_WIDTH, width: NAME_COL_WIDTH } : undefined}
                className={cn(
                  "border-r border-b border-terminal-border text-center text-[11px] font-medium text-terminal-text",
                  !isMobile && "sheet-sticky-name sticky z-20"
                )}
              >
                ONs
              </TableHead>
              <TableHead
                colSpan={2}
                style={{ left: isMobile ? 0 : stickyTickerStart }}
                className="sheet-sticky-group sticky z-10 border-r border-b border-terminal-border text-center text-[11px] font-medium text-terminal-text"
              >
                Ticker
              </TableHead>
              <TableHead colSpan={2} className="hidden md:table-cell border-r border-b border-terminal-border bg-terminal-surface text-center text-[11px] font-medium text-terminal-text">
                Renta
              </TableHead>
              <TableHead colSpan={isMobile ? 2 : 4} className="border-r border-b border-terminal-border bg-terminal-surface text-center text-[11px] font-medium text-terminal-text">
                Fechas
              </TableHead>
              <TableHead colSpan={isMobile ? 2 : 3} className="border-r border-b border-terminal-border bg-terminal-surface text-center text-[11px] font-medium text-terminal-text">
                Mercado
              </TableHead>
              <TableHead colSpan={isMobile ? 2 : 5} className="border-r border-b border-terminal-border bg-[#ffe3e3] text-center text-[11px] font-medium text-[#7a1f1f] dark:bg-[#391818] dark:text-[#fecaca]">
                Valor
              </TableHead>
              <TableHead colSpan={isMobile ? 1 : 4} className="border-r border-b border-terminal-border bg-[#e6f6df] text-center text-[11px] font-medium text-[#386641] dark:bg-[#17311d] dark:text-[#bbf7d0]">
                U$S {formatNumber(investmentBase)}
              </TableHead>
              <TableHead colSpan={isMobile ? 0 : 5} className="hidden lg:table-cell border-b border-terminal-border bg-terminal-surface text-center text-[11px] font-medium text-terminal-text">
                Riesgo
              </TableHead>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              {[
                ['symbol', 'U$S', ''],
                ['tickerArs', '$', ''],
                ['couponRate', '%', ''],
                ['frequency', 'Freq.', 'hidden md:table-cell'],
                ['maturityDate', 'Venc.', 'hidden lg:table-cell'],
                ['daysToMaturity', 'Venc.', ''],
                ['nextCouponDate', 'Pago', 'hidden lg:table-cell'],
                ['daysToCoupon', 'Pago', ''],
                ['priceUsd', 'Price U$D', ''],
                ['priceArs', 'Price $', 'hidden sm:table-cell'],
                ['impliedUsdFromPesos', 'Imp. U$D', 'hidden xl:table-cell'],
                ['ytm', 'TIR', ''],
                ['paridad', 'Paridad', ''],
                ['currentYield', 'Yield', 'hidden md:table-cell'],
                ['residualValue', 'Resid.', 'hidden md:table-cell'],
                ['amortType', 'Amort.', 'hidden lg:table-cell'],
                ['nominalesPerBase', 'Nom.', 'hidden xl:table-cell'],
                ['nextCouponBase', 'Cp.', 'hidden sm:table-cell'],
                ['nextAmortBase', 'Am.', 'hidden sm:table-cell'],
                ['nextTotalBase', 'Income', ''],
                ['duration', 'Dur.', 'hidden md:table-cell'],
                ['minInvestment', 'Min.', 'hidden lg:table-cell'],
                ['law', 'Ley', 'hidden lg:table-cell'],
                ['currencyType', 'DLR', 'hidden lg:table-cell'],
                ['rating', 'Fix', 'hidden lg:table-cell'],
              ].map(([key, label, hideClass]) => (
                <TableHead
                  key={key}
                  onClick={() => handleSort(key)}
                  style={
                    key === 'symbol'
                      ? { left: isMobile ? 0 : stickyTickerStart, minWidth: USD_TICKER_COL_WIDTH, width: USD_TICKER_COL_WIDTH }
                      : key === 'tickerArs'
                        ? { left: isMobile ? USD_TICKER_COL_WIDTH : stickyTickerArsStart, minWidth: ARS_TICKER_COL_WIDTH, width: ARS_TICKER_COL_WIDTH }
                        : undefined
                  }
                  className={cn(
                    'border-r border-terminal-border bg-terminal-panel px-2 py-1 text-center text-[10px] sm:text-[11px] font-medium text-terminal-text last:border-r-0',
                    key === 'symbol' || key === 'tickerArs' ? 'sheet-sticky-cell sticky z-10' : '',
                    hideClass
                  )}
                >
                  <button className="inline-flex items-center gap-1" type="button">
                    <span>{label}</span>
                    {sortKey === key && <ArrowUpDown size={10} className="text-terminal-accent" />}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length ? (
              filteredRows.map((row) => (
                <BondRow
                  key={row.symbol}
                  row={row}
                  stickyTickerStart={stickyTickerStart}
                  stickyTickerArsStart={stickyTickerArsStart}
                  NAME_COL_WIDTH={NAME_COL_WIDTH}
                  USD_TICKER_COL_WIDTH={USD_TICKER_COL_WIDTH}
                  ARS_TICKER_COL_WIDTH={ARS_TICKER_COL_WIDTH}
                  onSelect={setSelectedBond}
                  isMobile={isMobile}
                />
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={isMobile ? 12 : 26}
                  className="py-8 text-center text-sm text-terminal-muted"
                >
                  No hay resultados para el filtro actual.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <Sheet open={!!selectedBond} onOpenChange={(open) => !open && setSelectedBond(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto border-terminal-border bg-terminal-bg p-0">
          <SheetHeader className="sticky top-0 z-10 border-b border-terminal-border bg-terminal-panel px-6 py-4">
            <SheetTitle className="font-mono text-xl font-bold text-terminal-text">
              {selectedBond?.symbol}
            </SheetTitle>
            <SheetDescription className="text-xs text-terminal-muted">
              {selectedBond?.name}
            </SheetDescription>
          </SheetHeader>
          <div className="p-6">
            {selectedBond && (
              <BondDetailPanel
                bond={{ c: selectedBond.priceUsd }}
                prospecto={bondProspectos[selectedBond.symbol]}
                dolarMEP={dolarMEP}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
