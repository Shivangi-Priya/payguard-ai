from pydantic import BaseModel, Field
from typing import Optional, Any


class AgentRegisterRequest(BaseModel):
    name: str
    issuer: str
    user_id: str
    permissions: list[str] = ["shopping", "payment"]
    spending_limit: float = 70000.0
    currency: str = "INR"
    trust_level: str = "trusted"


class BasketItemIn(BaseModel):
    product_name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    quantity: int = 1
    unit_price: float
    refundable: bool = True
    is_addon: bool = False
    attributes: dict = {}


class TransactionAnalyzeRequest(BaseModel):
    user_id: str
    agent_id: str
    merchant_id: str
    declared_merchant_id: Optional[str] = None
    raw_intent_text: str
    basket_items: list[BasketItemIn]
    shipping: float = 0.0
    taxes: float = 0.0
    discount: float = 0.0
    # signature simulation
    tamper_signature: bool = False   # for demo: force an invalid signature
    override_signature: Optional[str] = None
    timestamp: Optional[str] = None
    attack_type: Optional[str] = None


class SignatureVerifyRequest(BaseModel):
    agent_id: str
    payload: dict
    signature: str


class IntentAnalyzeRequest(BaseModel):
    raw_text: str
    basket_items: list[BasketItemIn]


class BasketAnalyzeRequest(BaseModel):
    basket_items: list[BasketItemIn]
    declared_merchant_id: Optional[str] = None
    actual_merchant_id: str
    shipping: float = 0.0
    taxes: float = 0.0
    discount: float = 0.0


class MandateAnalyzeRequest(BaseModel):
    agent_id: str
    new_amount: float
    new_merchant_id: str
    window_minutes: int = 10


class AgentLimitChangeRequest(BaseModel):
    spending_limit: float


class AttackSimRequest(BaseModel):
    user_id: Optional[str] = None
    agent_id: Optional[str] = None
    merchant_id: Optional[str] = None
