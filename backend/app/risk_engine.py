"""
Unified Fraud Scoring Engine

Overall Risk Score =
    W_intent   * IntentMismatchRisk
  + W_basket   * BasketAnomalyRisk
  + W_merchant * MerchantRisk
  + W_agent    * AgentIdentityRisk
  + W_mandate  * MandateVelocityRisk

Weights are configurable via app.config.settings (env-driven).
"""
from .config import settings


def compute_overall_risk(intent_score: float, basket_score: float, merchant_risk: float,
                          agent_risk: float, mandate_risk: float) -> dict:
    """
    intent_score / basket_score are *match/integrity* scores (0-100, higher = better),
    so we convert them to risk (100 - score) before weighting.
    merchant_risk / agent_risk / mandate_risk are already risk scores (higher = worse).
    """
    intent_risk = 100 - intent_score
    basket_risk = 100 - basket_score

    weights = {
        "intent": settings.WEIGHT_INTENT,
        "basket": settings.WEIGHT_BASKET,
        "merchant": settings.WEIGHT_MERCHANT,
        "agent": settings.WEIGHT_AGENT,
        "mandate": settings.WEIGHT_MANDATE,
    }

    weighted_overall = (
        weights["intent"] * intent_risk
        + weights["basket"] * basket_risk
        + weights["merchant"] * merchant_risk
        + weights["agent"] * agent_risk
        + weights["mandate"] * mandate_risk
    )

    # Hard-rule floor: a single severe signal (e.g. an unverifiable agent
    # signature, or a basket that blows a hard user budget by a wide margin)
    # should not be diluted away by an otherwise-clean weighted average.
    # This mirrors production fraud engines, which combine a weighted score
    # for nuance with rule-based floors for hard constraint violations.
    max_component = max(intent_risk, basket_risk, merchant_risk, agent_risk, mandate_risk)
    if max_component >= 90:
        floor = 88
    elif max_component >= 75:
        floor = 72
    elif max_component >= 60:
        floor = 55
    else:
        floor = 0

    overall = round(min(100, max(0, max(weighted_overall, floor))), 1)

    decision, level = classify_risk(overall)

    return {
        "overall_risk": overall,
        "decision": decision,
        "level": level,
        "components": {
            "intent_risk": round(intent_risk, 1),
            "basket_risk": round(basket_risk, 1),
            "merchant_risk": round(merchant_risk, 1),
            "agent_risk": round(agent_risk, 1),
            "mandate_risk": round(mandate_risk, 1),
        },
        "weights": weights,
    }


def classify_risk(score: float) -> tuple[str, str]:
    """Returns (decision, level_label)."""
    if score <= settings.THRESHOLD_LOW:
        return "APPROVE", "LOW RISK"
    if score <= settings.THRESHOLD_MEDIUM:
        return "REVIEW", "MEDIUM RISK"
    if score <= settings.THRESHOLD_HIGH:
        return "HOLD", "HIGH RISK"
    return "BLOCK", "CRITICAL RISK"


STATUS_MAP = {
    "APPROVE": "APPROVED",
    "REVIEW": "REVIEW",
    "HOLD": "HIGH_RISK",
    "BLOCK": "BLOCKED",
}
