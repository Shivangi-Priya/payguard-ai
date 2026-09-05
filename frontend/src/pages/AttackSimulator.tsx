import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FlaskConical, Play, ShieldAlert, ShieldCheck, Zap, UserX, Store, Loader2,
} from 'lucide-react'
import { endpoints } from '../lib/api'
import type { TransactionDetail } from '../lib/api'
import { formatINR, riskTier } from '../lib/format'
import { RiskBadge, StatusBadge } from '../components/RiskBadge'
import { IntentChain, type ChainNode } from '../components/IntentChain'
import { PageHeader } from '../components/Common'

type AttackKey = 'intent' | 'merchant' | 'fake_agent' | 'mandate' | 'normal'

interface Attack {
  key: AttackKey
  title: string
  label: string
  description: string
  scenario: string[]
  icon: React.ReactNode
  expectedRisk: string
  expectedDecision: string
  tone: string
  run: () => Promise<TransactionDetail>
}

const ATTACKS: Attack[] = [
  {
    key: 'normal',
    title: 'Normal Transaction',
    label: 'Attack 5 — Baseline',
    description: 'Legitimate purchase: trusted agent, correct product, within budget, valid signature, normal velocity.',
    scenario: [
      'User: "Buy a Dell laptop under ₹70,000 with 16GB RAM"',
      'Agent selects: Dell Laptop ₹65,999 ✓',
      'Merchant: trusted, KYC verified ✓',
      'Signature: valid ✓',
      'Velocity: normal ✓',
    ],
    icon: <ShieldCheck size={22} className="text-safe" />,
    expectedRisk: '0–30',
    expectedDecision: 'APPROVE',
    tone: 'safe',
    run: endpoints.simNormal,
  },
  {
    key: 'intent',
    title: 'Intent Manipulation',
    label: 'Attack 1 — Prompt Injection',
    description: 'A malicious product page injects a hidden instruction, causing the agent to add a ₹12,000 headphone instead of the requested ₹5,000 shoes.',
    scenario: [
      'User: "Buy running shoes under ₹5,000"',
      'Agent visits product page with hidden instruction',
      'Agent adds: Sony Headphones ₹12,000 ✗',
      'Category mismatch detected: shoes → headphones',
      'Budget exceeded: ₹12,000 > ₹5,000',
    ],
    icon: <Zap size={22} className="text-critical" />,
    expectedRisk: '80–100',
    expectedDecision: 'BLOCK',
    tone: 'critical',
    run: endpoints.simIntentManipulation,
  },
  {
    key: 'merchant',
    title: 'Malicious Merchant',
    label: 'Attack 2 — Merchant Anomaly',
    description: 'A merchant suddenly shows a 4× spike in agentic transactions with a high refund rate, indicating coordinated basket manipulation.',
    scenario: [
      'Merchant agentic volume: 4× increase over baseline',
      'Refund rate: 28% (normal: <5%) ✗',
      'Cancellation rate: 18% ✗',
      'Merchant previously flagged ✗',
      'Hidden subscription add-on in basket',
    ],
    icon: <Store size={22} className="text-high" />,
    expectedRisk: '60–85',
    expectedDecision: 'HOLD / BLOCK',
    tone: 'high',
    run: endpoints.simMaliciousMerchant,
  },
  {
    key: 'fake_agent',
    title: 'Fake Agent',
    label: 'Attack 3 — Stolen Mandate',
    description: 'An unregistered, malicious agent attempts to use a legitimate user\'s payment mandate with a forged or tampered signature.',
    scenario: [
      'Agent issuer: unverified-third-party ✗',
      'Agent trust level: MALICIOUS ✗',
      'Signature verification: FAILED ✗',
      'No matching trusted keypair found',
      'Agent attempting to use stolen mandate',
    ],
    icon: <UserX size={22} className="text-critical" />,
    expectedRisk: '80–100',
    expectedDecision: 'BLOCK',
    tone: 'critical',
    run: endpoints.simFakeAgent,
  },
  {
    key: 'mandate',
    title: 'Mandate Drain',
    label: 'Attack 4 — Velocity Attack',
    description: '30 identical ₹4,999 gift card transactions across 15 merchants within 8 minutes — a pattern consistent with automated mandate draining.',
    scenario: [
      '30 transactions in < 8 minutes ✗',
      '15 different merchants ✗',
      'Identical amounts: ₹4,999 × 30 ✗',
      'Non-refundable gift cards ✗',
      'Total attempted drain: ₹1,49,970',
    ],
    icon: <ShieldAlert size={22} className="text-critical" />,
    expectedRisk: '80–100',
    expectedDecision: 'BLOCK',
    tone: 'critical',
    run: endpoints.simMandateDrain,
  },
]

function AttackCard({
  attack,
  running,
  result,
  onRun,
}: {
  attack: Attack
  running: boolean
  result: TransactionDetail | null
  onRun: () => void
}) {
  const toneRing: Record<string, string> = {
    safe: 'border-safe/30 hover:border-safe/60',
    high: 'border-high/30 hover:border-high/60',
    critical: 'border-critical/30 hover:border-critical/60',
  }
  const toneBg: Record<string, string> = {
    safe: 'bg-safe-soft',
    high: 'bg-high-soft',
    critical: 'bg-critical-soft',
  }

  const hasResult = result !== null

  const buildResultChain = (txn: TransactionDetail): ChainNode[] => {
    const exp = txn.explanation
    const intent = txn.user_intent
    const item = txn.items[0]
    const hasBreach = intent?.max_price != null && txn.amount > intent.max_price
    const hasCatMismatch = intent?.category && item?.category && intent.category !== item.category
    return [
      {
        key: 'intent',
        label: 'User Intent',
        tier: 'neutral',
        detail: intent ? `"${intent.raw_text.slice(0, 60)}"` : '—',
      },
      {
        key: 'basket',
        label: 'Final Basket',
        tier: hasBreach || hasCatMismatch ? 'critical' : 'safe',
        broken: (hasBreach || hasCatMismatch) || undefined,
        detail: item ? `${item.product_name} — ${formatINR(item.unit_price)}` : '—',
      },
      {
        key: 'decision',
        label: 'PayGuard Decision',
        tier: riskTier(exp.risk_score),
        detail: (
          <div className="flex items-center gap-2">
            <span className="font-bold">{exp.decision}</span>
            <RiskBadge score={exp.risk_score} />
          </div>
        ),
      },
    ]
  }

  return (
    <div className={`rounded-xl border bg-surface transition-colors ${toneRing[attack.tone] ?? 'border-border hover:border-border'}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-lg ${toneBg[attack.tone] ?? 'bg-surface-2'}`}>
              {attack.icon}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-dim mb-0.5">{attack.label}</div>
              <div className="font-semibold text-base">{attack.title}</div>
            </div>
          </div>
          <button
            onClick={onRun}
            disabled={running}
            className={`shrink-0 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              attack.tone === 'safe'
                ? 'bg-safe text-bg hover:bg-safe/90 disabled:opacity-50'
                : attack.tone === 'high'
                ? 'bg-high text-bg hover:bg-high/90 disabled:opacity-50'
                : 'bg-critical text-white hover:bg-critical/90 disabled:opacity-50'
            }`}
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {running ? 'Running…' : 'Run'}
          </button>
        </div>

        <p className="text-sm text-text-muted mb-3">{attack.description}</p>

        <div className="rounded-lg bg-surface-2 border border-border-soft p-3 mb-3 space-y-1">
          {attack.scenario.map((s, i) => (
            <div key={i} className="text-xs text-text-muted flex items-start gap-2">
              <span className="mono shrink-0 text-text-dim">{(i + 1).toString().padStart(2, '0')}</span>
              <span>{s}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-text-dim">
          <span>Expected risk: <span className="mono font-semibold text-text">{attack.expectedRisk}</span></span>
          <span>·</span>
          <span>Expected: <span className="font-semibold text-text">{attack.expectedDecision}</span></span>
        </div>
      </div>

      {/* Result panel */}
      {hasResult && result && (
        <div className="border-t border-border-soft px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-text-dim">Result</span>
            <StatusBadge status={result.status} />
            <RiskBadge score={result.risk_score} />
            {result.explanation.prevented_loss != null && result.explanation.prevented_loss > 0 && (
              <span className="text-xs text-safe font-semibold ml-auto">
                {formatINR(result.explanation.prevented_loss)} prevented
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <IntentChain nodes={buildResultChain(result)} vertical={true} />
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-dim mb-1">Fraud Signals</div>
              {result.explanation.reasons.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-text-muted">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-critical" />
                  {r.replace(/^\[.*?\]\s*/, '')}
                </div>
              ))}
              {result.explanation.reasons.length > 5 && (
                <div className="text-[11px] text-text-dim">+{result.explanation.reasons.length - 5} more</div>
              )}
            </div>
          </div>

          <Link
            to={`/transactions/${result.id}`}
            className="text-xs text-brand hover:underline"
          >
            Full analysis report →
          </Link>
        </div>
      )}
    </div>
  )
}

export function AttackSimulator() {
  const [running, setRunning] = useState<AttackKey | null>(null)
  const [results, setResults] = useState<Partial<Record<AttackKey, TransactionDetail>>>({})

  const runAttack = async (attack: Attack) => {
    setRunning(attack.key)
    try {
      const result = await attack.run()
      setResults((prev) => ({ ...prev, [attack.key]: result }))
    } catch (e) {
      alert(`Attack simulation failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setRunning(null)
    }
  }

  const allRan = Object.keys(results).length === ATTACKS.length
  const blockedCount = Object.values(results).filter((r) => r?.status === 'BLOCKED').length

  return (
    <div>
      <PageHeader
        title="Attack Simulator"
        sub="Simulate real agentic commerce attack vectors and watch PayGuard AI detect them in real time."
        actions={
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-text-dim" />
            {allRan && (
              <span className="text-xs font-medium text-safe">
                {blockedCount}/{ATTACKS.length} attacks blocked ✓
              </span>
            )}
          </div>
        }
      />

      <div className="mb-4 rounded-xl border border-brand/20 bg-brand-soft p-4 text-sm text-text-muted">
        <div className="font-semibold text-brand mb-1">How to demo</div>
        Click <strong>Run</strong> on each attack. PayGuard AI will analyze it through all four detection
        layers (Intent · Basket · Merchant · Agent/Mandate) and return an explainable fraud report.
        Click <em>Full analysis report</em> to see the complete intent-to-decision chain.
      </div>

      <div className="space-y-4">
        {ATTACKS.map((attack) => (
          <AttackCard
            key={attack.key}
            attack={attack}
            running={running === attack.key}
            result={results[attack.key] ?? null}
            onRun={() => runAttack(attack)}
          />
        ))}
      </div>
    </div>
  )
}
