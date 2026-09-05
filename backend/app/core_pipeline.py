"""
Core Transaction Analysis Pipeline

Wires together: Intent Engine -> Basket Analyzer -> Merchant Risk ->
Agent Identity / Mandate Analyzer -> Risk Engine -> Explainable Decision ->
persistence (Transaction, TransactionItem, RiskScore, FraudAlert rows).
"""
import datetime as dt
from sqlalchemy.orm import Session

from . import models, crypto_utils
from .ai_layer import extract_intent
from .intent_engine import analyze_intent
from .basket_analyzer import analyze_basket
from .merchant_risk import compute_merchant_risk
from .mandate_analyzer import compute_agent_identity_risk, compute_mandate_risk
from .risk_engine import compute_overall_risk, STATUS_MAP
from .explain import build_explanation


def run_transaction_pipeline(
    db: Session,
    user: models.User,
    agent: models.Agent | None,
    merchant: models.Merchant,
    raw_intent_text: str,
    basket_items_in: list[dict],
    declared_merchant_id: str | None = None,
    shipping: float = 0.0,
    taxes: float = 0.0,
    discount: float = 0.0,
    tamper_signature: bool = False,
    attack_type: str | None = None,
    force_agent_none: bool = False,
) -> models.Transaction:
    # 1. Intent extraction (mock/real AI layer)
    intent_struct = extract_intent(raw_intent_text)

    # persist UserIntent
    user_intent = models.UserIntent(
        user_id=user.id,
        raw_text=raw_intent_text,
        category=intent_struct.get("category"),
        brand=intent_struct.get("brand"),
        max_price=intent_struct.get("max_price"),
        quantity=intent_struct.get("quantity", 1),
        attributes=intent_struct.get("attributes", {}),
        refundable_required=intent_struct.get("refundable_required", False),
    )
    intent_hash = crypto_utils.hash_object(intent_struct)
    user_intent.intent_hash = intent_hash
    db.add(user_intent)
    db.flush()

    # 2. Basket hash
    basket_hash = crypto_utils.hash_object({"items": basket_items_in, "merchant": merchant.id})

    # 3. Build signed payload + verify signature
    amount = sum(i["unit_price"] * i.get("quantity", 1) for i in basket_items_in) + shipping + taxes - discount
    txn_id = models.gen_id("txn")
    timestamp = dt.datetime.utcnow().isoformat()

    payload = {
        "agent_id": agent.id if agent else "unknown",
        "transaction_id": txn_id,
        "intent_hash": intent_hash,
        "basket_hash": basket_hash,
        "timestamp": timestamp,
        "merchant_id": merchant.id,
        "amount": round(amount, 2),
    }

    signature_valid = False
    signature = None
    if agent and not force_agent_none:
        key_row = next((k for k in agent.keys if k.active), None)
        if key_row:
            signature = crypto_utils.sign_payload(key_row.private_key_pem, payload)
            if tamper_signature:
                # simulate a forged/corrupted signature (e.g. malicious agent replay attempt)
                signature = signature[:-4] + "AAAA"
            signature_valid = crypto_utils.verify_signature(key_row.public_key_pem, payload, signature)
        else:
            signature = None
            signature_valid = False
    else:
        signature = None
        signature_valid = False

    # 4. Layer 1 - Intent verification
    intent_result = analyze_intent(intent_struct, basket_items_in)

    # 5. Layer 2 - Basket integrity
    basket_result = analyze_basket(
        basket_items_in, declared_merchant_id, merchant.id, shipping, taxes, discount,
        declared_max_price=intent_struct.get("max_price"),
    )

    # 6. Layer 3 - Merchant risk
    merchant_result = compute_merchant_risk(merchant)
    merchant.risk_score = merchant_result["risk_score"]
    merchant.trust_score = merchant_result["trust_score"]

    # 7. Layer 4a - Agent identity risk
    agent_result = compute_agent_identity_risk(
        None if force_agent_none else agent, signature_valid, amount
    )

    # 8. Layer 4b - Mandate / velocity risk
    lookback = dt.datetime.utcnow() - dt.timedelta(minutes=30)
    recent_txns = []
    if agent:
        recent_txns = (
            db.query(models.Transaction)
            .filter(models.Transaction.agent_id == agent.id)
            .filter(models.Transaction.created_at >= lookback)
            .order_by(models.Transaction.created_at.asc())
            .all()
        )
    mandate_result = compute_mandate_risk(recent_txns, amount, merchant.id)

    # 9. Unified risk engine
    risk_result = compute_overall_risk(
        intent_score=intent_result["score"],
        basket_score=basket_result["score"],
        merchant_risk=merchant_result["risk_score"],
        agent_risk=agent_result["risk_score"],
        mandate_risk=mandate_result["risk_score"],
    )

    # 10. Explainable report
    explanation = build_explanation(
        intent_result, basket_result, merchant_result, agent_result, mandate_result,
        risk_result, basket_total=amount, intent_max_price=intent_struct.get("max_price"),
        merchant_name=merchant.name,
    )

    status = STATUS_MAP[risk_result["decision"]]

    # 11. Persist transaction
    txn = models.Transaction(
        id=txn_id,
        user_id=user.id,
        agent_id=agent.id if agent else None,
        merchant_id=merchant.id,
        intent_id=user_intent.id,
        amount=round(amount, 2),
        currency="INR",
        intent_hash=intent_hash,
        basket_hash=basket_hash,
        signature=signature,
        signature_valid=signature_valid,
        intent_match_score=intent_result["score"],
        basket_integrity_score=basket_result["score"],
        merchant_risk_score=merchant_result["risk_score"],
        agent_identity_risk=agent_result["risk_score"],
        mandate_risk_score=mandate_result["risk_score"],
        overall_risk_score=risk_result["overall_risk"],
        status=status,
        attack_type=attack_type,
        explanation=explanation,
        created_at=dt.datetime.utcnow(),
    )
    db.add(txn)
    db.flush()

    for item in basket_items_in:
        db.add(models.TransactionItem(
            transaction_id=txn.id,
            product_name=item["product_name"],
            category=item.get("category"),
            brand=item.get("brand"),
            quantity=item.get("quantity", 1),
            unit_price=item["unit_price"],
            refundable=item.get("refundable", True),
            is_addon=item.get("is_addon", False),
            attributes=item.get("attributes", {}),
        ))

    db.add(models.RiskScore(
        transaction_id=txn.id,
        intent_risk=risk_result["components"]["intent_risk"],
        basket_risk=risk_result["components"]["basket_risk"],
        merchant_risk=risk_result["components"]["merchant_risk"],
        agent_risk=risk_result["components"]["agent_risk"],
        mandate_risk=risk_result["components"]["mandate_risk"],
        overall_risk=risk_result["overall_risk"],
        weights_used=risk_result["weights"],
        decision=risk_result["decision"],
        reasons=explanation["reasons"],
    ))

    # merchant event bookkeeping
    merchant.agentic_txn_count = (merchant.agentic_txn_count or 0) + 1
    merchant.gmv = (merchant.gmv or 0) + amount
    db.add(models.MerchantEvent(
        merchant_id=merchant.id,
        event_type="agentic_txn",
        detail=f"Transaction {txn.id} ({status}) amount ₹{amount:,.0f}",
    ))

    if status in ("HIGH_RISK", "BLOCKED"):
        severity = "CRITICAL" if status == "BLOCKED" else "HIGH"
        db.add(models.FraudAlert(
            transaction_id=txn.id,
            agent_id=agent.id if agent else None,
            merchant_id=merchant.id,
            severity=severity,
            title=f"{explanation['risk_level']} transaction {'blocked' if status == 'BLOCKED' else 'held'}",
            description=explanation["summary"] + " Top reasons: " + "; ".join(explanation["reasons"][:3]),
            alert_type=attack_type or "risk_engine",
        ))

    if agent:
        agent.risk_score = agent_result["risk_score"]

    db.commit()
    db.refresh(txn)
    return txn
