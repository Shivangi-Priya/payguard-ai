const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }
  return res.json()
}

export const api = {
  get: <T,>(path: string) => req<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    req<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
}

// -------------------- Types --------------------

export interface Overview {
  total_agentic_transactions: number
  transactions_blocked: number
  transactions_high_risk: number
  transactions_review: number
  transactions_approved: number
  fraud_prevented_amount: number
  average_risk_score: number
  high_risk_merchants: number
  active_ai_agents: number
  total_merchants: number
  total_agents: number
}

export type TxnStatus = 'APPROVED' | 'REVIEW' | 'HIGH_RISK' | 'BLOCKED' | 'PENDING'

export interface TransactionSummary {
  id: string
  user: string
  user_id: string
  agent: string
  agent_id: string | null
  merchant: string
  merchant_id: string
  amount: number
  currency: string
  intent_match_score: number | null
  risk_score: number | null
  status: TxnStatus
  attack_type: string | null
  timestamp: string
}

export interface TransactionItem {
  product_name: string
  category: string | null
  brand: string | null
  quantity: number
  unit_price: number
  refundable: boolean
  is_addon: boolean
  attributes: Record<string, unknown>
}

export interface UserIntent {
  raw_text: string
  category: string | null
  brand: string | null
  max_price: number | null
  quantity: number
  attributes: Record<string, unknown>
  refundable_required: boolean
}

export interface Explanation {
  risk_score: number
  risk_level: string
  decision: string
  summary: string
  reasons: string[]
  component_scores: {
    intent_match_score: number
    basket_integrity_score: number
    merchant_risk_score: number
    agent_identity_risk: number
    mandate_risk_score: number
  }
  weighted_components: {
    intent_risk: number
    basket_risk: number
    merchant_risk: number
    agent_risk: number
    mandate_risk: number
  }
  weights: Record<string, number>
  prevented_loss: number | null
  basket_total: number
  declared_max_price: number | null
  recommendation: string
}

export interface TransactionDetail extends TransactionSummary {
  intent_hash: string
  basket_hash: string
  signature: string | null
  signature_valid: boolean | null
  basket_integrity_score: number | null
  merchant_risk_score: number | null
  agent_identity_risk: number | null
  mandate_risk_score: number | null
  explanation: Explanation
  items: TransactionItem[]
  user_intent: UserIntent | null
}

export interface Merchant {
  merchant_id: string
  name: string
  category: string
  agent_transactions: number
  gmv: number
  refund_rate: number
  cancellation_rate: number
  risk_score: number
  trust_score: number
  velocity: number
  status: string
  kyc_verified: boolean
}

export interface MerchantDetail {
  merchant_id: string
  name: string
  category: string
  kyc_verified: boolean
  trust_score: number
  risk_score: number
  status: string
  agentic_txn_count: number
  gmv: number
  refund_rate: number
  cancellation_rate: number
  recent_transactions: TransactionSummary[]
  events: { type: string; detail: string; timestamp: string }[]
}

export interface Agent {
  agent_id: string
  name: string
  issuer: string
  user_id: string
  user_name: string
  public_key_fingerprint: string | null
  permissions: string[]
  spending_limit: number
  currency: string
  transactions: number
  risk_score: number
  status: string
  trust_level: string
  expires_at: string
}

export interface AgentDetail {
  agent_id: string
  name: string
  issuer: string
  user_id: string
  public_key: string | null
  public_key_fingerprint: string | null
  permissions: string[]
  spending_limit: number
  currency: string
  risk_score: number
  status: string
  trust_level: string
  expires_at: string
  events: { type: string; detail: string; timestamp: string }[]
  recent_transactions: TransactionSummary[]
}

export interface Alert {
  id: string
  transaction_id: string | null
  agent_id: string | null
  merchant_id: string | null
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  description: string
  alert_type: string
  status: string
  timestamp: string
}

export interface Analytics {
  daily: { date: string; gmv: number; fraud_attempts: number; blocked: number; count: number }[]
  risk_distribution: { name: string; value: number }[]
  status_distribution: { name: string; value: number }[]
  merchant_risk: { merchant: string; risk_score: number; gmv: number }[]
  intent_mismatch: { transaction: string; intent_match: number; risk: number }[]
  velocity: { bucket: string; transactions: number }[]
}

export const endpoints = {
  overview: () => api.get<Overview>('/dashboard/overview'),
  analytics: () => api.get<Analytics>('/dashboard/analytics'),
  transactions: (status?: string) =>
    api.get<TransactionSummary[]>(`/transactions${status ? `?status=${status}` : ''}`),
  transaction: (id: string) => api.get<TransactionDetail>(`/transactions/${id}`),
  merchants: () => api.get<Merchant[]>('/merchants'),
  merchant: (id: string) => api.get<MerchantDetail>(`/merchants/${id}`),
  agents: () => api.get<Agent[]>('/agents'),
  agent: (id: string) => api.get<AgentDetail>(`/agents/${id}`),
  alerts: () => api.get<Alert[]>('/alerts'),
  revokeAgent: (id: string) => api.post(`/agents/${id}/revoke`),
  suspendAgent: (id: string) => api.post(`/agents/${id}/suspend`),
  reactivateAgent: (id: string) => api.post(`/agents/${id}/reactivate`),
  rotateKey: (id: string) => api.post(`/agents/${id}/rotate-key`),
  changeLimit: (id: string, spending_limit: number) =>
    api.post(`/agents/${id}/limit`, { spending_limit }),
simIntentManipulation: () =>
  api.post<TransactionDetail>('/attack-simulator/intent-manipulation', {}),

simMaliciousMerchant: () =>
  api.post<TransactionDetail>('/attack-simulator/malicious-merchant', {}),

simFakeAgent: () =>
  api.post<TransactionDetail>('/attack-simulator/fake-agent', {}),

simMandateDrain: () =>
  api.post<TransactionDetail>('/attack-simulator/mandate-drain', {}),

simNormal: () =>
  api.post<TransactionDetail>('/attack-simulator/normal-transaction', {}),
}
