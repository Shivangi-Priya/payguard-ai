import { Link } from 'react-router-dom'
import { ShoppingCart, ShieldOff, ShieldCheck, Gauge, Store, Bot } from 'lucide-react'
import { endpoints } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { formatINR, formatNumber } from '../lib/format'
import { StatCard } from '../components/StatCard'
import { Loading, ErrorState, PageHeader } from '../components/Common'
import { StatusBadge, RiskBadge } from '../components/RiskBadge'

export function Overview() {
  const { data: overview, error, loading } = useApiData(endpoints.overview, [], 6000)
  const { data: txns } = useApiData(() => endpoints.transactions(), [], 6000)
  const { data: alerts } = useApiData(endpoints.alerts, [], 8000)

  if (loading && !overview) return <Loading label="Loading overview" />
  if (error) return <ErrorState message={error} />
  if (!overview) return null

  const recent = (txns ?? []).slice(0, 6)
  const openAlerts = (alerts ?? []).filter((a) => a.status === 'open').slice(0, 5)

  return (
    <div>
      <PageHeader
        title="Overview"
        sub="Real-time trust posture for agentic commerce across your platform."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6 mb-6">
        <StatCard label="Agentic transactions" value={formatNumber(overview.total_agentic_transactions)}
          icon={<ShoppingCart size={16} />} />
        <StatCard label="Blocked" value={formatNumber(overview.transactions_blocked)}
          tone="critical" icon={<ShieldOff size={16} />} />
        <StatCard label="Fraud prevented" value={formatINR(overview.fraud_prevented_amount)}
          tone="safe" icon={<ShieldCheck size={16} />} />
        <StatCard label="Avg. risk score" value={`${overview.average_risk_score}`}
          sub="out of 100" icon={<Gauge size={16} />} />
        <StatCard label="High-risk merchants" value={formatNumber(overview.high_risk_merchants)}
          sub={`of ${overview.total_merchants} total`} icon={<Store size={16} />} />
        <StatCard label="Active AI agents" value={formatNumber(overview.active_ai_agents)}
          sub={`of ${overview.total_agents} registered`} tone="brand" icon={<Bot size={16} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Live transaction feed</h2>
            <Link to="/transactions" className="text-xs font-medium text-brand hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {recent.map((t) => (
              <Link
                key={t.id}
                to={`/transactions/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-2 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.merchant}</div>
                  <div className="text-xs text-text-muted truncate">
                    {t.agent} &middot; {t.user}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="mono text-sm text-text-muted">{formatINR(t.amount)}</span>
                  <RiskBadge score={t.risk_score} />
                  <StatusBadge status={t.status} />
                </div>
              </Link>
            ))}
            {recent.length === 0 && (
              <div className="py-8 text-center text-sm text-text-muted">No transactions yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Open security alerts</h2>
            <Link to="/alerts" className="text-xs font-medium text-brand hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {openAlerts.map((a) => (
              <div key={a.id} className="rounded-lg border border-border-soft p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      a.severity === 'CRITICAL' ? 'bg-critical' : a.severity === 'HIGH' ? 'bg-high' : 'bg-medium'
                    }`}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    {a.severity}
                  </span>
                </div>
                <div className="text-sm font-medium leading-snug">{a.title}</div>
              </div>
            ))}
            {openAlerts.length === 0 && (
              <div className="py-8 text-center text-sm text-text-muted">No open alerts.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
