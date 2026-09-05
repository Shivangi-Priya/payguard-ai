"""
PayGuard AI - Database Models

Users, Agents, AgentKeys, Merchants, Transactions, TransactionItems,
UserIntents, RiskScores, Mandates, FraudAlerts, AgentEvents, MerchantEvents
"""
import uuid
import datetime as dt
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from .database import Base


def gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def now() -> dt.datetime:
    return dt.datetime.utcnow()


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: gen_id("user"))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    default_spending_limit = Column(Float, default=70000.0)
    created_at = Column(DateTime, default=now)

    agents = relationship("Agent", back_populates="user")
    mandates = relationship("Mandate", back_populates="user")
    intents = relationship("UserIntent", back_populates="user")


class Agent(Base):
    __tablename__ = "agents"
    id = Column(String, primary_key=True, default=lambda: gen_id("agent"))
    name = Column(String, nullable=False)
    issuer = Column(String, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    permissions = Column(JSON, default=list)  # e.g. ["shopping", "payment"]
    spending_limit = Column(Float, default=70000.0)
    currency = Column(String, default="INR")
    status = Column(String, default="active")  # active | revoked | suspended
    trust_level = Column(String, default="trusted")  # trusted | unverified | malicious
    risk_score = Column(Float, default=5.0)
    expires_at = Column(DateTime, default=lambda: now() + dt.timedelta(days=90))
    created_at = Column(DateTime, default=now)

    user = relationship("User", back_populates="agents")
    keys = relationship("AgentKey", back_populates="agent")
    transactions = relationship("Transaction", back_populates="agent")
    events = relationship("AgentEvent", back_populates="agent")


class AgentKey(Base):
    __tablename__ = "agent_keys"
    id = Column(String, primary_key=True, default=lambda: gen_id("key"))
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    public_key_pem = Column(Text, nullable=False)
    private_key_pem = Column(Text, nullable=False)  # simulated custody for demo signing only
    algorithm = Column(String, default="Ed25519")
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now)
    rotated_at = Column(DateTime, nullable=True)

    agent = relationship("Agent", back_populates="keys")


class Merchant(Base):
    __tablename__ = "merchants"
    id = Column(String, primary_key=True, default=lambda: gen_id("merch"))
    name = Column(String, nullable=False)
    category = Column(String, default="general")
    kyc_verified = Column(Boolean, default=True)
    trust_score = Column(Float, default=85.0)
    risk_score = Column(Float, default=15.0)
    status = Column(String, default="active")  # active | flagged | suspended
    agentic_txn_count = Column(Integer, default=0)
    agentic_txn_count_prev_period = Column(Integer, default=0)
    refund_rate = Column(Float, default=0.02)
    cancellation_rate = Column(Float, default=0.01)
    gmv = Column(Float, default=0.0)
    created_at = Column(DateTime, default=now)

    transactions = relationship("Transaction", back_populates="merchant")
    events = relationship("MerchantEvent", back_populates="merchant")


class UserIntent(Base):
    __tablename__ = "user_intents"
    id = Column(String, primary_key=True, default=lambda: gen_id("intent"))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    raw_text = Column(Text, nullable=False)
    category = Column(String, nullable=True)
    brand = Column(String, nullable=True)
    max_price = Column(Float, nullable=True)
    quantity = Column(Integer, default=1)
    attributes = Column(JSON, default=dict)  # e.g. {"ram_gb": 16}
    refundable_required = Column(Boolean, default=False)
    intent_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=now)

    user = relationship("User", back_populates="intents")


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(String, primary_key=True, default=lambda: gen_id("txn"))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False)
    intent_id = Column(String, ForeignKey("user_intents.id"), nullable=True)

    amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")

    intent_hash = Column(String, nullable=True)
    basket_hash = Column(String, nullable=True)
    signature = Column(Text, nullable=True)
    signature_valid = Column(Boolean, nullable=True)

    intent_match_score = Column(Float, nullable=True)
    basket_integrity_score = Column(Float, nullable=True)
    merchant_risk_score = Column(Float, nullable=True)
    agent_identity_risk = Column(Float, nullable=True)
    mandate_risk_score = Column(Float, nullable=True)
    overall_risk_score = Column(Float, nullable=True)

    status = Column(String, default="PENDING")  # APPROVED | REVIEW | HIGH_RISK | BLOCKED | PENDING
    attack_type = Column(String, nullable=True)  # tag for demo/simulator origin
    explanation = Column(JSON, default=dict)

    created_at = Column(DateTime, default=now)

    user = relationship("User")
    agent = relationship("Agent", back_populates="transactions")
    merchant = relationship("Merchant", back_populates="transactions")
    items = relationship("TransactionItem", back_populates="transaction", cascade="all, delete-orphan")
    risk_scores = relationship("RiskScore", back_populates="transaction", cascade="all, delete-orphan")
    alerts = relationship("FraudAlert", back_populates="transaction", cascade="all, delete-orphan")


class TransactionItem(Base):
    __tablename__ = "transaction_items"
    id = Column(String, primary_key=True, default=lambda: gen_id("item"))
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=False)
    product_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    brand = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, nullable=False)
    refundable = Column(Boolean, default=True)
    is_addon = Column(Boolean, default=False)
    attributes = Column(JSON, default=dict)

    transaction = relationship("Transaction", back_populates="items")


class RiskScore(Base):
    __tablename__ = "risk_scores"
    id = Column(String, primary_key=True, default=lambda: gen_id("risk"))
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=False)
    intent_risk = Column(Float, default=0.0)
    basket_risk = Column(Float, default=0.0)
    merchant_risk = Column(Float, default=0.0)
    agent_risk = Column(Float, default=0.0)
    mandate_risk = Column(Float, default=0.0)
    overall_risk = Column(Float, default=0.0)
    weights_used = Column(JSON, default=dict)
    decision = Column(String, default="APPROVE")
    reasons = Column(JSON, default=list)
    created_at = Column(DateTime, default=now)

    transaction = relationship("Transaction", back_populates="risk_scores")


class Mandate(Base):
    __tablename__ = "mandates"
    id = Column(String, primary_key=True, default=lambda: gen_id("mandate"))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    spending_limit = Column(Float, default=70000.0)
    used_amount = Column(Float, default=0.0)
    window_start = Column(DateTime, default=now)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=now)

    user = relationship("User", back_populates="mandates")


class FraudAlert(Base):
    __tablename__ = "fraud_alerts"
    id = Column(String, primary_key=True, default=lambda: gen_id("alert"))
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=True)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=True)
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=True)
    severity = Column(String, default="MEDIUM")  # LOW | MEDIUM | HIGH | CRITICAL
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    alert_type = Column(String, nullable=False)
    status = Column(String, default="open")  # open | acknowledged | resolved
    created_at = Column(DateTime, default=now)

    transaction = relationship("Transaction", back_populates="alerts")


class AgentEvent(Base):
    __tablename__ = "agent_events"
    id = Column(String, primary_key=True, default=lambda: gen_id("aevt"))
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    event_type = Column(String, nullable=False)  # registered | revoked | suspended | key_rotated | limit_changed
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now)

    agent = relationship("Agent", back_populates="events")


class MerchantEvent(Base):
    __tablename__ = "merchant_events"
    id = Column(String, primary_key=True, default=lambda: gen_id("mevt"))
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False)
    event_type = Column(String, nullable=False)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now)

    merchant = relationship("Merchant", back_populates="events")
