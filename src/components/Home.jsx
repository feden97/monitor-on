import { lazy, memo, Suspense, useMemo, useState, useEffect, useCallback } from 'react'
import { ArrowUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
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

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { compareBondValues } from '../utils/bondModel.js'
import { formatDate, formatNumber, formatPctSimple } from '../utils/formatters'
import { CompactQuality } from './QualityStatus'

const BondDetailPanel = lazy(() => import('./BondDetailPanel'))

const DASH = '-'
const NAME_COL_WIDTH = 320
const USD_TICKER_COL_WIDTH = 80
const ARS_TICKER_COL_WIDTH = 80

const FOCUS_OPTIONS = [
  { id: 'all', label: 'Todo' },
  { id: 'coupon-soon', label: 'Pago cercano' },
  { id: 'discount', label: 'Bajo residual' },
  { id: 'income', label: 'Prox. cobro' },
  { id: 'blocked', label: 'Revisar cronograma' },
]

const MONEY_FORMATTERS = new Map([0, 2].map((digits) => [digits, new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
})]))

function formatMoney(value, digits) {
  if (value == null || Number.isNaN(value)) return DASH
  return `$${MONEY_FORMATTERS.get(digits).format(value)}`
}

function formatUsd(value) {
  return formatMoney(value, 2)
}

function formatArs(value) {
  return formatMoney(value, 0)
}

function pillClass(value, type) {
  if (value == null) return 'cell-pill'
  if (type === 'days') {
    if (value <= 30) return 'cell-pill cell-pill--danger'
    if (value <= 90) return 'cell-pill cell-pill--warn'
    return 'cell-pill'
  }
  if (type === 'maturity') {
    if (value <= 180) return 'cell-pill cell-pill--danger'
    return 'cell-pill'
  }
  if (type === 'coupon-alert') {
    if (value <= 45) return 'cell-pill cell-pill--danger'
    return 'cell-pill'
  }
  if (type === 'paridad') {
    if (value < 85) return 'cell-pill cell-pill--danger'
    if (value < 100) return 'cell-pill cell-pill--warn'
    return 'cell-pill'
  }
  if (type === 'ytm') {
    if (value >= 15) return 'cell-pill cell-pill--danger'
    if (value >= 10) return 'cell-pill cell-pill--warn'
    return 'cell-pill'
  }
  if (type === 'residual') {
    if (value < 100) return 'cell-pill cell-pill--alert'
    return 'cell-pill'
  }
  if (type === 'investment') {
    if (value >= 1000) return 'cell-pill cell-pill--danger'
    return 'cell-pill'
  }
  return 'cell-pill'
}

function topRowsBy(rows, selector, comparator = 'max', limit = 5) {
  return rows
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

function RankingCard({ title, description, rows, renderValue, emptyLabel, emptyAction }) {
  return (
    <Card className="border-terminal-border bg-terminal-panel">
      <CardHeader className="px-4 py-3 pb-2">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-terminal-muted">
          {title}
        </CardTitle>
        <CardDescription className="text-xs text-terminal-muted/70">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-terminal-border border-t border-terminal-border">
          {rows.length ? (
            rows.map((row, index) => (
              <div
                key={`${title}-${row.symbol}`}
                className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 hover:bg-terminal-surface/30"
              >
                <div className="font-mono text-xs tabular-nums text-terminal-muted/50">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm font-semibold text-terminal-text">
                    {row.symbol}
                  </div>
                  <div className="truncate text-xs text-terminal-muted/70">
                    {row.name}
                  </div>
                </div>
                <div className="text-right font-mono text-sm font-semibold tabular-nums text-terminal-text">
                  {renderValue(row)}
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-terminal-muted/60">
              {emptyLabel}
              {emptyAction}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const TD_BASE = 'border-r border-b border-terminal-border px-2 py-1 text-center font-mono'
const TD_HIDDEN_MD = 'hidden md:table-cell ' + TD_BASE
const TD_HIDDEN_SM = 'hidden sm:table-cell ' + TD_BASE
const TD_HIDDEN_LG = 'hidden lg:table-cell ' + TD_BASE
const TD_HIDDEN_XL = 'hidden xl:table-cell ' + TD_BASE

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
    <tr
      className="cursor-pointer hover:bg-terminal-surface/40"
      onClick={() => onSelect(row)}
    >
      <td
        style={!isMobile ? { left: 0, minWidth: NAME_COL_WIDTH, width: NAME_COL_WIDTH } : undefined}
        className={`border-r border-b border-terminal-border px-2 py-1.5 align-middle${!isMobile ? ' sheet-sticky-name sticky z-10' : ''
          }`}
      >
        <div className="truncate font-medium text-terminal-text">{row.name}</div>
        <CompactQuality quality={row.quality} />
      </td>
      <td
        style={{
          left: isMobile ? 0 : stickyTickerStart,
          minWidth: USD_TICKER_COL_WIDTH,
          width: USD_TICKER_COL_WIDTH,
        }}
        className="sheet-sticky-cell sticky border-r border-b border-terminal-border bg-terminal-panel px-2 py-1 text-center font-mono text-terminal-text"
      >
        <button type="button" className="rounded px-1 py-1 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-terminal-accent" onClick={(event) => { event.stopPropagation(); onSelect(row) }} aria-label={`Abrir ficha de ${row.symbol}`}>{row.symbol}</button>
      </td>
      <td
        style={{
          left: isMobile ? USD_TICKER_COL_WIDTH : stickyTickerArsStart,
          minWidth: ARS_TICKER_COL_WIDTH,
          width: ARS_TICKER_COL_WIDTH,
        }}
        className="sheet-sticky-cell sticky border-r border-b border-terminal-border bg-terminal-panel px-2 py-1 text-center font-mono text-terminal-text"
      >
        {row.tickerArs || DASH}
      </td>
      <td className={TD_BASE}>
        {row.couponRate != null ? formatPctSimple(row.couponRate) : DASH}
      </td>
      <td className={TD_HIDDEN_MD}>{row.frequency ?? DASH}</td>
      <td className={TD_HIDDEN_LG}>{formatDate(row.maturityDate)}</td>
      <td className={TD_BASE}>
        <span className={pillClass(row.daysToMaturity, 'maturity')}>{row.daysToMaturity ?? DASH}</span>
      </td>
      <td className={TD_HIDDEN_LG}>{formatDate(row.nextCouponDate)}</td>
      <td className={TD_BASE}>
        <span className={pillClass(row.daysToCoupon, 'coupon-alert')}>{row.daysToCoupon ?? DASH}</span>
      </td>
      <td className={TD_BASE}>{formatUsd(row.priceUsd)}</td>
      <td className={TD_HIDDEN_SM}>{formatArs(row.priceArs)}</td>
      <td className={TD_HIDDEN_XL}>{formatUsd(row.impliedUsdFromPesos)}</td>
      <td className={TD_BASE}>
        <span className={pillClass(row.ytm, 'ytm')} title={row.quality?.calculation?.label}>{row.ytm != null && row.quality?.calculation?.status === 'indicative' ? '≈ ' : ''}{formatPctSimple(row.ytm)}</span>
      </td>
      <td className={TD_BASE}>
        <span className={pillClass(row.paridad, 'paridad')}>{formatPctSimple(row.paridad)}</span>
      </td>
      <td className={TD_HIDDEN_MD}>{formatPctSimple(row.currentYield)}</td>
      <td className={TD_BASE}>
        <span className={pillClass(row.residualValue, 'residual')}>{formatPctSimple(row.residualValue)}</span>
      </td>
      <td className={TD_HIDDEN_LG}>{row.amortType || DASH}</td>
      <td className={TD_HIDDEN_XL}>{formatNumber(row.nominalesPerBase)}</td>
      <td className={TD_BASE}>{formatUsd(row.nextCouponBase)}</td>
      <td className={TD_HIDDEN_SM}>{formatUsd(row.nextAmortBase)}</td>
      <td className={TD_BASE}>
        {formatUsd(row.nextTotalBase)}
      </td>
      <td className={TD_HIDDEN_MD}>{row.duration != null ? row.duration.toFixed(2) : DASH}</td>
      <td className={TD_BASE}>
        <span className={pillClass(row.minInvestment, 'investment')}>{formatNumber(row.minInvestment)}</span>
      </td>
      <td className={TD_HIDDEN_LG}>{row.law || DASH}</td>
      <td className={TD_HIDDEN_LG}>{row.currencyType || DASH}</td>
      <td className="hidden lg:table-cell border-b border-terminal-border px-2 py-1 text-center font-mono">
        {row.rating || DASH}
      </td>
    </tr>
  )
})

BondRow.displayName = 'BondRow'

export default function Home({ marketModel, dolarMEP, filter = '', searchValue = filter, onFilterChange }) {
  const [selectedTicker, setSelectedTicker] = useState(null)
  const selectBond = useCallback((row) => setSelectedTicker(row.symbol), [])
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
  const investmentBase = Number(investmentAmount) > 0 && Number.isFinite(Number(investmentAmount))
    ? Number(investmentAmount) : 1000

  const rows = useMemo(() => marketModel.rows.map((row) => {
    const nextFlow = row.metrics?.futureFlows?.[0]
    const nominalesPerBase = row.priceUsd > 0 ? (investmentBase / row.priceUsd) * 100 : null
    return {
      ...row,
      nominalesPerBase,
      impliedUsdFromPesos: row.priceArs && dolarMEP?.value ? row.priceArs / dolarMEP.value : null,
      nextCouponBase: nextFlow && nominalesPerBase ? (nextFlow.intAmt * nominalesPerBase) / 100 : null,
      nextAmortBase: nextFlow && nominalesPerBase ? (nextFlow.amortAmt * nominalesPerBase) / 100 : null,
      nextTotalBase: nextFlow && nominalesPerBase ? (nextFlow.totalAmt * nominalesPerBase) / 100 : null,
    }
  }), [marketModel.rows, dolarMEP?.value, investmentBase])

  const rankings = useMemo(() => ({
    bestYtmRows: topRowsBy(marketModel.rows.filter((row) => row.quality?.rankingEligible), (row) => row.ytm, 'max'),
    lowestParityRows: topRowsBy(marketModel.rows.filter((row) => row.quality?.rankingEligible), (row) => row.paridad, 'min'),
    mostActiveRows: topRowsBy(marketModel.rows, (row) => row.operations ?? row.volumeNominales, 'max'),
  }), [marketModel.rows])

  const selectedBond = marketModel.rows.find((row) => row.symbol === selectedTicker)

  const filteredRows = useMemo(() => {
    const query = filter.trim().toLowerCase()
    let filtered = rows

    if (query) {
      filtered = filtered.filter((row) =>
        row.symbol.toLowerCase().includes(query) ||
        row.tickerArs.toLowerCase().includes(query) ||
        row.name.toLowerCase().includes(query)
      )
    }

    if (focus === 'coupon-soon') {
      filtered = filtered.filter((row) => row.daysToCoupon != null && row.daysToCoupon <= 90)
    }
    if (focus === 'discount') {
      filtered = filtered.filter((row) => row.paridad != null && row.paridad < 100)
    }
    if (focus === 'income') {
      filtered = filtered.filter((row) => row.nextTotalBase != null && row.nextTotalBase > 0)
    }
    if (focus === 'blocked') {
      filtered = filtered.filter((row) => !row.quality?.canCalculate && row.quality?.schedule?.status !== 'matured')
    }

    return [...filtered].sort((a, b) => compareBondValues(a[sortKey], b[sortKey], sortDir))

  }, [filter, focus, rows, sortDir, sortKey])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDir(['ytm', 'paridad', 'nextTotalBase', 'operations', 'volumeNominales'].includes(key) ? 'desc' : 'asc')
  }

  if (!rows.length) return null

  const coverageNotes = [
    marketModel.coverage.missingProspecto ? `${marketModel.coverage.missingProspecto} sin prospecto` : null,
    marketModel.coverage.missingCashflows ? `${marketModel.coverage.missingCashflows} sin cashflows` : null,
    marketModel.coverage.missingTickerArs ? `${marketModel.coverage.missingTickerArs} sin ticker ARS` : null,
    marketModel.coverage.missingRating ? `${marketModel.coverage.missingRating} sin calificacion` : null,
  ].filter(Boolean)

  const stickyTickerStart = NAME_COL_WIDTH
  const stickyTickerArsStart = NAME_COL_WIDTH + USD_TICKER_COL_WIDTH

  return (
    <div className="space-y-4 pb-10">
      <div className="grid gap-4 xl:grid-cols-3">
        <RankingCard
          title="TIR comparable"
          description="Mayor TEA entre cálculos con datos validados."
          rows={rankings.bestYtmRows}
          renderValue={(row) => formatPctSimple(row.ytm)}
          emptyLabel="Todavía no hay instrumentos con contrato, precio y calendario validados para este ranking."
          emptyAction={marketModel.rows.some((row) => row.symbol === 'YM34D') ? <button type="button" onClick={() => setSelectedTicker('YM34D')} className="mt-3 block text-xs text-terminal-accent underline underline-offset-4">Abrir el caso documentado YM34D</button> : null}
        />
        <RankingCard
          title="Paridad comparable"
          description="Menor paridad entre cálculos con datos validados."
          rows={rankings.lowestParityRows}
          renderValue={(row) => formatPctSimple(row.paridad)}
          emptyLabel="Las estimaciones con supuestos pendientes quedan fuera del ranking. Podés consultarlas en la tabla."
        />
        <RankingCard
          title="Más operadas · dato recibido"
          description="Cantidad de operaciones informada por la fuente."
          rows={rankings.mostActiveRows}
          renderValue={(row) => `${formatNumber(row.operations)} ops`}
          emptyLabel="No hay datos de operaciones disponibles."
        />
      </div>

      <section className="rounded-lg border border-terminal-border bg-terminal-panel px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-terminal-text">Claves de lectura</div>
            <div className="text-xs text-terminal-muted/80">
              <span className="font-medium text-terminal-text">Cada U$S {formatNumber(investmentBase)}</span> estima nominales y cobros con el precio observado asumido por 100 VN originales, sin gastos. Los pagos requieren un cronograma utilizable.
            </div>
            <div className="text-xs text-terminal-muted/80">
              <span className="font-medium text-terminal-text">Comprando en $</span> divide la cotizacion en pesos por el dolar MEP y deja visible el precio implicito en dolares para compararlo contra la especie en U$S.
            </div>
            <div className="text-xs text-terminal-muted/80"><span className="font-medium text-terminal-text">≈ TIR indicativa</span> usa supuestos pendientes de validar. Abrí la ficha para ver el estado del contrato, la cotización, el calendario y las entradas del cálculo.</div>
            {coverageNotes.length > 0 && (
              <div className="text-xs text-terminal-muted/60">
                Faltantes detectados: {coverageNotes.join(' · ')}.
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-terminal-surface/50 px-2.5 py-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-terminal-muted">Base U$S</span>
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
                  'rounded-lg border-terminal-border px-2.5',
                  focus !== option.id && 'bg-terminal-surface/30 text-terminal-muted hover:bg-terminal-surface/60 hover:text-terminal-text border-0'
                )}
                onClick={() => setFocus(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="isolate rounded-lg border border-terminal-border bg-terminal-panel">
        <div className="border-b border-terminal-border px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-terminal-text">Obligaciones negociables</div>
              <div className="text-xs text-terminal-muted/70">Vista tipo spreadsheet para monitoreo diario y comparacion rapida.</div>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted/60" />
              <Input
                value={searchValue}
                onChange={(event) => onFilterChange?.(event.target.value)}
                placeholder="Buscar ticker o emisora..."
                className="h-8 rounded-lg border-terminal-border bg-terminal-surface/40 pl-9 text-sm text-terminal-text placeholder:text-terminal-muted/50"
              />
            </div>
          </div>
        </div>

        <Table className="sheet-grid-table min-w-max md:min-w-[2050px] text-[12px]">
          <TableHeader className="bg-terminal-panel z-20">
            <TableRow className="hover:bg-transparent">
              <TableHead
                rowSpan={2}
                style={!isMobile ? { left: 0, minWidth: NAME_COL_WIDTH, width: NAME_COL_WIDTH } : undefined}
                className={cn(
                  "border-r border-b border-terminal-border text-center text-[11px] font-medium text-terminal-text bg-terminal-panel",
                  !isMobile && "sheet-sticky-name sticky top-0 z-52"
                )}
              >
                Obligaciones Negociables
              </TableHead>
              <TableHead
                colSpan={2}
                style={{ left: isMobile ? 0 : stickyTickerStart }}
                className="sheet-sticky-group sticky top-0 z-52 border-r border-b border-terminal-border bg-terminal-panel text-center text-[11px] font-medium text-terminal-text"
              >
                Ticker
              </TableHead>
              <TableHead colSpan={2} className="hidden md:table-cell border-r border-b border-terminal-border bg-terminal-panel text-center text-[11px] font-medium text-terminal-muted sticky top-0 z-50">
                Renta
              </TableHead>
              <TableHead colSpan={isMobile ? 2 : 4} className="border-r border-b border-terminal-border bg-terminal-panel text-center text-[11px] font-medium text-terminal-muted sticky top-0 z-50">
                Fechas
              </TableHead>
              <TableHead colSpan={isMobile ? 2 : 3} className="border-r border-b border-terminal-border bg-terminal-panel text-center text-[11px] font-medium text-terminal-muted sticky top-0 z-50">
                Mercado
              </TableHead>
              <TableHead colSpan={isMobile ? 2 : 5} className="border-r border-b border-terminal-border bg-terminal-panel text-center text-[11px] font-medium text-terminal-muted sticky top-0 z-50">
                Rendimiento
              </TableHead>
              <TableHead colSpan={isMobile ? 1 : 4} className="border-r border-b border-terminal-border bg-terminal-panel text-center text-[11px] font-medium text-terminal-muted sticky top-0 z-50">
                Cada U$S {formatNumber(investmentBase)}
              </TableHead>
              <TableHead colSpan={isMobile ? 0 : 5} className="hidden lg:table-cell border-b border-terminal-border bg-terminal-panel text-center text-[11px] font-medium text-terminal-muted sticky top-0 z-50">
                Riesgo / Ley
              </TableHead>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              {[
                ['symbol', 'U$S', ''],
                ['tickerArs', '$', ''],
                ['couponRate', 'Cupón %', ''],
                ['frequency', 'Pagos/Año', 'hidden md:table-cell'],
                ['maturityDate', 'Venc.', 'hidden lg:table-cell'],
                ['daysToMaturity', 'Días Venc.', ''],
                ['nextCouponDate', 'Pago estim.', 'hidden lg:table-cell'],
                ['daysToCoupon', 'Días estim.', ''],
                ['priceUsd', 'Precio U$S', ''],
                ['priceArs', 'Precio $', 'hidden sm:table-cell'],
                ['impliedUsdFromPesos', 'MEP Impl.', 'hidden xl:table-cell'],
                ['ytm', 'TIR TEA', ''],
                ['paridad', 'Paridad', ''],
                ['currentYield', 'Yield', 'hidden md:table-cell'],
                ['residualValue', 'Valor Res.', ''],
                ['amortType', 'Tipo Amort.', 'hidden lg:table-cell'],
                ['nominalesPerBase', 'VN Compras', 'hidden xl:table-cell'],
                ['nextCouponBase', 'Cupón U$S', ''],
                ['nextAmortBase', 'Amort. U$S', 'hidden sm:table-cell'],
                ['nextTotalBase', 'Cobro Prox.', ''],
                ['duration', 'Duración', 'hidden md:table-cell'],
                ['minInvestment', 'Lám. Mín.', ''],
                ['law', 'Ley', 'hidden lg:table-cell'],
                ['currencyType', 'Dólar', 'hidden lg:table-cell'],
                ['rating', 'Calif.', 'hidden lg:table-cell'],
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
                    'border-r border-terminal-border bg-terminal-panel px-2 py-1 text-center text-[10px] sm:text-[11px] font-medium text-terminal-muted last:border-r-0 sticky top-[39px]',
                    key === 'symbol' || key === 'tickerArs' ? 'sheet-sticky-cell' : '',
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
          <tbody className="table-body-perf">
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
                  onSelect={selectBond}
                  isMobile={isMobile}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={isMobile ? 12 : 26}
                  className="py-8 text-center text-sm text-terminal-muted"
                >
                  No hay resultados para el filtro actual.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </section>

      <Sheet open={!!selectedBond} onOpenChange={(open) => !open && setSelectedTicker(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto border-terminal-border bg-terminal-panel p-0">
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
              <Suspense fallback={<div className="py-8 text-center text-sm text-terminal-muted">Cargando detalle...</div>}>
                <BondDetailPanel
                  bond={selectedBond.quote}
                  prospecto={selectedBond.prospecto}
                  metrics={selectedBond.metrics}
                  dolarMEP={dolarMEP}
                  quality={selectedBond.quality}
                  calculationSnapshot={selectedBond.calculationSnapshot}
                  contract={selectedBond.contract}
                />
              </Suspense>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
