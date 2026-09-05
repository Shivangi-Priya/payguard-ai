# PayGuard AI 🛡️

> **Intent-aware fraud detection for agentic commerce.**
>
> Traditional fraud detection asks: *"Does this transaction look suspicious?"*
> PayGuard AI asks: *"Is this transaction what the user actually intended?"*

---

## The Problem

When an AI agent makes a payment on behalf of a user, traditional fraud systems are blind to **intent-level manipulation**:

- The device is trusted ✓
- The merchant passed KYC ✓
- The amount is within user's limit ✓
- The transaction looks legitimate ✓

But the **product was silently switched**. A malicious product page injected a prompt. The agent bought ₹92,999 headphones instead of the ₹5,000 shoes the user asked for.

## The Solution: Four Detection Layers

```
USER INTENT → AGENT DECISION → FINAL BASKET → PAYMENT REQUEST
                                                    ↓
                                           ┌─────────────────┐
                                           │  PAYGUARD AI    │
                                           └─────────────────┘
                                                    ↓
              ┌─────────────────────┬──────────────────────┐
              ▼                     ▼                      ▼
       Intent Engine         Agent Identity         Merchant Risk
              │                     │                      │
              └─────────────────────┴──────────────────────┘
                                    ↓
                            Basket Analyzer
                                    ↓
                           Mandate Analyzer
                                    ↓
                             Risk Engine
                                    ↓
                        Explainable Decision
                                    ↓
              ┌─────────────────────┬─────────────────────┐
              ▼                     ▼                      ▼
           APPROVE              REVIEW                  BLOCK
```

- **Layer 1 – Intent Verification**: Extracts structured intent from user's natural language request and compares it to the final basket (category, brand, price, quantity, attributes)
- **Layer 2 – Basket Integrity**: Detects hidden add-ons, subscription injections, merchant switching, price manipulation, unusual shipping/tax
- **Layer 3 – Merchant Risk Engine**: Monitors agentic transaction velocity, refund rates, cancellation rates, and KYC status dynamically
- **Layer 4 – Agent Identity & Mandate**: Verifies Ed25519 cryptographic signatures, checks permission scopes, detects velocity attacks and mandate draining

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm 9+

### 1. Clone & setup

```bash
git clone <repo>
cd payguard-ai
cp .env.example backend/.env
```

### 2. Start the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

On first boot, the backend seeds the database automatically with:
- 3 demo users
- 5 AI agents (with real Ed25519 keypairs)
- 12 merchants (mix of healthy and high-risk)
- 25+ historical transactions (approved, review, and blocked)

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### 4. API docs

Interactive Swagger UI at **http://localhost:8000/docs**

---

## Demo: End-to-End Walkthrough

Navigate to **Attack Simulator** in the sidebar, then click **Run** on each attack:

| Attack | What happens | Expected result |
|--------|-------------|-----------------|
| Normal Transaction | Trusted agent, correct product, valid signature | Risk: 0–10 · **APPROVE** |
| Intent Manipulation | Agent adds ₹12,000 headphones instead of ₹5,000 shoes | Risk: 88 · **BLOCK** |
| Malicious Merchant | Merchant shows 4× txn spike, 28% refund rate | Risk: 72 · **HOLD** |
| Fake Agent | Unregistered agent with forged signature | Risk: 88 · **BLOCK** |
| Mandate Drain | 30 × ₹4,999 gift cards across 15 merchants in 8 min | Risk: 88 · **BLOCK** |

Click **Full analysis report** on any result to see the intent-to-decision chain.

---

## Architecture

### Backend (`/backend`)

```
app/
├── main.py              # FastAPI app + all endpoints
├── models.py            # SQLAlchemy models (12 tables)
├── database.py          # SQLite session setup
├── config.py            # Pydantic settings (env-driven weights)
├── crypto_utils.py      # Ed25519 keypair, signing, verification (SHA-256 hashing)
├── ai_layer.py          # Deterministic mock intent extraction (LLM-compatible)
├── intent_engine.py     # Layer 1: intent-to-basket comparison
├── basket_analyzer.py   # Layer 2: basket integrity checks
├── merchant_risk.py     # Layer 3: dynamic merchant risk scoring
├── mandate_analyzer.py  # Layer 4: agent identity + mandate velocity
├── risk_engine.py       # Configurable weighted scoring + hard-rule floor
├── explain.py           # Explainable fraud report builder
├── core_pipeline.py     # End-to-end transaction analysis pipeline
├── schemas.py           # Pydantic request/response models
└── seed.py              # Demo data seeder
```

### Frontend (`/frontend`)

```
src/
├── App.tsx              # Router
├── components/
│   ├── Sidebar.tsx      # Navigation
│   ├── RiskBadge.tsx    # Risk/status badges
│   ├── StatCard.tsx     # Metric cards
│   ├── IntentChain.tsx  # Signature intent→decision visual
│   └── Common.tsx       # Loading, error, page header
├── pages/
│   ├── Overview.tsx         # Dashboard home
│   ├── Transactions.tsx     # Live feed with filters
│   ├── TransactionDetail.tsx # Intent chain + full explainer
│   ├── Analytics.tsx        # Recharts fraud analytics
│   ├── Merchants.tsx        # Risk-ranked merchant table
│   ├── MerchantDetail.tsx   # Per-merchant analytics
│   ├── Agents.tsx           # Agent registry
│   ├── AgentDetail.tsx      # Agent management (revoke/suspend/rotate)
│   ├── Alerts.tsx           # Open + resolved security alerts
│   └── AttackSimulator.tsx  # 5-scenario attack demo
└── lib/
    ├── api.ts               # Type-safe API client
    ├── format.ts            # INR formatting, risk tier helpers
    └── useApiData.ts        # Generic polling data hook
```

---

## Risk Scoring

```
Overall Risk Score =
    30% × Intent Mismatch Risk
  + 20% × Basket Anomaly Risk
  + 20% × Merchant Risk
  + 15% × Agent Identity Risk
  + 15% × Mandate/Velocity Risk
```

Plus a hard-rule floor: if any single component exceeds 90, the overall score is floored at 88 (preventing a genuine critical signal from being diluted by otherwise-clean scores). This mirrors how production fraud engines combine statistical scoring with rule-based overrides.

| Score | Level | Action |
|-------|-------|--------|
| 0–30 | LOW RISK | Approve |
| 31–60 | MEDIUM RISK | Request verification |
| 61–80 | HIGH RISK | Hold transaction |
| 81–100 | CRITICAL RISK | Block + alert |

All weights are configurable via environment variables (see `.env.example`).

---

## Cryptography

PayGuard uses **Ed25519** (from Python's `cryptography` library) for agent identity:

- Each agent gets a public/private keypair at registration
- Every payment request is signed with the agent's private key over a canonical JSON payload: `{agent_id, transaction_id, intent_hash, basket_hash, timestamp, merchant_id, amount}`
- The backend verifies the signature before proceeding
- Intent and basket are hashed with **SHA-256** for tamper detection
- No custom cryptographic algorithms — only audited standard primitives

---

## API Reference

See **http://localhost:8000/docs** for full interactive documentation.

Key endpoints:

```
POST /agents/register          Register a new AI agent (generates Ed25519 keypair)
POST /agents/{id}/revoke       Permanently revoke an agent
POST /agents/{id}/suspend      Suspend an agent
POST /agents/{id}/rotate-key   Rotate signing key
POST /agents/{id}/limit        Update spending limit

POST /transactions/analyze     Analyze a transaction through all 4 layers
GET  /transactions             List all transactions (filterable by status)
GET  /transactions/{id}        Full transaction detail with explainer

GET  /merchants                All merchants ranked by risk
GET  /merchants/{id}           Merchant detail + analytics
POST /merchants/{id}/risk      Recompute merchant risk score

POST /attack-simulator/normal-transaction
POST /attack-simulator/intent-manipulation
POST /attack-simulator/malicious-merchant
POST /attack-simulator/fake-agent
POST /attack-simulator/mandate-drain

GET  /dashboard/overview       KPI summary stats
GET  /dashboard/analytics      Chart data (daily GMV, velocity, distributions)
GET  /alerts                   All fraud alerts
```

---

## Environment Variables

Copy `.env.example` to `backend/.env` and adjust as needed.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./payguard.db` | Database connection string |
| `ANTHROPIC_API_KEY` | _(empty)_ | Optional — if set, enables real LLM intent extraction |
| `USE_MOCK_AI` | `true` | `false` to use Claude API for intent extraction |
| `WEIGHT_INTENT` | `0.30` | Risk engine weight for intent mismatch |
| `WEIGHT_BASKET` | `0.20` | Risk engine weight for basket anomaly |
| `WEIGHT_MERCHANT` | `0.20` | Risk engine weight for merchant risk |
| `WEIGHT_AGENT` | `0.15` | Risk engine weight for agent identity risk |
| `WEIGHT_MANDATE` | `0.15` | Risk engine weight for mandate/velocity |
| `THRESHOLD_LOW` | `30` | Score below which transaction is approved |
| `THRESHOLD_MEDIUM` | `60` | Score below which transaction is reviewed |
| `THRESHOLD_HIGH` | `80` | Score below which transaction is held |

---

## Key Innovation

PayGuard AI introduces a new category of fraud detection: **intent-aware authorization**.

Every payment request is evaluated not just against transaction signals (amount, device, location) but against a structured representation of what the user actually asked for. The system maintains an **intent hash** (SHA-256 of the extracted structured intent) and a **basket hash** (SHA-256 of the final basket), and these hashes are included in the signed payment request — creating a cryptographically-verifiable audit trail from user intent to final payment.

This makes PayGuard AI fundamentally different from traditional fraud systems: it can detect attacks that look legitimate from a transaction perspective but violate the user's declared intent.

 
