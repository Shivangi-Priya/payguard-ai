import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, TrendingUp, ShieldAlert } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { endpoints } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { formatINR, formatNumber, relativeTime, riskTier } from '../lib/format'
import { RiskBadge, StatusBadge } from '../components/RiskBadge'
import { Loading, ErrorState } from '../components/Common'

const tooltipStyle = {
  backgroundColor: '#10162A',
  border: '1px solid #232C4A',
  borderRadius: 8,
  color: '#E9ECF8',
  fontSize: 12,
}

export function MerchantDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: m, error, loading } = useApiData(() => endpoints.merchant(id!), [id])

  if (loading) return <Loading label="Loading merchant" />
  if (error) return <ErrorState message={error} />
  if (!m) return null

  const riskColor = { safe: '#2FD480', medium: '#F5C044', high: '#FF9640', critical: '#FF5470' }[riskTier(m.risk_score)]

  const statsData = [
    { label: 'Refund rate', value: m.refund_rate * 100 },
    { label: 'Cancel rate', value: m.cancellation_rate * 100 },
    { label: 'Risk score', value: m.risk_score },
    { label: 'Trust score', value: m.trust_score },
  ]

  return (
    <div>
      <div className="mb-5">
        <Link to="/merchants" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors">
          <ArrowLeft size={14} /> Back to merchants
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{m.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-text-muted flex-wrap">
            <span className="capitalize">{m.category}</span>
            <span>·</span>
            {m.kyc_verified
              ? <span className="text-safe text-xs font-medium">✓ KYC Verified</span>
              : <span className="text-critical text-xs font-medium">✗ KYC Unverified</span>}
            <span>·</span>
            <span className={`text-xs font-medium capitalize ${m.status === 'flagged' ? 'text-high' : m.status === 'active' ? 'text-safe' : 'text-critical'}`}>
              {m.status}
            </span>
          </div>
        </div>
        <RiskBadge score={m.risk_score} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Agent Transactions', value: formatNumber(m.agentic_txn_count) },
          { label: 'Total GMV', value: formatINR(m.gmv) },
          { label: 'Refund Rate', value: `${(m.refund_rate * 100).toFixed(1)}%` },
          { label: 'Cancel Rate', value: `${(m.cancellation_rate * 100).toFixed(1)}%` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
            <div className="text-xs text-text-dim uppercase tracking-wider mb-2">{s.label}</div>
            <div className="mono text-xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Risk metrics chart */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <ShieldAlert size={14} className="text-brand" />
            Risk Metrics
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statsData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#232C4A" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#5C6488', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#5C6488', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(1)}`} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statsData.map((_, i) => (
                  <Cell key={i} fill={i < 2 ? '#FF5470' : i === 2 ? riskColor : '#2FD480'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent events */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp size={14} className="text-brand" />
            Recent Events
          </h2>
          <div className="space-y-2 max-h-[180px] overflow-y-auto">
            {m.events.slice(0, 10).map((ev, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <div>
                  <span className="font-medium capitalize">{ev.type.replace('_', ' ')}</span>
                  {ev.detail && <span className="text-text-muted ml-1 truncate">{ev.detail.slice(0, 60)}</span>}
                  <div className="text-text-dim">{relativeTime(ev.timestamp)}</div>
                </div>
              </div>
            ))}
            {m.events.length === 0 && <div className="text-text-dim text-xs">No events yet.</div>}
          </div>
        </div>
      </div>

      {/* Recent transactions table */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold mb-4">Recent Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['ID', 'User', 'Agent', 'Amount', 'Risk', 'Status', 'Time'].map((h) => (
                  <th key={h} className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-text-dim">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {m.recent_transactions.map((t) => (
                <tr key={t.id} className="hover:bg-surface-2 transition-colors">
                  <td className="py-2.5">
                    <Link to={`/transactions/${t.id}`} className="mono text-xs text-text-muted hover:text-brand">
                      {t.id.slice(-8)}
                    </Link>
                  </td>
                  <td className="py-2.5 text-xs text-text-muted">{t.user}</td>
                  <td className="py-2.5 text-xs text-text-muted">{t.agent}</td>
                  <td className="py-2.5 mono text-xs">{formatINR(t.amount)}</td>
                  <td className="py-2.5"><RiskBadge score={t.risk_score} /></td>
                  <td className="py-2.5"><StatusBadge status={t.status} /></td>
                  <td className="py-2.5 text-xs text-text-dim">{relativeTime(t.timestamp)}</td>
                </tr>
              ))}
              {m.recent_transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-text-dim">No transactions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
