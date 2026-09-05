import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { endpoints } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { formatINR, formatNumber, riskTier } from '../lib/format'
import { RiskBadge, StatusBadge } from '../components/RiskBadge'
import { Loading, ErrorState, PageHeader } from '../components/Common'

export function Merchants() {
  const { data, error, loading } = useApiData(endpoints.merchants, [], 8000)

  if (loading && !data) return <Loading label="Loading merchants" />
  if (error) return <ErrorState message={error} />
  if (!data) return null

  return (
    <div>
      <PageHeader
        title="Merchant Risk"
        sub="Merchants ranked by dynamic risk score. Score updates as new agentic transactions arrive."
      />

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                {['Merchant', 'Category', 'Agent Txns', 'GMV', 'Refund Rate', 'Cancel Rate', 'Risk Score', 'Trust Score', 'Status', 'KYC', ''].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-dim">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {data.map((m) => {
                const riskColor = {
                  safe: 'bg-safe',
                  medium: 'bg-medium',
                  high: 'bg-high',
                  critical: 'bg-critical',
                }[riskTier(m.risk_score)]

                return (
                  <tr key={m.merchant_id} className="hover:bg-surface-2 transition-colors group">
                    <td className="px-4 py-3">
                      <Link to={`/merchants/${m.merchant_id}`} className="font-medium hover:text-brand transition-colors">
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-muted capitalize">{m.category}</td>
                    <td className="px-4 py-3 mono">{formatNumber(m.agent_transactions)}</td>
                    <td className="px-4 py-3 mono">{formatINR(m.gmv)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.refund_rate > 0.15 ? 'bg-critical' : m.refund_rate > 0.05 ? 'bg-medium' : 'bg-safe'}`}
                            style={{ width: `${Math.min(m.refund_rate * 400, 100)}%` }}
                          />
                        </div>
                        <span className="mono text-xs text-text-muted">{(m.refund_rate * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 mono text-xs text-text-muted">
                      {(m.cancellation_rate * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge score={m.risk_score} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 rounded-full bg-surface-3 overflow-hidden">
                          <div className={`h-full rounded-full ${riskColor}`} style={{ width: `${m.trust_score}%` }} />
                        </div>
                        <span className="mono text-xs text-text-muted">{m.trust_score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status === 'active' ? 'APPROVED' : m.status === 'flagged' ? 'HIGH_RISK' : 'BLOCKED'} />
                    </td>
                    <td className="px-4 py-3">
                      {m.kyc_verified
                        ? <span className="text-xs text-safe font-medium">✓ Verified</span>
                        : <span className="text-xs text-critical font-medium">✗ Unverified</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/merchants/${m.merchant_id}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-text-dim hover:text-brand">
                        <ExternalLink size={14} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
