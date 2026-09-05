import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle, XCircle, AlertTriangle, Shield,
  Hash, Package, Store, Bot, ShieldCheck, Activity,
} from 'lucide-react'
import { endpoints } from '../lib/api'
import type { TransactionDetail as TxnDetail, Explanation } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { formatINR, formatTime, riskTier } from '../lib/format'
import { RiskBadge, StatusBadge } from '../components/RiskBadge'
import { IntentChain, type ChainNode } from '../components/IntentChain'
import { Loading, ErrorState } from '../components/Common'

function ScoreBar({ label, score, note }: { label: string; score: number; note?: string }) {
  const tier = riskTier(score)
  const colors = { safe: 'bg-safe', medium: 'bg-medium', high: 'bg-high', critical: 'bg-critical' }
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="text-text-muted">{label}</span>
        <span className={`mono font-semibold ${
          tier === 'safe' ? 'text-safe' : tier === 'medium' ? 'text-medium' : tier === 'high' ? 'text-high' : 'text-critical'
        }`}>{score}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colors[tier]}`} style={{ width: `${score}%` }} />
      </div>
      {note && <div className="text-[11px] text-text-dim">{note}</div>}
    </div>
  )
}

function DecisionBanner({ explanation }: { explanation: Explanation }) {
  const { decision, risk_score, risk_level, recommendation, prevented_loss, basket_total, declared_max_price } = explanation
  const isCritical = decision === 'BLOCK'
  const isHigh = decision === 'HOLD'
  const isOk = decision === 'APPROVE'

  const bg = isCritical
    ? 'border-critical/40 bg-critical-soft'
    : isHigh
    ? 'border-high/40 bg-high-soft'
    : isOk
    ? 'border-safe/40 bg-safe-soft'
    : 'border-medium/40 bg-medium-soft'

  const icon = isCritical ? <XCircle size={22} className="text-critical" />
    : isHigh ? <AlertTriangle size={22} className="text-high" />
    : <CheckCircle size={22} className="text-safe" />

  return (
    <div className={`rounded-xl border p-5 ${bg}`}>
      <div className="flex items-start gap-4">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-lg font-bold ${isCritical ? 'text-critical' : isHigh ? 'text-high' : isOk ? 'text-safe' : 'text-medium'}`}>
              {risk_level}
            </span>
            <span className="mono text-2xl font-bold text-text">{risk_score}/100</span>
          </div>
          <p className="mt-1 text-sm text-text-muted">{explanation.summary}</p>
          {prevented_loss != null && prevented_loss > 0 && (
            <div className="mt-3 rounded-lg border border-safe/30 bg-safe/10 px-3 py-2 inline-flex items-center gap-2">
              <ShieldCheck size={14} className="text-safe" />
              <span className="text-sm font-semibold text-safe">
                {formatINR(prevented_loss)} prevented loss
              </span>
              {declared_max_price && (
                <span className="text-xs text-text-muted ml-1">
                  ({formatINR(basket_total)} requested · {formatINR(declared_max_price)} authorised)
                </span>
              )}
            </div>
          )}
          <div className="mt-3 text-xs font-bold uppercase tracking-wider text-text-muted">
            → {recommendation}
          </div>
        </div>
      </div>
    </div>
  )
}

function buildChainNodes(txn: TxnDetail): ChainNode[] {
  const exp = txn.explanation
  const intent = txn.user_intent
  const item = txn.items[0]

  const intentRisk = exp.weighted_components.intent_risk
  const agentRisk = exp.weighted_components.agent_risk

  const hasBudgetBreach = intent?.max_price != null && txn.amount > intent.max_price
  const hasCategoryMismatch = intent?.category && item?.category && intent.category !== item.category
  const hasAgentIssue = agentRisk > 50

  const nodes: ChainNode[] = [
    {
      key: 'intent',
      label: 'User Intent',
      tier: 'neutral',
      detail: intent ? (
        <div>
          <span className="font-medium">"{intent.raw_text}"</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {intent.category && (
              <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-text-muted">
                Category: {intent.category}
              </span>
            )}
            {intent.max_price && (
              <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-text-muted">
                Budget: ≤ {formatINR(intent.max_price)}
              </span>
            )}
            {intent.brand && (
              <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-text-muted">
                Brand: {intent.brand}
              </span>
            )}
          </div>
        </div>
      ) : <span className="text-text-muted italic">Intent not captured</span>,
    },
    {
      key: 'agent',
      label: 'Agent Decision',
      tier: hasAgentIssue ? 'critical' : 'safe',
      broken: hasAgentIssue || undefined,
      detail: (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={txn.signature_valid ? 'text-safe text-xs font-medium' : 'text-critical text-xs font-medium'}>
            {txn.signature_valid ? '✓ Signature valid' : '✗ Signature invalid'}
          </span>
          <span className="text-xs text-text-muted">{txn.agent}</span>
        </div>
      ),
    },
    {
      key: 'basket',
      label: 'Final Basket',
      tier: hasBudgetBreach || hasCategoryMismatch ? 'critical' : (intentRisk > 50 ? 'high' : 'safe'),
      broken: (hasBudgetBreach || hasCategoryMismatch) || undefined,
      detail: txn.items.length > 0 ? (
        <div className="space-y-1">
          {txn.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Package size={12} className="text-text-dim" />
                <span className="text-sm">{item.product_name}</span>
                {item.is_addon && (
                  <span className="text-[10px] uppercase font-bold text-critical">Add-on</span>
                )}
              </span>
              <span className="mono text-sm font-medium text-text-muted">
                {formatINR(item.unit_price)} × {item.quantity}
              </span>
            </div>
          ))}
          <div className="pt-1 border-t border-border-soft flex justify-between">
            <span className="text-xs text-text-muted">Total</span>
            <span className={`mono text-sm font-bold ${hasBudgetBreach ? 'text-critical' : 'text-text'}`}>
              {formatINR(txn.amount)}
              {hasBudgetBreach && intent?.max_price && (
                <span className="ml-1 text-[11px] text-critical font-normal">
                  (+{formatINR(txn.amount - intent.max_price)} over budget)
                </span>
              )}
            </span>
          </div>
        </div>
      ) : <span className="text-text-muted italic">No items</span>,
    },
    {
      key: 'risk',
      label: 'Risk Analysis',
      tier: riskTier(exp.risk_score),
      detail: (
        <div className="space-y-1 mt-1">
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            <span className="text-text-muted">Intent risk</span>
            <span className={`mono font-medium ${exp.weighted_components.intent_risk > 60 ? 'text-critical' : 'text-text-muted'}`}>
              {exp.weighted_components.intent_risk}
            </span>
            <span className="text-text-muted">Basket risk</span>
            <span className={`mono font-medium ${exp.weighted_components.basket_risk > 60 ? 'text-critical' : 'text-text-muted'}`}>
              {exp.weighted_components.basket_risk}
            </span>
            <span className="text-text-muted">Merchant risk</span>
            <span className={`mono font-medium ${exp.weighted_components.merchant_risk > 60 ? 'text-critical' : 'text-text-muted'}`}>
              {exp.weighted_components.merchant_risk}
            </span>
            <span className="text-text-muted">Agent risk</span>
            <span className={`mono font-medium ${exp.weighted_components.agent_risk > 60 ? 'text-critical' : 'text-text-muted'}`}>
              {exp.weighted_components.agent_risk}
            </span>
            <span className="text-text-muted">Mandate risk</span>
            <span className={`mono font-medium ${exp.weighted_components.mandate_risk > 60 ? 'text-critical' : 'text-text-muted'}`}>
              {exp.weighted_components.mandate_risk}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'decision',
      label: 'Decision',
      tier: riskTier(exp.risk_score),
      detail: (
        <span className={`font-bold text-sm uppercase tracking-wider ${
          exp.decision === 'BLOCK' ? 'text-critical' :
          exp.decision === 'HOLD' ? 'text-high' :
          exp.decision === 'REVIEW' ? 'text-medium' : 'text-safe'
        }`}>
          {exp.recommendation}
        </span>
      ),
    },
  ]
  return nodes
}

export function TransactionDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: txn, error, loading } = useApiData(
    () => endpoints.transaction(id!),
    [id],
  )

  if (loading) return <Loading label="Loading transaction" />
  if (error) return <ErrorState message={error} />
  if (!txn) return null

  const exp = txn.explanation
  const chainNodes = buildChainNodes(txn)

  return (
    <div>
      <div className="mb-5">
        <Link to="/transactions" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors">
          <ArrowLeft size={14} /> Back to transactions
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold">Transaction</h1>
            <span className="mono text-sm text-text-muted bg-surface-2 rounded px-2 py-0.5">{txn.id}</span>
            <StatusBadge status={txn.status} />
          </div>
          <div className="mt-1 text-sm text-text-muted">
            {txn.user} · {txn.agent} · {formatTime(txn.timestamp)}
          </div>
        </div>
        <div className="text-right">
          <div className="mono text-2xl font-bold">{formatINR(txn.amount)}</div>
          <div className="text-xs text-text-muted">{txn.merchant}</div>
        </div>
      </div>

      {/* Decision banner */}
      <DecisionBanner explanation={exp} />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: intent chain */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Activity size={14} className="text-brand" />
              Intent–to–Decision Chain
            </h2>
            <IntentChain nodes={chainNodes} vertical={true} />
          </div>
        </div>

        {/* Right: details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Score breakdown */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Shield size={14} className="text-brand" />
              Risk Score Breakdown
            </h2>
            <div className="space-y-4">
              <ScoreBar
                label={`Intent Match Risk (${(exp.weights.intent * 100).toFixed(0)}% weight)`}
                score={exp.weighted_components.intent_risk}
                note={`Intent match score: ${exp.component_scores.intent_match_score}/100`}
              />
              <ScoreBar
                label={`Basket Integrity Risk (${(exp.weights.basket * 100).toFixed(0)}% weight)`}
                score={exp.weighted_components.basket_risk}
                note={`Basket integrity score: ${exp.component_scores.basket_integrity_score}/100`}
              />
              <ScoreBar
                label={`Merchant Risk (${(exp.weights.merchant * 100).toFixed(0)}% weight)`}
                score={exp.weighted_components.merchant_risk}
                note={`Merchant risk score: ${exp.component_scores.merchant_risk_score}/100`}
              />
              <ScoreBar
                label={`Agent Identity Risk (${(exp.weights.agent * 100).toFixed(0)}% weight)`}
                score={exp.weighted_components.agent_risk}
                note={`Agent identity risk: ${exp.component_scores.agent_identity_risk}/100`}
              />
              <ScoreBar
                label={`Mandate Velocity Risk (${(exp.weights.mandate * 100).toFixed(0)}% weight)`}
                score={exp.weighted_components.mandate_risk}
                note={`Mandate risk score: ${exp.component_scores.mandate_risk_score}/100`}
              />
              <div className="pt-2 border-t border-border-soft flex justify-between items-center">
                <span className="text-sm font-semibold text-text">Overall Risk Score</span>
                <RiskBadge score={exp.risk_score} />
              </div>
            </div>
          </div>

          {/* Why flagged */}
          {exp.reasons.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-high" />
                Fraud Signals Detected
              </h2>
              <ul className="space-y-2">
                {exp.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-critical" />
                    <span className="text-text-muted">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cryptographic details */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Hash size={14} className="text-brand" />
              Cryptographic Verification
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2">
                {txn.signature_valid
                  ? <CheckCircle size={14} className="text-safe shrink-0" />
                  : <XCircle size={14} className="text-critical shrink-0" />}
                <span className={txn.signature_valid ? 'text-safe font-medium' : 'text-critical font-medium'}>
                  Agent signature {txn.signature_valid ? 'verified' : 'INVALID'}
                </span>
              </div>
              {[
                { label: 'Intent Hash', val: txn.intent_hash },
                { label: 'Basket Hash', val: txn.basket_hash },
                { label: 'Signature', val: txn.signature ? txn.signature.slice(0, 40) + '…' : 'None' },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div className="text-text-dim mb-1">{label}</div>
                  <div className="mono bg-surface-2 rounded px-2 py-1.5 text-text-muted break-all">{val ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="flex gap-3 flex-wrap">
            {txn.merchant_id && (
              <Link
                to={`/merchants/${txn.merchant_id}`}
                className="flex items-center gap-1.5 text-sm text-brand hover:underline"
              >
                <Store size={14} /> View merchant analytics
              </Link>
            )}
            {txn.agent_id && (
              <Link
                to={`/agents/${txn.agent_id}`}
                className="flex items-center gap-1.5 text-sm text-brand hover:underline"
              >
                <Bot size={14} /> View agent profile
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
