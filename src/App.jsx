import { useEffect, useMemo, useState } from 'react'
import { Activity, Bell, LineChart, Menu, Moon, RefreshCw, Search, Sun, X } from 'lucide-react'
import Home from './components/Home'
import ErrorBanner from './components/ErrorBanner'
import AnalysisTab from './components/AnalysisTab'
import { useBondsData } from './hooks/useBondsData'
import { useDolarMEP } from './hooks/useDolarMEP'
import { useRiesgoPais } from './hooks/useRiesgoPais'
import { analyzeBond, getNextBusinessDay } from './utils/bondEngine'
import { formatTime } from './utils/formatters'
import bondProspectos from './data/bondProspectos.json'

function applyThemeWithoutMotion(isDark) {
  const style = document.createElement('style')
  style.appendChild(document.createTextNode('*{transition:none !important;animation:none !important;}'))
  document.head.appendChild(style)
  document.documentElement.classList.toggle('dark', isDark)
  document.body.offsetHeight
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      style.remove()
    })
  })
}

const TABS = [
  { id: 'home', label: 'Inicio', icon: Activity },
  { id: 'analysis', label: 'Analisis', icon: LineChart },
]

function SidebarNav({ activeTab, onTabClick, coverageSummary, isDark, onThemeToggle }) {
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-terminal-border px-4 py-4">
        <span className="live-dot h-2 w-2 flex-shrink-0 rounded-full bg-up" />
        <span className="text-sm font-semibold tracking-tight text-terminal-text">
          ONs Terminal
        </span>
        <span className="ml-auto rounded border border-terminal-border bg-terminal-surface/50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-terminal-muted">
          AR
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        <p className="px-3 pb-1.5 pt-3 text-[10px] font-medium uppercase tracking-wider text-terminal-muted/60">
          Principal
        </p>
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabClick(tab.id)}
              className={`nav-item flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium ${isActive ? 'nav-item--active' : ''
                }`}
            >
              <Icon
                size={15}
                className={isActive ? 'text-terminal-accent' : 'text-terminal-muted'}
              />
              {tab.label}
            </button>
          )
        })}

        <p className="px-3 pb-1.5 pt-5 text-[10px] font-medium uppercase tracking-wider text-terminal-muted/60">
          Herramientas
        </p>
        <div className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-terminal-muted/40">
          <Bell size={15} />
          Alertas
          <span className="ml-auto rounded-full bg-terminal-surface px-1.5 py-0.5 font-mono text-[9px] font-medium text-terminal-muted/50">
            0
          </span>
        </div>
      </nav>

      <div className="space-y-0.5 border-t border-terminal-border p-2">
        {coverageSummary && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-up" />
            <span className="font-mono text-[10px] text-terminal-muted">
              {coverageSummary.availableChecks}/{coverageSummary.totalChecks} chequeados
            </span>
          </div>
        )}
        <button
          onClick={onThemeToggle}
          className="nav-item flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px]"
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
          {isDark ? 'Modo claro' : 'Modo oscuro'}
        </button>
      </div>
    </>
  )
}

export default function App() {
  const { data, loading, error, lastUpdated, refresh } = useBondsData()
  const { mep, refresh: refreshMep } = useDolarMEP()
  const { riesgoPais, refresh: refreshRiesgoPais } = useRiesgoPais()
  const [activeTab, setActiveTab] = useState('home')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 200) // 200ms debounce

    return () => clearTimeout(timer)
  }, [searchQuery])

  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem('ons-theme-v2')
      return stored ? stored === 'dark' : true
    } catch {
      return true
    }
  })

  useEffect(() => {
    document.title = activeTab === 'analysis'
      ? 'ONs Terminal | Analisis'
      : 'ONs Terminal | Dashboard'
  }, [activeTab])

  useEffect(() => {
    applyThemeWithoutMotion(isDark)
    try {
      localStorage.setItem('ons-theme-v2', isDark ? 'dark' : 'light')
    } catch {
      // Ignore storage errors.
    }
  }, [isDark])

  const hasData = data.length > 0

  const coverageSummary = useMemo(() => {
    const dBonds = data.filter((row) => row.symbol?.endsWith('D'))
    if (!dBonds.length) return null

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const settlementDate = getNextBusinessDay(tomorrow.toISOString().split('T')[0])
    const arsQuotes = new Map(
      data
        .filter((row) => row.symbol?.endsWith('O'))
        .map((row) => [row.symbol, row])
    )

    let missingProspecto = 0
    let missingCashflows = 0
    let missingRating = 0
    let missingTickerArs = 0

    dBonds.forEach((bond) => {
      const prospecto = bondProspectos[bond.symbol]
      if (!prospecto) missingProspecto += 1

      const tickerArs = prospecto?.ticker_o || `${bond.symbol.slice(0, -1)}O`
      const arsQuote = arsQuotes.get(tickerArs)?.c ?? null
      const metrics =
        bond.c > 0 && prospecto ? analyzeBond(bond.c, prospecto, settlementDate) : null

      if (prospecto && !metrics) missingCashflows += 1
      if (!prospecto?.rating) missingRating += 1
      if (!arsQuote) missingTickerArs += 1
    })

    const totalChecks = dBonds.length * 4
    const missingChecks = missingProspecto + missingCashflows + missingRating + missingTickerArs
    const score = totalChecks
      ? Math.round(((totalChecks - missingChecks) / totalChecks) * 100)
      : 0

    return {
      score,
      totalRows: dBonds.length,
      totalChecks,
      availableChecks: totalChecks - missingChecks,
      missingProspecto,
      missingCashflows,
      missingRating,
      missingTickerArs,
    }
  }, [data])

  async function handleRefresh() {
    setIsRefreshing(true)
    try {
      await Promise.allSettled([refresh(), refreshMep(), refreshRiesgoPais()])
    } finally {
      setIsRefreshing(false)
    }
  }

  function handleNavClick(tabId) {
    setActiveTab(tabId)
    setMobileSidebarOpen(false)
  }

  const sidebarProps = {
    activeTab,
    onTabClick: handleNavClick,
    coverageSummary,
    isDark,
    onThemeToggle: () => setIsDark((prev) => !prev),
  }

  return (
    <div className="flex h-screen overflow-hidden bg-terminal-bg text-terminal-text">
      <aside className="hidden w-[200px] flex-shrink-0 flex-col border-r border-terminal-border bg-terminal-panel lg:flex">
        <SidebarNav {...sidebarProps} />
      </aside>

      {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="fixed bottom-0 left-0 top-0 z-50 flex w-[220px] flex-shrink-0 flex-col border-r border-terminal-border bg-terminal-panel lg:hidden">
            <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
              <span className="font-mono text-sm font-bold text-terminal-text">ONs Terminal</span>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-md p-1 text-terminal-muted hover:text-terminal-text"
                aria-label="Cerrar menu"
              >
                <X size={16} />
              </button>
            </div>
            <SidebarNav {...sidebarProps} />
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-terminal-border bg-terminal-panel px-4 py-2">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-terminal-muted hover:bg-terminal-surface/60 hover:text-terminal-text lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu size={16} />
          </button>

          <div className="flex max-w-[140px] sm:max-w-[240px] flex-1 items-center gap-2 rounded-lg bg-terminal-surface/50 px-3 py-1.5 text-terminal-muted">
            <Search size={13} className="flex-shrink-0 text-terminal-muted/70" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar..."
              className="min-w-0 flex-1 bg-transparent text-xs text-terminal-text placeholder:text-terminal-muted/60 focus:outline-none"
              aria-label="Buscar ticker o emisora"
            />
          </div>

          <div className="ml-auto hidden items-center gap-0 xl:flex">
            <div className="metric-chip border-l border-terminal-border/50 pl-4 pr-4">
              <span className="metric-chip__label">MEP</span>
              <span className="metric-chip__value">
                {mep?.value
                  ? `$${mep.value.toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                  : '--'}
              </span>
            </div>
            <div className="metric-chip border-l border-terminal-border/50 pl-4 pr-4">
              <span className="metric-chip__label">Riesgo País</span>
              <span className="metric-chip__value text-down">
                {riesgoPais?.value ? `${riesgoPais.value} bps` : '--'}
              </span>
            </div>
            <div className="metric-chip border-l border-terminal-border/50 pl-4 pr-4">
              <span className="metric-chip__label">Cobertura</span>
              <span className="metric-chip__value text-up">
                {coverageSummary ? `${coverageSummary.score}%` : '--'}
              </span>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-terminal-surface/40 px-3 py-1.5 text-xs font-medium text-terminal-muted hover:bg-terminal-surface hover:text-terminal-text disabled:cursor-not-allowed disabled:opacity-50 xl:ml-3"
            title="Actualizar datos"
          >
            <RefreshCw
              size={12}
              className={isRefreshing ? 'animate-spin text-terminal-muted' : 'text-terminal-muted/70'}
            />
            <span className="hidden font-mono sm:inline">
              {isRefreshing
                ? 'Actualizando...'
                : lastUpdated
                  ? formatTime(lastUpdated)
                  : 'Actualizar'}
            </span>
          </button>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-screen-xl px-2 sm:px-5 py-3 sm:py-5">
            {error && !hasData && <ErrorBanner message={error} onRetry={handleRefresh} />}
            {error && hasData && (
              <div className="mb-4 rounded-lg border border-terminal-border bg-terminal-surface/60 px-4 py-2 text-xs text-terminal-muted">
                Se mantuvieron los ultimos datos validos mientras se reintenta la actualizacion.
              </div>
            )}

            {activeTab === 'home' && !hasData && !error && (
              <div className="flex items-center justify-center py-24 text-sm text-terminal-muted">
                Cargando datos del mercado...
              </div>
            )}

            {activeTab === 'home' && hasData && (
              <Home
                bonds={data}
                dolarMEP={mep}
                filter={debouncedSearchQuery}
                onFilterChange={setSearchQuery}
              />
            )}

            {activeTab === 'analysis' && (
              <AnalysisTab
                bonds={data}
                loading={loading}
                error={error}
                dolarMEP={mep}
                lastUpdated={lastUpdated}
                filter={debouncedSearchQuery}
                onFilterChange={setSearchQuery}
              />
            )}
          </div>
        </main>

        <footer className="border-t border-terminal-border px-5 py-1.5 text-center text-[10px] text-terminal-muted/40 tracking-wide">
          Market Data: data912.com · MEP: CriptoYa · Riesgo País: ArgentinaDatos · Uso informativo
        </footer>
      </div>
    </div>
  )
}
