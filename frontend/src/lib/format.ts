export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n)
}

export function formatTime(iso: string): string {
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'))
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function relativeTime(iso: string): string {
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'))
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export type RiskTier = 'safe' | 'medium' | 'high' | 'critical'

export function riskTier(score: number | null | undefined): RiskTier {
  const s = score ?? 0
  if (s <= 30) return 'safe'
  if (s <= 60) return 'medium'
  if (s <= 80) return 'high'
  return 'critical'
}

export function statusTier(status: string): RiskTier {
  switch (status) {
    case 'APPROVED': return 'safe'
    case 'REVIEW': return 'medium'
    case 'HIGH_RISK': return 'high'
    case 'BLOCKED': return 'critical'
    default: return 'medium'
  }
}

export const tierLabel: Record<RiskTier, string> = {
  safe: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
  critical: 'Critical risk',
}

export const statusLabel: Record<string, string> = {
  APPROVED: 'Approved',
  REVIEW: 'Review',
  HIGH_RISK: 'High risk',
  BLOCKED: 'Blocked',
  PENDING: 'Pending',
}

export const tierDot: Record<RiskTier, string> = {
  safe: '🟢',
  medium: '🟡',
  high: '🟠',
  critical: '🔴',
}

export function statusDot(status: string): string {
  return tierDot[statusTier(status)]
}
