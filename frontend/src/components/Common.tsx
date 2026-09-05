import { Loader2 } from 'lucide-react'

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-text-muted text-sm">
      <Loader2 size={16} className="animate-spin" />
      {label}…
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-critical/30 bg-critical-soft px-4 py-3 text-sm text-critical">
      {message}
    </div>
  )
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>
        {sub && <p className="mt-1 text-sm text-text-muted">{sub}</p>}
      </div>
      {actions}
    </div>
  )
}
