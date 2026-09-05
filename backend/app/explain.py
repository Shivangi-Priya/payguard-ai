"""
Explainable AI - builds a structured, human-readable fraud report for every
analyzed transaction (never a bare "rejected").
"""
from .ai_layer import generate_natural_language_summary


def build_explanation(intent_result: dict, basket_result: dict, merchant_result: dict,
                       agent_result: dict, mandate_result: dict, risk_result: dict,
                       basket_total: float, intent_max_price: float | None,
                       merchant_name: str) -> dict:
    all_reasons = []
    all_reasons += [f"[Intent] {r}" for r in intent_result.get("reasons", [])]
    all_reasons += [f"[Basket] {r}" for r in basket_result.get("reasons", [])]
    all_reasons += [f"[Merchant: {merchant_name}] {r}" for r in merchant_result.get("reasons", [])]
    all_reasons += [f"[Agent] {r}" for r in agent_result.get("reasons", [])]
    all_reasons += [f"[Mandate] {r}" for r in mandate_result.get("reasons", [])]

    prevented_loss = None
    if intent_max_price is not None and basket_total > intent_max_price:
        prevented_loss = basket_total - intent_max_price

    summary = generate_natural_language_summary(all_reasons, risk_result["decision"], risk_result["overall_risk"])

    return {
        "risk_score": risk_result["overall_risk"],
        "risk_level": risk_result["level"],
        "decision": risk_result["decision"],
        "summary": summary,
        "reasons": all_reasons,
        "component_scores": {
            "intent_match_score": intent_result.get("score"),
            "basket_integrity_score": basket_result.get("score"),
            "merchant_risk_score": merchant_result.get("risk_score"),
            "agent_identity_risk": agent_result.get("risk_score"),
            "mandate_risk_score": mandate_result.get("risk_score"),
        },
        "weighted_components": risk_result["components"],
        "weights": risk_result["weights"],
        "prevented_loss": prevented_loss,
        "basket_total": basket_total,
        "declared_max_price": intent_max_price,
        "recommendation": {
            "APPROVE": "APPROVE TRANSACTION",
            "REVIEW": "REQUEST ADDITIONAL VERIFICATION",
            "HOLD": "TEMPORARILY HOLD TRANSACTION",
            "BLOCK": "BLOCK TRANSACTION AND GENERATE SECURITY ALERT",
        }[risk_result["decision"]],
    }
