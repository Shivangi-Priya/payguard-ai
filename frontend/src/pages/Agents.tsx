import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { endpoints } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { formatINR } from '../lib/format'
import { RiskBadge } from '../components/RiskBadge'
import { Loading, ErrorState, PageHeader } from '../components/Common'

function TrustBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    trusted: 'bg-safe-soft text-safe border-safe/30',
    unverified: 'bg-medium-soft text-medium border-medium/30',
    malicious: 'bg-critical-soft text-critical border-critical/30',
  }
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${styles[level] ?? styles.unverified}`}>
      {level}
    </span>
  )
}

function AgentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-safe-soft text-safe border-safe/30',
    suspended: 'bg-medium-soft text-medium border-medium/30',
    revoked: 'bg-critical-soft text-critical border-critical/30',
  }
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${styles[status] ?? 'bg-surface-2 text-text-muted border-border'}`}>
      {status}
    </span>
  )
}

export function Agents() {
  const { data, error, loading } = useApiData(endpoints.agents, [], 8000)

  if (loading && !data) return <Loading label="Loading agents" />
  if (error) return <ErrorState message={error} />
  if (!data) return null

  return (
    <div>
      <PageHeader
        title="Agent Security"
        sub="Cryptographically-identified AI agents and their authorization status."
      />

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                {['Agent', 'Issuer', 'Key Fingerprint', 'User', 'Permissions', 'Spending Limit', 'Txns', 'Risk', 'Trust', 'Status', ''].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-dim">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {data.map((a) => (
                <tr key={a.agent_id} className="hover:bg-surface-2 transition-colors group">
                  <td className="px-4 py-3">
                    <Link to={`/agents/${a.agent_id}`} className="font-medium hover:text-brand transition-colors block">
                      {a.name}
                    </Link>
                    <span className="mono text-[10px] text-text-dim">{a.agent_id.slice(-10)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{a.issuer}</td>
                  <td className="px-4 py-3">
                    <span className="mono text-[10px] text-text-dim bg-surface-2 rounded px-1.5 py-0.5">
                      {a.public_key_fingerprint ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{a.user_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(a.permissions ?? []).map((p) => (
                        <span key={p} className="rounded bg-brand-soft text-brand border border-brand/20 px-1.5 py-0.5 text-[10px] font-medium">
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 mono text-xs">{formatINR(a.spending_limit)}</td>
                  <td className="px-4 py-3 mono text-xs text-text-muted">{a.transactions}</td>
                  <td className="px-4 py-3"><RiskBadge score={a.risk_score} /></td>
                  <td className="px-4 py-3"><TrustBadge level={a.trust_level} /></td>
                  <td className="px-4 py-3"><AgentStatusBadge status={a.status} /></td>
                  <td className="px-4 py-3">
                    <Link to={`/agents/${a.agent_id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-text-dim hover:text-brand">
                      <ExternalLink size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
