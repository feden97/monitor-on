import { useEffect, useMemo, useState } from 'react'
import { Activity, LineChart, Moon, RefreshCw, Sun } from 'lucide-react'
import Home from './components/Home'
import ErrorBanner from './components/ErrorBanner'
import AnalysisTab from './components/AnalysisTab'
import { useBondsData } from './hooks/useBondsData'
import { useDolarMEP } from './hooks/useDolarMEP'
import { useRiesgoPais } from './hooks/useRiesgoPais'

function formatTimestamp(date) {
  if (!date) return null

  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const TABS = [
  { id: 'home', label: 'Inicio', icon: Activity },
  { id: 'analysis', label: 'Analisis', icon: LineChart },
]

export default function App() {
  const { data, loading, error, lastUpdated, refresh } = useBondsData()
  const { mep, refresh: refreshMep } = useDolarMEP()
  const { riesgoPais, refresh: refreshRiesgoPais } = useRiesgoPais()
  const [activeTab, setActiveTab] = useState('home')
  const [isRefreshing, setIsRefreshing] = useState(false)
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
    const html = document.documentElement
    html.classList.toggle('dark', isDark)

    try {
      localStorage.setItem('ons-theme-v2', isDark ? 'dark' : 'light')
    } catch {
      // Ignore storage issues and keep the in-memory preference.
    }
  }, [isDark])

  const marketSummary = useMemo(() => {
    if (!data.length) {
      return null
    }

    const usdCount = data.filter((bond) => bond.symbol?.endsWith('D')).length
    const arsCount = data.filter((bond) => bond.symbol?.endsWith('O')).length

    return { usdCount, arsCount }
  }, [data])

  const hasData = data.length > 0

  async function handleRefresh() {
    setIsRefreshing(true)
    const start = Date.now()

    try {
      await Promise.allSettled([refresh(), refreshMep(), refreshRiesgoPais()])
      const elapsed = Date.now() - start

      if (elapsed < 600) {
        await new Promise((resolve) => setTimeout(resolve, 600 - elapsed))
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text">
      <header className="sticky top-0 z-20 border-b border-terminal-border bg-terminal-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="live-dot block h-2.5 w-2.5 rounded-full bg-up" />
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold tracking-tight text-terminal-text">
                    ONs Terminal
                  </span>
                  <span className="rounded-full border border-terminal-border bg-terminal-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-terminal-muted">
                    Argentina
                  </span>
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-terminal-muted">
                Monitor de obligaciones negociables con foco en oportunidades, metricas de rendimiento y lectura rapida del mercado.
              </p>
            </div>

            <button
              onClick={() => setIsDark((prev) => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-terminal-border bg-terminal-panel text-terminal-muted transition hover:bg-terminal-surface hover:text-terminal-text"
              title={isDark ? 'Modo claro' : 'Modo oscuro'}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-terminal-border bg-terminal-surface/60 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-terminal-muted">Ultima carga</div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-terminal-text">
                  {formatTimestamp(lastUpdated) || 'Sin datos'}
                </div>
              </div>
              <div className="rounded-xl border border-terminal-border bg-terminal-surface/60 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-terminal-muted">Bonos USD</div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-terminal-text">
                  {marketSummary?.usdCount ?? '—'}
                </div>
              </div>
              <div className="rounded-xl border border-terminal-border bg-terminal-surface/60 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-terminal-muted">Bonos ARS</div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-terminal-text">
                  {marketSummary?.arsCount ?? '—'}
                </div>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
              className="flex items-center justify-center gap-2 rounded-md border border-terminal-border bg-terminal-panel px-4 py-2 text-xs font-semibold text-terminal-text transition hover:bg-terminal-surface disabled:cursor-not-allowed disabled:opacity-50"
              title="Actualizar datos"
            >
              <RefreshCw size={14} className={loading || isRefreshing ? 'animate-spin text-terminal-muted' : 'text-terminal-muted'} />
              Actualizar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-6 py-6">
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-terminal-border pb-2">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-t-md border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'border-terminal-accent text-terminal-accent'
                    : 'border-transparent text-terminal-muted hover:border-terminal-border hover:text-terminal-text'
                }`}
                aria-pressed={isActive}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {error && !hasData && <ErrorBanner message={error} onRetry={handleRefresh} />}
        {error && hasData && (
          <div className="mb-4 rounded-lg border border-terminal-border bg-terminal-surface/60 px-4 py-2 text-xs text-terminal-muted">
            Se mantuvieron los últimos datos válidos mientras se reintenta la actualización.
          </div>
        )}

        {activeTab === 'home' && (
          <section className="space-y-6">
            <div className="flex flex-col gap-2">
              <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-terminal-text">
                <Activity size={18} className="text-terminal-accent" />
                Dashboard de mercado
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-terminal-muted">
                Lectura ejecutiva del universo de ONs para detectar rendimiento, movimiento diario y proximidad de pagos.
              </p>
            </div>

            {hasData && (
              <Home bonds={data} dolarMEP={mep} riesgoPais={riesgoPais} />
            )}
          </section>
        )}

        {activeTab === 'analysis' && (
          <section className="space-y-6">
            <div className="flex flex-col gap-2">
              <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-terminal-text">
                <LineChart size={18} className="text-terminal-accent" />
                Analisis de ONs
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-terminal-muted">
                Vista detallada por instrumento con datos de emision, metricas financieras y flujo futuro de fondos.
              </p>
            </div>

            <AnalysisTab
              bonds={data}
              loading={loading}
              error={error}
              dolarMEP={mep}
              lastUpdated={lastUpdated}
            />
          </section>
        )}

        <footer className="mt-10 border-t border-terminal-border/60 pt-4 text-center text-xs text-terminal-muted">
          Market Data: data912.com · Referencias macro: CriptoYa y ArgentinaDatos · Uso informativo
        </footer>
      </main>
    </div>
  )
}
