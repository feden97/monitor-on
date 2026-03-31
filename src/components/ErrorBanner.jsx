import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Displays an error message with a retry button.
 */
export default function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 mb-5 rounded-md border border-down/30 bg-down-light text-down text-sm">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <span className="font-semibold">Error al cargar los datos: </span>
        {message}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 flex items-center gap-1 text-xs font-semibold
                     px-2 py-1 rounded border border-down/40 hover:bg-down/10"
        >
          <RefreshCw size={12} />
          Reintentar
        </button>
      )}
    </div>
  )
}
