import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Search, Activity, Sun, Moon, BarChart3, LineChart } from 'lucide-react'
import { useBondsData } from './hooks/useBondsData'
import BondsTable from './components/BondsTable'
import StatsBar from './components/StatsBar'
import ErrorBanner from './components/ErrorBanner'
import AnalysisTab from './components/AnalysisTab'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(date) {
  if (!date) return null
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// ── Tab definitions ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'market', label: 'Mercado', icon: Activity },
  { id: 'analysis', label: 'Análisis', icon: LineChart },
]

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { data, loading, error, lastUpdated, refresh } = useBondsData()
  const [globalFilter, setGlobalFilter] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('market')

  // Dark mode: read from localStorage, default to TRUE (dark) for that Pro-Terminal look
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem('ons-theme-v2')
      if (stored !== null) return stored === 'dark'
      // Default to true
      return true
    } catch {
      return true
    }
  })

  // Apply the dark class on <html> whenever isDark changes
  useEffect(() => {
    const html = document.documentElement
    if (isDark) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
    try {
      localStorage.setItem('ons-theme-v2', isDark ? 'dark' : 'light')
    } catch {}
  }, [isDark])

  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev)
  }, [])

  async function handleRefresh() {
    setIsRefreshing(true)
    refresh()
    // Give the spinner at least 600ms so it's visible
    setTimeout(() => setIsRefreshing(false), 600)
  }

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text">
      {/* ── Top bar ── */}
      <header className="border-b border-terminal-border bg-terminal-panel shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              {/* Live dot */}
              <span className="live-dot block w-2 h-2 rounded-full bg-up flex-shrink-0" />
              <span className="font-mono font-bold text-sm tracking-tight text-terminal-text">
                ONs <span className="text-terminal-accent font-medium ml-1">Terminal</span>
              </span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-terminal-border" />
            <span className="hidden sm:inline text-terminal-muted text-xs font-sans font-medium tracking-wide">
              Mercado Argentino
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Timestamp */}
            {lastUpdated && (
              <span className="hidden sm:inline font-mono text-[11px] font-medium tracking-wider text-terminal-muted bg-terminal-surface px-2 py-1 rounded-full border border-terminal-border">
                {formatTimestamp(lastUpdated)}
              </span>
            )}

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-terminal-border
                         text-xs font-semibold text-terminal-text bg-terminal-panel
                         hover:bg-terminal-surface active:scale-95
                         disabled:opacity-50 disabled:cursor-not-allowed"
              title="Actualizar datos"
            >
              <RefreshCw
                size={13}
                className={isRefreshing || loading ? 'animate-spin text-terminal-muted' : 'text-terminal-muted'}
              />
              <span className="hidden sm:inline">Act</span>
            </button>

            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-8 h-8 rounded-md border border-terminal-border
                         text-terminal-muted bg-terminal-panel hover:text-terminal-text hover:bg-terminal-surface
                         active:scale-95"
              title={isDark ? 'Modo claro' : 'Modo oscuro'}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {/* ── Tab Navigation ── */}
        <div className="flex items-center gap-1 mb-6 border-b border-terminal-border">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold font-sans
                           border-b-2 -mb-px transition-colors
                           ${isActive
                             ? 'border-terminal-accent text-terminal-accent'
                             : 'border-transparent text-terminal-muted hover:text-terminal-text hover:border-terminal-border'
                           }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Market Tab ── */}
        {activeTab === 'market' && (
          <>
            {/* Page title */}
            <div className="mb-6 flex justify-between items-end">
              <div>
                <h1 className="font-sans font-bold text-lg text-terminal-text tracking-tight flex items-center gap-2">
                  <Activity size={18} className="text-terminal-accent" />
                  Estado del Mercado
                </h1>
                <p className="text-xs text-terminal-muted mt-1 max-w-lg leading-relaxed">
                  Datos en tiempo real de Obligaciones Negociables. Precios en ARS. Actualización automática configurada cada 10s.
                </p>
              </div>
            </div>

            {/* Error banner */}
            {error && <ErrorBanner message={error} onRetry={handleRefresh} />}

            {/* Stats summary */}
            {!loading && !error && data.length > 0 && <StatsBar data={data} />}

            {/* Search bar */}
            <div className="relative mb-5 max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted pointer-events-none"
              />
              <input
                type="text"
                placeholder="Buscar por ticker o empresa…"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm font-mono
                           bg-terminal-panel border border-terminal-border rounded-md text-terminal-text
                           placeholder:text-terminal-muted/60
                           focus:outline-none focus:ring-1 focus:ring-terminal-accent/50 focus:border-terminal-accent/50"
              />
            </div>

            {/* Data table */}
            <BondsTable
              data={data}
              loading={loading}
              globalFilter={globalFilter}
              setGlobalFilter={setGlobalFilter}
            />
          </>
        )}

        {/* ── Analysis Tab ── */}
        {activeTab === 'analysis' && (
          <>
            <div className="mb-6">
              <h1 className="font-sans font-bold text-lg text-terminal-text tracking-tight flex items-center gap-2">
                <LineChart size={18} className="text-terminal-accent" />
                Análisis de ONs
              </h1>
              <p className="text-xs text-terminal-muted mt-1 max-w-lg leading-relaxed">
                Análisis fundamental de Obligaciones Negociables en dólares. Click en un instrumento para ver datos de emisión, métricas y flujo de fondos.
              </p>
            </div>
            <AnalysisTab />
          </>
        )}

        {/* Footer note */}
        <div className="mt-8 pt-4 border-t border-terminal-border/50 text-center">
          <p className="text-xs text-terminal-muted font-sans flex items-center justify-center gap-2">
            <span>Market Data: data912.com</span>
            <span className="w-1 h-1 rounded-full bg-terminal-border"></span>
            <span>Intención Off-chain / Informativo</span>
          </p>
        </div>
      </main>
    </div>
  )
}
