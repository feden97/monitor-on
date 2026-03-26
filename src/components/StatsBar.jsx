import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react'
import { formatNumber } from '../utils/formatters'

/**
 * Displays a quick summary of the current dataset:
 * total instruments, gainers, losers, flat movers, and total volume.
 */
export default function StatsBar({ data }) {
  const stats = useMemo(() => {
    let gainers = 0, losers = 0, flat = 0, totalVol = 0

    for (const row of data) {
      const pct = row.pct_change
      if (pct == null || pct === 0) flat++
      else if (pct > 0) gainers++
      else losers++

      if (row.v != null) totalVol += row.v
    }

    return { total: data.length, gainers, losers, flat, totalVol }
  }, [data])

  const statItems = [
    {
      label: 'Instrumentos',
      value: stats.total,
      icon: <BarChart2 size={14} />,
      className: 'text-terminal-text',
    },
    {
      label: 'Suben',
      value: stats.gainers,
      icon: <TrendingUp size={14} />,
      className: 'text-up',
    },
    {
      label: 'Bajan',
      value: stats.losers,
      icon: <TrendingDown size={14} />,
      className: 'text-down',
    },
    {
      label: 'Sin cambios',
      value: stats.flat,
      icon: <Minus size={14} />,
      className: 'text-flat',
    },
    {
      label: 'Vol. Total',
      value: formatNumber(stats.totalVol),
      icon: <BarChart2 size={14} />,
      className: 'text-terminal-text',
    },
  ]

  return (
    <div className="flex flex-wrap gap-3 mb-5">
      {statItems.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 px-3 py-2 bg-terminal-panel rounded-md border border-terminal-border text-xs"
        >
          <span className={item.className}>{item.icon}</span>
          <span className="text-terminal-muted font-sans">{item.label}</span>
          <span className={`font-mono font-semibold ${item.className}`}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}
