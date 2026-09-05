import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { endpoints } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { relativeTime } from '../lib/format'
import { Loading, ErrorState, PageHeader } from '../components/Common'
import { api } from '../lib/api'

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    CRITICAL: 'bg-critical-soft text-critical border-critical/30',
    HIGH: 'bg-high-soft text-high border-high/30',
    MEDIUM: 'bg-medium-soft text-medium border-medium/30',
    LOW: 'bg-safe-soft text-safe border-safe/30',
  }
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold uppercase ${styles[severity] ?? styles.MEDIUM}`}>
      {severity}
    </span>
  )
}

export function Alerts() {
  const { data, error, loading, reload } = useApiData(endpoints.alerts, [], 5000)

  const resolveAlert = async (alertId: string) => {
    await api.post(`/alerts/${alertId}/resolve`)
    await reload()
  }

  if (loading && !data) return <Loading label="Loading alerts" />
  if (error) return <ErrorState message={error} />
  if (!data) return null

  const open = data.filter((a) => a.status === 'open')
  const resolved = data.filter((a) => a.status !== 'open')

  return (
    <div>
      <PageHeader
        title="Security Alerts"
        sub={`${open.length} open alert${open.length !== 1 ? 's' : ''} · ${resolved.length} resolved`}
        actions={
          <div className="flex items-center gap-2">
            <Bell size={16} className={open.length > 0 ? 'text-critical' : 'text-text-dim'} />
          </div>
        }
      />

      {open.length > 0 && (
        <div className="mb-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">Open</h2>
          {open.map((a) => (
            <div key={a.id} className="rounded-xl border border-critical/30 bg-critical-soft p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <SeverityBadge severity={a.severity} />
                  <div>
                    <div className="font-semibold text-sm text-text">{a.title}</div>
                    <div className="text-xs text-text-muted mt-1 max-w-xl">{a.description.slice(0, 180)}</div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-[11px] text-text-dim">{relativeTime(a.timestamp)}</span>
                      <span className="text-[11px] bg-surface-3 text-text-muted rounded px-1.5 py-0.5 uppercase">
                        {a.alert_type.replace('_', ' ')}
                      </span>
                      {a.transaction_id && (
                        <Link to={`/transactions/${a.transaction_id}`} className="text-[11px] text-brand hover:underline">
                          View transaction →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => resolveAlert(a.id)}
                  className="shrink-0 rounded-lg border border-safe/30 bg-safe-soft text-safe px-3 py-1.5 text-xs font-medium hover:bg-safe/20 transition-colors"
                >
                  Mark resolved
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">Resolved</h2>
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="divide-y divide-border-soft">
              {resolved.slice(0, 30).map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-4 py-3 opacity-60">
                  <SeverityBadge severity={a.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                  </div>
                  <span className="text-xs text-text-dim shrink-0">{relativeTime(a.timestamp)}</span>
                  {a.transaction_id && (
                    <Link to={`/transactions/${a.transaction_id}`} className="text-xs text-brand hover:underline shrink-0">
                      View →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {data.length === 0 && (
        <div className="py-20 text-center text-sm text-text-muted">
          No alerts. Run an attack simulation to generate alerts.
        </div>
      )}
    </div>
  )
}
