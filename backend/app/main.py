import datetime as dt
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func

from . import models, schemas, crypto_utils
from .database import Base, engine, SessionLocal, get_db
from .config import settings
from .core_pipeline import run_transaction_pipeline
from .intent_engine import analyze_intent
from .basket_analyzer import analyze_basket
from .merchant_risk import compute_merchant_risk, apply_merchant_event
from .mandate_analyzer import compute_agent_identity_risk, compute_mandate_risk
from .ai_layer import extract_intent

Base.metadata.create_all(bind=engine)

app = FastAPI(title="PayGuard AI", description="Intent-aware fraud detection for agentic commerce",
              version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_seed():
    from . import seed
    db = SessionLocal()
    try:
        if db.query(models.User).count() == 0:
            seed.run_seed(db)
    finally:
        db.close()


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------

def _txn_to_summary(t: models.Transaction) -> dict:
    return {
        "id": t.id,
        "user": t.user.name if t.user else None,
        "user_id": t.user_id,
        "agent": t.agent.name if t.agent else "Unknown Agent",
        "agent_id": t.agent_id,
        "merchant": t.merchant.name if t.merchant else None,
        "merchant_id": t.merchant_id,
        "amount": t.amount,
        "currency": t.currency,
        "intent_match_score": t.intent_match_score,
        "risk_score": t.overall_risk_score,
        "status": t.status,
        "attack_type": t.attack_type,
        "timestamp": t.created_at.isoformat() if t.created_at else None,
    }


def _txn_to_detail(t: models.Transaction, db: Session | None = None) -> dict:
    user_intent = None
    if t.intent_id:
        session = db or SessionLocal()
        try:
            ui = session.query(models.UserIntent).get(t.intent_id)
            if ui:
                user_intent = {
                    "raw_text": ui.raw_text, "category": ui.category, "brand": ui.brand,
                    "max_price": ui.max_price, "quantity": ui.quantity, "attributes": ui.attributes,
                    "refundable_required": ui.refundable_required,
                }
        finally:
            if not db:
                session.close()
    return {
        **_txn_to_summary(t),
        "intent_hash": t.intent_hash,
        "basket_hash": t.basket_hash,
        "signature": t.signature,
        "signature_valid": t.signature_valid,
        "basket_integrity_score": t.basket_integrity_score,
        "merchant_risk_score": t.merchant_risk_score,
        "agent_identity_risk": t.agent_identity_risk,
        "mandate_risk_score": t.mandate_risk_score,
        "explanation": t.explanation,
        "items": [
            {
                "product_name": i.product_name, "category": i.category, "brand": i.brand,
                "quantity": i.quantity, "unit_price": i.unit_price, "refundable": i.refundable,
                "is_addon": i.is_addon, "attributes": i.attributes,
            } for i in t.items
        ],
        "user_intent": user_intent,
    }


def _get_agent_or_404(db: Session, agent_id: str) -> models.Agent:
    agent = db.query(models.Agent).get(agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return agent


def _get_merchant_or_404(db: Session, merchant_id: str) -> models.Merchant:
    m = db.query(models.Merchant).get(merchant_id)
    if not m:
        raise HTTPException(404, "Merchant not found")
    return m


def _get_user_or_404(db: Session, user_id: str) -> models.User:
    u = db.query(models.User).get(user_id)
    if not u:
        raise HTTPException(404, "User not found")
    return u


# ----------------------------------------------------------------------
# Agents
# ----------------------------------------------------------------------

@app.post("/agents/register")
def register_agent(req: schemas.AgentRegisterRequest, db: Session = Depends(get_db)):
    user = _get_user_or_404(db, req.user_id)
    agent = models.Agent(
        name=req.name, issuer=req.issuer, user_id=user.id, permissions=req.permissions,
        spending_limit=req.spending_limit, currency=req.currency, trust_level=req.trust_level,
    )
    db.add(agent)
    db.flush()

    public_pem, private_pem = crypto_utils.generate_keypair()
    key = models.AgentKey(agent_id=agent.id, public_key_pem=public_pem, private_key_pem=private_pem)
    db.add(key)
    db.add(models.AgentEvent(agent_id=agent.id, event_type="registered", detail=f"Registered by issuer {req.issuer}"))
    db.commit()
    db.refresh(agent)
    return {
        "agent_id": agent.id, "issuer": agent.issuer, "user_id": agent.user_id,
        "permissions": agent.permissions, "spending_limit": agent.spending_limit,
        "currency": agent.currency, "status": agent.status,
        "public_key": public_pem, "expires_at": agent.expires_at.isoformat(),
        "key_fingerprint": crypto_utils.fingerprint_public_key(public_pem),
    }


@app.post("/agents/{agent_id}/revoke")
def revoke_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = _get_agent_or_404(db, agent_id)
    agent.status = "revoked"
    db.add(models.AgentEvent(agent_id=agent.id, event_type="revoked", detail="Revoked via dashboard"))
    db.commit()
    return {"agent_id": agent.id, "status": agent.status}


@app.post("/agents/{agent_id}/suspend")
def suspend_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = _get_agent_or_404(db, agent_id)
    agent.status = "suspended"
    db.add(models.AgentEvent(agent_id=agent.id, event_type="suspended", detail="Suspended via dashboard"))
    db.commit()
    return {"agent_id": agent.id, "status": agent.status}


@app.post("/agents/{agent_id}/reactivate")
def reactivate_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = _get_agent_or_404(db, agent_id)
    agent.status = "active"
    db.add(models.AgentEvent(agent_id=agent.id, event_type="reactivated", detail="Reactivated via dashboard"))
    db.commit()
    return {"agent_id": agent.id, "status": agent.status}


@app.post("/agents/{agent_id}/rotate-key")
def rotate_key(agent_id: str, db: Session = Depends(get_db)):
    agent = _get_agent_or_404(db, agent_id)
    for k in agent.keys:
        k.active = False
        k.rotated_at = dt.datetime.utcnow()
    public_pem, private_pem = crypto_utils.generate_keypair()
    key = models.AgentKey(agent_id=agent.id, public_key_pem=public_pem, private_key_pem=private_pem)
    db.add(key)
    db.add(models.AgentEvent(agent_id=agent.id, event_type="key_rotated", detail="Key rotated via dashboard"))
    db.commit()
    return {"agent_id": agent.id, "new_public_key": public_pem,
            "key_fingerprint": crypto_utils.fingerprint_public_key(public_pem)}


@app.post("/agents/{agent_id}/limit")
def change_limit(agent_id: str, req: schemas.AgentLimitChangeRequest, db: Session = Depends(get_db)):
    agent = _get_agent_or_404(db, agent_id)
    old = agent.spending_limit
    agent.spending_limit = req.spending_limit
    db.add(models.AgentEvent(agent_id=agent.id, event_type="limit_changed",
                              detail=f"Limit changed from ₹{old:,.0f} to ₹{req.spending_limit:,.0f}"))
    db.commit()
    return {"agent_id": agent.id, "spending_limit": agent.spending_limit}


@app.get("/agents")
def list_agents(db: Session = Depends(get_db)):
    agents = db.query(models.Agent).all()
    out = []
    for a in agents:
        key = next((k for k in a.keys if k.active), None)
        txn_count = db.query(models.Transaction).filter(models.Transaction.agent_id == a.id).count()
        out.append({
            "agent_id": a.id, "name": a.name, "issuer": a.issuer, "user_id": a.user_id,
            "user_name": a.user.name if a.user else None,
            "public_key_fingerprint": crypto_utils.fingerprint_public_key(key.public_key_pem) if key else None,
            "permissions": a.permissions, "spending_limit": a.spending_limit, "currency": a.currency,
            "transactions": txn_count, "risk_score": a.risk_score, "status": a.status,
            "trust_level": a.trust_level, "expires_at": a.expires_at.isoformat() if a.expires_at else None,
        })
    return out


@app.get("/agents/{agent_id}")
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    a = _get_agent_or_404(db, agent_id)
    key = next((k for k in a.keys if k.active), None)
    events = db.query(models.AgentEvent).filter(models.AgentEvent.agent_id == a.id).order_by(models.AgentEvent.created_at.desc()).all()
    txns = db.query(models.Transaction).filter(models.Transaction.agent_id == a.id).order_by(models.Transaction.created_at.desc()).limit(20).all()
    return {
        "agent_id": a.id, "name": a.name, "issuer": a.issuer, "user_id": a.user_id,
        "public_key": key.public_key_pem if key else None,
        "public_key_fingerprint": crypto_utils.fingerprint_public_key(key.public_key_pem) if key else None,
        "permissions": a.permissions, "spending_limit": a.spending_limit, "currency": a.currency,
        "risk_score": a.risk_score, "status": a.status, "trust_level": a.trust_level,
        "expires_at": a.expires_at.isoformat() if a.expires_at else None,
        "events": [{"type": e.event_type, "detail": e.detail, "timestamp": e.created_at.isoformat()} for e in events],
        "recent_transactions": [_txn_to_summary(t) for t in txns],
    }


# ----------------------------------------------------------------------
# Transactions
# ----------------------------------------------------------------------

@app.post("/transactions/analyze")
def analyze_transaction(req: schemas.TransactionAnalyzeRequest, db: Session = Depends(get_db)):
    user = _get_user_or_404(db, req.user_id)
    agent = db.query(models.Agent).get(req.agent_id)
    merchant = _get_merchant_or_404(db, req.merchant_id)

    txn = run_transaction_pipeline(
        db, user, agent, merchant,
        raw_intent_text=req.raw_intent_text,
        basket_items_in=[i.model_dump() for i in req.basket_items],
        declared_merchant_id=req.declared_merchant_id,
        shipping=req.shipping, taxes=req.taxes, discount=req.discount,
        tamper_signature=req.tamper_signature,
        attack_type=req.attack_type,
        force_agent_none=agent is None,
    )
    return _txn_to_detail(txn, db)


@app.post("/transactions/verify-signature")
def verify_signature_endpoint(req: schemas.SignatureVerifyRequest, db: Session = Depends(get_db)):
    agent = _get_agent_or_404(db, req.agent_id)
    key = next((k for k in agent.keys if k.active), None)
    if not key:
        return {"valid": False, "reason": "No active key for agent"}
    valid = crypto_utils.verify_signature(key.public_key_pem, req.payload, req.signature)
    return {"valid": valid}


@app.get("/transactions")
def list_transactions(status: str | None = None, limit: int = 50, db: Session = Depends(get_db)):
    q = db.query(models.Transaction).order_by(models.Transaction.created_at.desc())
    if status:
        q = q.filter(models.Transaction.status == status)
    txns = q.limit(limit).all()
    return [_txn_to_summary(t) for t in txns]


@app.get("/transactions/{txn_id}")
def get_transaction(txn_id: str, db: Session = Depends(get_db)):
    t = db.query(models.Transaction).get(txn_id)
    if not t:
        raise HTTPException(404, "Transaction not found")
    return _txn_to_detail(t, db)


# ----------------------------------------------------------------------
# Intent / Basket standalone analysis endpoints
# ----------------------------------------------------------------------

@app.post("/intent/analyze")
def intent_analyze(req: schemas.IntentAnalyzeRequest):
    intent_struct = extract_intent(req.raw_text)
    result = analyze_intent(intent_struct, [i.model_dump() for i in req.basket_items])
    return {"extracted_intent": intent_struct, **result}


@app.post("/basket/analyze")
def basket_analyze(req: schemas.BasketAnalyzeRequest):
    result = analyze_basket(
        [i.model_dump() for i in req.basket_items], req.declared_merchant_id, req.actual_merchant_id,
        req.shipping, req.taxes, req.discount,
    )
    return result


# ----------------------------------------------------------------------
# Merchants
# ----------------------------------------------------------------------

@app.get("/merchants")
def list_merchants(db: Session = Depends(get_db)):
    merchants = db.query(models.Merchant).order_by(models.Merchant.risk_score.desc()).all()
    out = []
    for m in merchants:
        out.append({
            "merchant_id": m.id, "name": m.name, "category": m.category,
            "agent_transactions": m.agentic_txn_count, "gmv": m.gmv,
            "refund_rate": m.refund_rate, "cancellation_rate": m.cancellation_rate,
            "risk_score": m.risk_score, "trust_score": m.trust_score,
            "velocity": m.agentic_txn_count, "status": m.status, "kyc_verified": m.kyc_verified,
        })
    return out


@app.get("/merchants/{merchant_id}")
def get_merchant(merchant_id: str, db: Session = Depends(get_db)):
    m = _get_merchant_or_404(db, merchant_id)
    txns = db.query(models.Transaction).filter(models.Transaction.merchant_id == m.id).order_by(models.Transaction.created_at.desc()).limit(30).all()
    events = db.query(models.MerchantEvent).filter(models.MerchantEvent.merchant_id == m.id).order_by(models.MerchantEvent.created_at.desc()).limit(20).all()
    return {
        "merchant_id": m.id, "name": m.name, "category": m.category, "kyc_verified": m.kyc_verified,
        "trust_score": m.trust_score, "risk_score": m.risk_score, "status": m.status,
        "agentic_txn_count": m.agentic_txn_count, "gmv": m.gmv, "refund_rate": m.refund_rate,
        "cancellation_rate": m.cancellation_rate,
        "recent_transactions": [_txn_to_summary(t) for t in txns],
        "events": [{"type": e.event_type, "detail": e.detail, "timestamp": e.created_at.isoformat()} for e in events],
    }


@app.post("/merchants/{merchant_id}/risk")
def recompute_merchant_risk(merchant_id: str, db: Session = Depends(get_db)):
    m = _get_merchant_or_404(db, merchant_id)
    result = compute_merchant_risk(m)
    m.risk_score = result["risk_score"]
    m.trust_score = result["trust_score"]
    db.commit()
    return result


# ----------------------------------------------------------------------
# Mandates
# ----------------------------------------------------------------------

@app.post("/mandates/analyze")
def mandates_analyze(req: schemas.MandateAnalyzeRequest, db: Session = Depends(get_db)):
    agent = _get_agent_or_404(db, req.agent_id)
    lookback = dt.datetime.utcnow() - dt.timedelta(minutes=req.window_minutes * 3)
    recent = (db.query(models.Transaction)
              .filter(models.Transaction.agent_id == agent.id)
              .filter(models.Transaction.created_at >= lookback)
              .order_by(models.Transaction.created_at.asc()).all())
    result = compute_mandate_risk(recent, req.new_amount, req.new_merchant_id, req.window_minutes)
    return result


@app.get("/mandates")
def list_mandates(db: Session = Depends(get_db)):
    mandates = db.query(models.Mandate).all()
    return [{
        "mandate_id": m.id, "user_id": m.user_id, "agent_id": m.agent_id,
        "spending_limit": m.spending_limit, "used_amount": m.used_amount, "status": m.status,
    } for m in mandates]


# ----------------------------------------------------------------------
# Attack Simulator
# ----------------------------------------------------------------------

def _default_ids(db: Session, req: schemas.AttackSimRequest):
    user = db.query(models.User).get(req.user_id) if req.user_id else db.query(models.User).first()
    agent = db.query(models.Agent).get(req.agent_id) if req.agent_id else (
        db.query(models.Agent).filter(models.Agent.status == "active", models.Agent.trust_level == "trusted").first()
    )
    merchant = db.query(models.Merchant).get(req.merchant_id) if req.merchant_id else db.query(models.Merchant).filter(models.Merchant.status == "active").first()
    return user, agent, merchant


@app.post("/attack-simulator/intent-manipulation")
def sim_intent_manipulation(req: schemas.AttackSimRequest, db: Session = Depends(get_db)):
    user, agent, merchant = _default_ids(db, req)
    basket = [{
        "product_name": "Premium Wireless Headphones", "category": "headphones", "brand": "sony",
        "quantity": 1, "unit_price": 12000.0, "refundable": True, "is_addon": False, "attributes": {},
    }]
    txn = run_transaction_pipeline(
        db, user, agent, merchant,
        raw_intent_text="Buy running shoes under ₹5,000.",
        basket_items_in=basket, attack_type="intent_manipulation",
    )
    return _txn_to_detail(txn, db)


@app.post("/attack-simulator/malicious-merchant")
def sim_malicious_merchant(req: schemas.AttackSimRequest, db: Session = Depends(get_db)):
    user, agent, merchant = _default_ids(db, req)
    # force merchant into an anomalous state before scoring
    merchant.agentic_txn_count_prev_period = max(merchant.agentic_txn_count_prev_period, 20)
    merchant.agentic_txn_count = merchant.agentic_txn_count_prev_period * 4
    merchant.refund_rate = 0.28
    merchant.cancellation_rate = 0.18
    merchant.status = "flagged"
    db.add(models.MerchantEvent(merchant_id=merchant.id, event_type="price_manipulation",
                                 detail="Sudden 4x spike in agentic transactions + refund anomaly (simulated attack)"))
    db.commit()

    basket = [{
        "product_name": "Laptop Pro 15", "category": "laptop", "brand": "dell",
        "quantity": 1, "unit_price": 68000.0, "refundable": True, "is_addon": False,
        "attributes": {"ram_gb": 16},
    }]
    txn = run_transaction_pipeline(
        db, user, agent, merchant,
        raw_intent_text="Buy a Dell laptop under ₹70,000 with at least 16GB RAM.",
        basket_items_in=basket, attack_type="malicious_merchant",
    )
    return _txn_to_detail(txn, db)


@app.post("/attack-simulator/fake-agent")
def sim_fake_agent(req: schemas.AttackSimRequest, db: Session = Depends(get_db)):
    user, _, merchant = _default_ids(db, req)
    # Create (or reuse) an untrusted / unregistered-signature agent to simulate mandate theft
    fake_agent = db.query(models.Agent).filter(models.Agent.trust_level == "malicious").first()
    if not fake_agent:
        fake_agent = models.Agent(
            name="Unknown Shopping Bot", issuer="unverified-third-party", user_id=user.id,
            permissions=["shopping", "payment"], spending_limit=70000.0, status="active",
            trust_level="malicious",
        )
        db.add(fake_agent)
        db.flush()
        pub, priv = crypto_utils.generate_keypair()
        db.add(models.AgentKey(agent_id=fake_agent.id, public_key_pem=pub, private_key_pem=priv))
        db.commit()
        db.refresh(fake_agent)

    basket = [{
        "product_name": "Smartphone X200", "category": "phone", "brand": "samsung",
        "quantity": 1, "unit_price": 45000.0, "refundable": True, "is_addon": False, "attributes": {},
    }]
    txn = run_transaction_pipeline(
        db, user, fake_agent, merchant,
        raw_intent_text="Buy a Samsung phone.",
        basket_items_in=basket, attack_type="fake_agent",
        tamper_signature=True,
    )
    return _txn_to_detail(txn, db)


@app.post("/attack-simulator/mandate-drain")
def sim_mandate_drain(req: schemas.AttackSimRequest, db: Session = Depends(get_db)):
    user, agent, _ = _default_ids(db, req)
    merchants = db.query(models.Merchant).limit(15).all()
    if len(merchants) < 5:
        merchants = (merchants * 5)[:15]

    last_txn = None
    now = dt.datetime.utcnow()
    for i in range(30):
        m = merchants[i % len(merchants)]
        basket = [{
            "product_name": f"Gift Card ₹4,999", "category": "giftcard", "brand": None,
            "quantity": 1, "unit_price": 4999.0, "refundable": False, "is_addon": False, "attributes": {},
        }]
        txn = run_transaction_pipeline(
            db, user, agent, m,
            raw_intent_text="Buy gift card.",
            basket_items_in=basket, attack_type="mandate_drain",
        )
        # backdate into an 8 minute burst window, ending now, at ~3AM pattern
        txn.created_at = now - dt.timedelta(seconds=(30 - i) * 16)
        last_txn = txn
    db.commit()
    db.refresh(last_txn)
    return _txn_to_detail(last_txn, db)


@app.post("/attack-simulator/normal-transaction")
def sim_normal_transaction(req: schemas.AttackSimRequest, db: Session = Depends(get_db)):
    user, agent, merchant = _default_ids(db, req)
    basket = [{
        "product_name": "Laptop Pro 15", "category": "laptop", "brand": "dell",
        "quantity": 1, "unit_price": 65999.0, "refundable": True, "is_addon": False,
        "attributes": {"ram_gb": 16},
    }]
    txn = run_transaction_pipeline(
        db, user, agent, merchant,
        raw_intent_text="Buy a Dell laptop under ₹70,000 with at least 16GB RAM.",
        basket_items_in=basket, attack_type="normal_transaction",
    )
    return _txn_to_detail(txn, db)


# ----------------------------------------------------------------------
# Dashboard / Alerts
# ----------------------------------------------------------------------

@app.get("/dashboard/overview")
def dashboard_overview(db: Session = Depends(get_db)):
    total_txns = db.query(models.Transaction).count()
    blocked = db.query(models.Transaction).filter(models.Transaction.status == "BLOCKED").count()
    high_risk = db.query(models.Transaction).filter(models.Transaction.status == "HIGH_RISK").count()
    review = db.query(models.Transaction).filter(models.Transaction.status == "REVIEW").count()
    approved = db.query(models.Transaction).filter(models.Transaction.status == "APPROVED").count()

    avg_risk = db.query(func.avg(models.Transaction.overall_risk_score)).scalar() or 0

    blocked_txns = db.query(models.Transaction).filter(models.Transaction.status.in_(["BLOCKED", "HIGH_RISK"])).all()
    fraud_prevented = 0.0
    for t in blocked_txns:
        exp = t.explanation or {}
        pl = exp.get("prevented_loss")
        fraud_prevented += pl if pl else t.amount

    high_risk_merchants = db.query(models.Merchant).filter(models.Merchant.risk_score >= 60).count()
    active_agents = db.query(models.Agent).filter(models.Agent.status == "active").count()

    return {
        "total_agentic_transactions": total_txns,
        "transactions_blocked": blocked,
        "transactions_high_risk": high_risk,
        "transactions_review": review,
        "transactions_approved": approved,
        "fraud_prevented_amount": round(fraud_prevented, 2),
        "average_risk_score": round(avg_risk, 1),
        "high_risk_merchants": high_risk_merchants,
        "active_ai_agents": active_agents,
        "total_merchants": db.query(models.Merchant).count(),
        "total_agents": db.query(models.Agent).count(),
    }


@app.get("/dashboard/analytics")
def dashboard_analytics(db: Session = Depends(get_db)):
    txns = db.query(models.Transaction).order_by(models.Transaction.created_at.asc()).all()

    by_day: dict[str, dict] = {}
    risk_buckets = {"LOW (0-30)": 0, "MEDIUM (31-60)": 0, "HIGH (61-80)": 0, "CRITICAL (81-100)": 0}
    status_counts = {"APPROVED": 0, "REVIEW": 0, "HIGH_RISK": 0, "BLOCKED": 0}
    intent_mismatch_points = []

    for t in txns:
        day = t.created_at.strftime("%Y-%m-%d") if t.created_at else "unknown"
        d = by_day.setdefault(day, {"date": day, "gmv": 0.0, "fraud_attempts": 0, "blocked": 0, "count": 0})
        d["gmv"] += t.amount
        d["count"] += 1
        if t.overall_risk_score and t.overall_risk_score > 60:
            d["fraud_attempts"] += 1
        if t.status == "BLOCKED":
            d["blocked"] += 1

        r = t.overall_risk_score or 0
        if r <= 30:
            risk_buckets["LOW (0-30)"] += 1
        elif r <= 60:
            risk_buckets["MEDIUM (31-60)"] += 1
        elif r <= 80:
            risk_buckets["HIGH (61-80)"] += 1
        else:
            risk_buckets["CRITICAL (81-100)"] += 1

        status_counts[t.status] = status_counts.get(t.status, 0) + 1

        if t.intent_match_score is not None:
            intent_mismatch_points.append({
                "transaction": t.id[-6:], "intent_match": t.intent_match_score,
                "risk": t.overall_risk_score,
            })

    merchant_risk = [
        {"merchant": m.name, "risk_score": m.risk_score, "gmv": m.gmv}
        for m in db.query(models.Merchant).order_by(models.Merchant.risk_score.desc()).limit(10).all()
    ]

    # velocity: transactions per 5-min bucket over last hour
    velocity = []
    now = dt.datetime.utcnow()
    for i in range(12, 0, -1):
        bucket_end = now - dt.timedelta(minutes=(i - 1) * 5)
        bucket_start = now - dt.timedelta(minutes=i * 5)
        count = sum(1 for t in txns if t.created_at and bucket_start <= t.created_at < bucket_end)
        velocity.append({"bucket": bucket_end.strftime("%H:%M"), "transactions": count})

    return {
        "daily": sorted(by_day.values(), key=lambda x: x["date"]),
        "risk_distribution": [{"name": k, "value": v} for k, v in risk_buckets.items()],
        "status_distribution": [{"name": k, "value": v} for k, v in status_counts.items()],
        "merchant_risk": merchant_risk,
        "intent_mismatch": intent_mismatch_points[-30:],
        "velocity": velocity,
    }


@app.get("/alerts")
def list_alerts(db: Session = Depends(get_db)):
    alerts = db.query(models.FraudAlert).order_by(models.FraudAlert.created_at.desc()).limit(100).all()
    return [{
        "id": a.id, "transaction_id": a.transaction_id, "agent_id": a.agent_id, "merchant_id": a.merchant_id,
        "severity": a.severity, "title": a.title, "description": a.description, "alert_type": a.alert_type,
        "status": a.status, "timestamp": a.created_at.isoformat(),
    } for a in alerts]


@app.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, db: Session = Depends(get_db)):
    a = db.query(models.FraudAlert).get(alert_id)
    if not a:
        raise HTTPException(404, "Alert not found")
    a.status = "resolved"
    db.commit()
    return {"id": a.id, "status": a.status}


@app.get("/")
def root():
    return {"app": "PayGuard AI", "status": "running", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
