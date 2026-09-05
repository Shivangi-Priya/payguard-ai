import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Filter } from 'lucide-react'
import { endpoints } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { formatINR, formatTime, relativeTime } from '../lib/format'
import { RiskBadge, StatusBadge } from '../components/RiskBadge'
import { Loading, ErrorState, PageHeader } from '../components/Common'

const STATUS_FILTERS = ['ALL', 'APPROVED', 'REVIEW', 'HIGH_RISK', 'BLOCKED'] as const
type Filter = (typeof STATUS_FILTERS)[number]

export function Transactions() {
  const [filter, setFilter] = useState<Filter>('ALL')
  const { data, error, loading } = useApiData(
    () => endpoints.transactions(filter === 'ALL' ? undefined : filter),
    [filter],
    5000,
  )

  const filterCounts: Record<string, string> = {
    ALL: 'All',
    APPROVED: '🟢 Approved',
    REVIEW: '🟡 Review',
    HIGH_RISK: '🟠 High risk',
    BLOCKED: '🔴 Blocked',
  }

  return (
    <div>
      <PageHeader
        title="Live Transaction Feed"
        sub="All agentic payment requests evaluated by PayGuard AI in real time."
      />

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        <Filter size={14} className="text-text-dim mr-1" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-brand text-white'
                : 'bg-surface-2 text-text-muted hover:text-text hover:bg-surface-3'
            }`}
          >
            {filterCounts[f]}
          </button>
        ))}
      </div>

      {loading && !data && <Loading label="Loading transactions" />}
      {error && <ErrorState message={error} />}

      {data && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  {['Transaction', 'User / Agent', 'Merchant', 'Amount', 'Intent Match', 'Risk Score', 'Status', 'Time'].map(
                    (h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-dim">
                        {h}
                      </th>
                    ),
                  )}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {data.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-2 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="mono text-xs text-text-muted">{t.id.slice(-10)}</span>
                      {t.attack_type && (
                        <span className="ml-2 text-[10px] font-semibold uppercase text-text-dim bg-surface-3 rounded px-1.5 py-0.5">
                          {t.attack_type.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-[140px]">{t.user}</div>
                      <div className="text-xs text-text-muted truncate max-w-[140px]">{t.agent}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/merchants/${t.merchant_id}`}
                        className="hover:text-brand transition-colors truncate max-w-[120px] block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t.merchant}
                      </Link>
                    </td>
                    <td className="px-4 py-3 mono text-sm font-medium">{formatINR(t.amount)}</td>
                    <td className="px-4 py-3">
                      {t.intent_match_score != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                t.intent_match_score >= 70
                                  ? 'bg-safe'
                                  : t.intent_match_score >= 40
                                  ? 'bg-medium'
                                  : 'bg-critical'
                              }`}
                              style={{ width: `${t.intent_match_score}%` }}
                            />
                          </div>
                          <span className="mono text-xs text-text-muted">{t.intent_match_score}</span>
                        </div>
                      ) : (
                        <span className="text-text-dim">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge score={t.risk_score} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-text-dim" title={formatTime(t.timestamp)}>
                      {relativeTime(t.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/transactions/${t.id}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-text-dim hover:text-brand"
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-sm text-text-muted">
                      No transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border-soft px-4 py-2.5 text-xs text-text-dim">
            {data.length} transaction{data.length !== 1 ? 's' : ''} · Auto-refreshes every 5s
          </div>
        </div>
      )}
    </div>
  )
}
