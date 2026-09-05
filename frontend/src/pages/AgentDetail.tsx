import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, ShieldOff, RefreshCw, Pencil, CheckCircle, XCircle } from 'lucide-react'
import { endpoints } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { formatINR, relativeTime, formatTime } from '../lib/format'
import { RiskBadge, StatusBadge } from '../components/RiskBadge'
import { Loading, ErrorState } from '../components/Common'

export function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: agent, error, loading, reload } = useApiData(() => endpoints.agent(id!), [id])
  const [acting, setActing] = useState(false)
  const [limitInput, setLimitInput] = useState('')
  const [showLimitEdit, setShowLimitEdit] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const toast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  const doAction = async (fn: () => Promise<unknown>, msg: string) => {
    setActing(true)
    try {
      await fn()
      toast(msg)
      await reload()
    } catch (e) {
      toast('Action failed — see console.')
    } finally {
      setActing(false)
    }
  }

  if (loading) return <Loading label="Loading agent" />
  if (error) return <ErrorState message={error} />
  if (!agent) return null

  const isActive = agent.status === 'active'
  const isRevoked = agent.status === 'revoked'

  return (
    <div>
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 rounded-lg border border-safe/40 bg-safe-soft text-safe px-4 py-2.5 text-sm font-medium shadow-xl">
          {toastMsg}
        </div>
      )}

      <div className="mb-5">
        <Link to="/agents" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors">
          <ArrowLeft size={14} /> Back to agents
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{agent.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-text-muted flex-wrap">
            <span className="mono text-xs bg-surface-2 rounded px-2 py-0.5">{agent.agent_id}</span>
            <span>·</span>
            <span>{agent.issuer}</span>
            <span>·</span>
            <span>Expires {formatTime(agent.expires_at)}</span>
          </div>
        </div>
        <RiskBadge score={agent.risk_score} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: identity card */}
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold mb-4">Identity & Authorization</h2>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Status', value: <span className={`font-medium capitalize ${isActive ? 'text-safe' : isRevoked ? 'text-critical' : 'text-medium'}`}>{agent.status}</span> },
                { label: 'Trust Level', value: <span className="capitalize">{agent.trust_level}</span> },
                { label: 'Issuer', value: agent.issuer },
                { label: 'User', value: agent.user_id.slice(-8) },
                {
                  label: 'Permissions',
                  value: (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {agent.permissions.map((p) => (
                        <span key={p} className="rounded bg-brand-soft text-brand border border-brand/20 px-1.5 py-0.5 text-[10px] font-medium">
                          {p}
                        </span>
                      ))}
                    </div>
                  ),
                },
                {
                  label: 'Spending Limit',
                  value: (
                    <div className="flex items-center gap-2">
                      <span className="mono font-semibold">{formatINR(agent.spending_limit)}</span>
                      <button onClick={() => setShowLimitEdit(!showLimitEdit)}
                        className="text-text-dim hover:text-brand transition-colors" title="Edit limit">
                        <Pencil size={12} />
                      </button>
                    </div>
                  ),
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-2">
                  <span className="text-text-muted shrink-0">{label}</span>
                  <span className="text-right break-all">{value}</span>
                </div>
              ))}
            </div>

            {showLimitEdit && (
              <div className="mt-4 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm mono text-text focus:outline-none focus:border-brand"
                  placeholder="New limit (₹)"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  type="number"
                />
                <button
                  disabled={acting}
                  onClick={() => {
                    const v = parseFloat(limitInput)
                    if (v > 0) {
                      doAction(() => endpoints.changeLimit(id!, v), `Spending limit updated to ${formatINR(v)}`)
                      setShowLimitEdit(false)
                      setLimitInput('')
                    }
                  }}
                  className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm font-medium hover:bg-brand/90 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            )}
          </div>

          {/* Action panel */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold mb-3">Security Actions</h2>
            <div className="space-y-2">
              {!isRevoked && (
                <>
                  {isActive ? (
                    <button
                      disabled={acting}
                      onClick={() => doAction(() => endpoints.suspendAgent(id!), 'Agent suspended.')}
                      className="w-full flex items-center gap-2 rounded-lg border border-medium/30 bg-medium-soft text-medium px-4 py-2.5 text-sm font-medium hover:bg-medium/20 disabled:opacity-50 transition-colors"
                    >
                      <ShieldOff size={14} /> Suspend agent
                    </button>
                  ) : (
                    <button
                      disabled={acting}
                      onClick={() => doAction(() => endpoints.reactivateAgent(id!), 'Agent reactivated.')}
                      className="w-full flex items-center gap-2 rounded-lg border border-safe/30 bg-safe-soft text-safe px-4 py-2.5 text-sm font-medium hover:bg-safe/20 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle size={14} /> Reactivate agent
                    </button>
                  )}
                  <button
                    disabled={acting}
                    onClick={() => doAction(() => endpoints.rotateKey(id!), 'Signing key rotated.')}
                    className="w-full flex items-center gap-2 rounded-lg border border-brand/30 bg-brand-soft text-brand px-4 py-2.5 text-sm font-medium hover:bg-brand/20 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={14} /> Rotate signing key
                  </button>
                  <button
                    disabled={acting}
                    onClick={() => doAction(() => endpoints.revokeAgent(id!), 'Agent permanently revoked.')}
                    className="w-full flex items-center gap-2 rounded-lg border border-critical/30 bg-critical-soft text-critical px-4 py-2.5 text-sm font-medium hover:bg-critical/20 disabled:opacity-50 transition-colors"
                  >
                    <XCircle size={14} /> Revoke agent (permanent)
                  </button>
                </>
              )}
              {isRevoked && (
                <div className="rounded-lg border border-critical/30 bg-critical-soft px-4 py-3 text-sm text-critical font-medium">
                  This agent has been permanently revoked and cannot be reactivated.
                </div>
              )}
            </div>
          </div>

          {/* Public key */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <ShieldCheck size={14} className="text-brand" />
              Public Key (Ed25519)
            </h2>
            <div className="mono text-[10px] text-text-dim bg-surface-2 rounded p-3 break-all leading-relaxed max-h-32 overflow-y-auto">
              {agent.public_key ?? 'No active key'}
            </div>
            {agent.public_key_fingerprint && (
              <div className="mt-2 text-[11px] text-text-dim">
                Fingerprint: <span className="mono text-text-muted">{agent.public_key_fingerprint}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: events + transactions */}
        <div className="lg:col-span-2 space-y-5">
          {/* Events timeline */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold mb-4">Event History</h2>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {agent.events.map((ev, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  <div className="flex-1">
                    <span className="font-medium capitalize text-text">{ev.type.replace(/_/g, ' ')}</span>
                    {ev.detail && <span className="ml-2 text-text-muted">{ev.detail.slice(0, 80)}</span>}
                  </div>
                  <span className="shrink-0 text-text-dim">{relativeTime(ev.timestamp)}</span>
                </div>
              ))}
              {agent.events.length === 0 && <div className="text-xs text-text-dim">No events recorded.</div>}
            </div>
          </div>

          {/* Transactions */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold mb-4">Recent Transactions</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['ID', 'Merchant', 'Amount', 'Risk', 'Status', 'Time'].map((h) => (
                      <th key={h} className="pb-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-dim">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {agent.recent_transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-2 transition-colors">
                      <td className="py-2.5">
                        <Link to={`/transactions/${t.id}`} className="mono text-xs text-text-muted hover:text-brand">
                          {t.id.slice(-8)}
                        </Link>
                      </td>
                      <td className="py-2.5 text-xs text-text-muted max-w-[120px] truncate">{t.merchant}</td>
                      <td className="py-2.5 mono text-xs">{formatINR(t.amount)}</td>
                      <td className="py-2.5"><RiskBadge score={t.risk_score} /></td>
                      <td className="py-2.5"><StatusBadge status={t.status} /></td>
                      <td className="py-2.5 text-xs text-text-dim">{relativeTime(t.timestamp)}</td>
                    </tr>
                  ))}
                  {agent.recent_transactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-text-dim">No transactions yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
