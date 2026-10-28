const DIMENSIONS = [
  ['contract', 'Contrato'],
  ['schedule', 'Cronograma'],
  ['market', 'Cotización'],
  ['calendar', 'Calendario'],
  ['calculation', 'Cálculo'],
]

function statusClass(status) {
  if (['contradictory', 'blocked', 'invalid'].includes(status)) return 'border-down/30 bg-down/10 text-down'
  if (['complete', 'current', 'covered', 'valid'].includes(status)) return 'border-up/25 bg-up/10 text-up'
  if (status === 'reviewed-original') return 'border-terminal-accent/30 bg-terminal-accent/10 text-terminal-accent'
  return 'border-terminal-border bg-terminal-surface/50 text-terminal-muted'
}

export function QualityBadge({ dimension, state, compact = false }) {
  const label = state?.label || 'Sin evaluar'
  const reasons = state?.reasons?.join(' · ') || ''
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium leading-tight ${statusClass(state?.status)}`}
      title={`${dimension}: ${label}${reasons ? `. ${reasons}` : ''}`}
    >
      <span className={compact ? 'opacity-70' : ''}>{dimension}:</span>
      <span className="truncate">{label}</span>
    </span>
  )
}

export function CompactQuality({ quality }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1" aria-label="Calidad de los datos">
      {DIMENSIONS.slice(0, 3).map(([key, label]) => (
        <QualityBadge key={key} dimension={label} state={quality?.[key]} compact />
      ))}
    </div>
  )
}

export default function QualityStatus({ quality }) {
  return (
    <section className="rounded-lg border border-terminal-border bg-terminal-surface/20 p-4" aria-label="Estado de calidad">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-terminal-accent">Calidad de los datos</h4>
      <dl className="mt-3 space-y-3">
        {DIMENSIONS.map(([key, label]) => {
          const state = quality?.[key]
          return (
            <div key={key}>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-terminal-muted">{label}</dt>
                <dd><QualityBadge dimension={label} state={state} /></dd>
              </div>
              {state?.reasons?.length > 0 && (
                <dd className="mt-1 text-[11px] leading-relaxed text-terminal-muted/80">{state.reasons.join(' · ')}</dd>
              )}
            </div>
          )
        })}
      </dl>
      <p className="mt-3 border-t border-terminal-border/50 pt-3 text-[11px] leading-relaxed text-terminal-muted">
        Cada estado se evalúa por separado. Un cronograma completo no confirma la vigencia del contrato ni la hora de una cotización.
      </p>
    </section>
  )
}
