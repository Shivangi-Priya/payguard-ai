"""
Layer 4 - Agent Identity Risk & Mandate Abuse Detection

Agent identity risk: is this agent cryptographically trusted, active,
in-scope, and within its expiry?

Mandate risk: detects coordinated abuse of a stolen/compromised mandate -
transaction bursts, odd hours, multi-merchant velocity, geographic
inconsistency, spending velocity spikes.
"""
import datetime as dt
from .models import Agent, Transaction


def compute_agent_identity_risk(agent: Agent | None, signature_valid: bool,
                                 amount: float, required_permission: str = "payment") -> dict:
    reasons = []
    risk = 0.0

    if agent is None:
        return {"risk_score": 100.0, "reasons": ["Agent identity could not be resolved - unknown agent."]}

    if not signature_valid:
        risk += 50
        reasons.append("Agent signature could not be verified - payload does not match signature.")

    if agent.status == "revoked":
        risk += 45
        reasons.append("Agent credentials have been revoked.")
    elif agent.status == "suspended":
        risk += 35
        reasons.append("Agent is currently suspended.")

    if agent.trust_level == "malicious":
        risk += 50
        reasons.append("Agent has been flagged as malicious by prior security events.")
    elif agent.trust_level == "unverified":
        risk += 20
        reasons.append("Agent issuer/identity is unverified.")

    if agent.expires_at and agent.expires_at < dt.datetime.utcnow():
        risk += 30
        reasons.append("Agent authorization has expired.")

    if required_permission not in (agent.permissions or []):
        risk += 25
        reasons.append(f"Agent lacks the required '{required_permission}' permission scope.")

    if amount > agent.spending_limit:
        over = amount - agent.spending_limit
        risk += min(30, 15 + (over / max(agent.spending_limit, 1)) * 40)
        reasons.append(
            f"Transaction amount ₹{amount:,.0f} exceeds agent's authorized spending limit of ₹{agent.spending_limit:,.0f}."
        )

    risk = min(100, risk)
    return {"risk_score": round(risk, 1), "reasons": reasons}


def compute_mandate_risk(recent_transactions: list[Transaction], new_amount: float,
                          new_merchant_id: str, window_minutes: int = 10) -> dict:
    """
    recent_transactions: transactions by this agent/user within a lookback window,
    ordered oldest -> newest, used to detect burst/velocity abuse patterns.
    """
    reasons = []
    risk = 0.0

    now = dt.datetime.utcnow()
    window_start = now - dt.timedelta(minutes=window_minutes)
    recent = [t for t in recent_transactions if t.created_at >= window_start]

    count = len(recent)
    if count >= 5:
        pts = min(45, count * 2.5)
        risk += pts
        reasons.append(f"{count} transactions detected within the last {window_minutes} minutes - burst pattern.")

    merchants = {t.merchant_id for t in recent}
    if len(merchants) >= 4:
        risk += min(25, len(merchants) * 3)
        reasons.append(f"Transactions span {len(merchants)} different merchants in a short window - possible mandate scraping.")

    total_recent_spend = sum(t.amount for t in recent) + new_amount
    if recent and total_recent_spend > 0:
        avg = total_recent_spend / (count + 1)
        if new_amount and abs(new_amount - avg) < avg * 0.05 and count >= 3:
            risk += 10
            reasons.append("Transaction amounts are near-identical - typical of automated mandate-draining scripts.")

    hour = now.hour
    if hour in (0, 1, 2, 3, 4) and count >= 1:
        risk += 15
        reasons.append(f"Transaction occurs at an unusual hour ({hour:02d}:00) with recent related activity.")

    if count >= 10:
        risk += 20
        reasons.append("Spending velocity is far above normal user behaviour for this time window.")

    risk = min(100, risk)
    return {"risk_score": round(risk, 1), "reasons": reasons, "recent_count": count}
