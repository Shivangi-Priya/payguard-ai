"""
Layer 3 - Merchant Behaviour Monitoring / Risk Engine

Produces a dynamic Merchant Trust Score (0-100) and Merchant Risk Score,
recomputed as new transactions/events arrive.
"""
from .models import Merchant


def compute_merchant_risk(merchant: Merchant) -> dict:
    reasons = []
    risk = 0.0

    # Sudden increase in agentic transaction volume
    prev = merchant.agentic_txn_count_prev_period or 0
    curr = merchant.agentic_txn_count or 0
    if prev > 0 and curr > prev * 2:
        growth = curr / prev
        pts = min(30, 10 * growth)
        risk += pts
        reasons.append(f"Merchant shows a {growth:.1f}x increase in agentic transactions vs. prior period.")
    elif prev == 0 and curr > 20:
        risk += 15
        reasons.append("Merchant has a sudden burst of agentic transactions with no prior baseline.")

    if merchant.refund_rate and merchant.refund_rate > 0.15:
        risk += min(20, merchant.refund_rate * 60)
        reasons.append(f"Unusually high refund rate ({merchant.refund_rate * 100:.0f}%).")

    if merchant.cancellation_rate and merchant.cancellation_rate > 0.10:
        risk += min(15, merchant.cancellation_rate * 60)
        reasons.append(f"High cancellation rate ({merchant.cancellation_rate * 100:.0f}%).")

    if not merchant.kyc_verified:
        risk += 25
        reasons.append("Merchant KYC is not verified.")

    if merchant.status == "flagged":
        risk += 20
        reasons.append("Merchant has been previously flagged for suspicious behaviour.")
    elif merchant.status == "suspended":
        risk += 40
        reasons.append("Merchant is currently suspended.")

    risk = min(100, risk)
    trust = max(0, 100 - risk)
    return {"risk_score": round(risk, 1), "trust_score": round(trust, 1), "reasons": reasons}


def apply_merchant_event(merchant: Merchant, event_type: str):
    """Mutates merchant fields in response to a new event (used by simulator / live feed)."""
    if event_type == "agentic_txn":
        merchant.agentic_txn_count += 1
    elif event_type == "price_manipulation":
        merchant.status = "flagged"
        merchant.agentic_txn_count += 5
    elif event_type == "refund_spike":
        merchant.refund_rate = min(1.0, merchant.refund_rate + 0.1)
    result = compute_merchant_risk(merchant)
    merchant.risk_score = result["risk_score"]
    merchant.trust_score = result["trust_score"]
    return result
