import type { ReactNode } from 'react'

export function StatCard({
  label, value, sub, icon, tone = 'default',
}: {
  label: string
  value: string
  sub?: string
  icon?: ReactNode
  tone?: 'default' | 'safe' | 'critical' | 'brand'
}) {
  const toneClass = {
    default: 'text-text',
    safe: 'text-safe',
    critical: 'text-critical',
    brand: 'text-brand',
  }[tone]

  return (
    <div className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</span>
        {icon && <span className="text-text-dim">{icon}</span>}
      </div>
      <div className={`text-2xl font-semibold mono ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-text-muted">{sub}</div>}
    </div>
  )
}
