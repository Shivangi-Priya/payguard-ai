import { riskTier, statusTier, tierLabel, statusLabel, type RiskTier } from '../lib/format'

const tierClasses: Record<RiskTier, string> = {
  safe: 'text-safe bg-safe-soft border-safe/30',
  medium: 'text-medium bg-medium-soft border-medium/30',
  high: 'text-high bg-high-soft border-high/30',
  critical: 'text-critical bg-critical-soft border-critical/30',
}

export function RiskBadge({ score }: { score: number | null | undefined }) {
  const tier = riskTier(score)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold mono ${tierClasses[tier]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {score ?? 0}
      <span className="font-sans font-medium opacity-80">/100</span>
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const tier = statusTier(status)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${tierClasses[tier]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel[status] ?? status}
    </span>
  )
}

export function RiskLabel({ score }: { score: number | null | undefined }) {
  const tier = riskTier(score)
  return <span className={tierClasses[tier].split(' ')[0]}>{tierLabel[tier]}</span>
}
