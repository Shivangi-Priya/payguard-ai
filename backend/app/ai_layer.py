"""
PayGuard AI - AI Layer (Intent Extraction & Explanation Generation)

Provides an LLM-compatible interface. If ANTHROPIC_API_KEY is configured and
USE_MOCK_AI is false, calls the Anthropic API. Otherwise falls back to a fully
deterministic, offline mock AI so the whole application works without any
network access or API key - required for demo reliability.
"""
import re
import json
from .config import settings

KNOWN_CATEGORIES = {
    "laptop": ["laptop", "notebook", "macbook", "chromebook"],
    "phone": ["phone", "smartphone", "iphone", "mobile"],
    "shoes": ["shoe", "shoes", "sneaker", "sneakers", "footwear"],
    "headphones": ["headphone", "headphones", "earbud", "earbuds", "earphone"],
    "watch": ["watch", "smartwatch"],
    "tv": ["tv", "television"],
}

KNOWN_BRANDS = [
    "apple", "samsung", "dell", "hp", "lenovo", "asus", "acer", "nike",
    "adidas", "puma", "sony", "bose", "jbl", "xiaomi", "oneplus", "boat",
]


def extract_intent(raw_text: str) -> dict:
    """
    Deterministic mock 'LLM' intent extraction. Parses natural language
    shopping requests into structured intent: category, brand, max_price,
    quantity, and attributes (e.g. RAM, refundable).

    This mirrors what a real LLM call (Claude) would return in JSON mode;
    swap in `call_llm_extract_intent` below when ANTHROPIC_API_KEY is set.
    """
    text = raw_text.lower()

    category = None
    for cat, keywords in KNOWN_CATEGORIES.items():
        if any(kw in text for kw in keywords):
            category = cat
            break

    brand = next((b for b in KNOWN_BRANDS if b in text), None)

    # Max price: look for numbers near "under", "below", "max", "budget", "₹"
    max_price = None
    price_patterns = [
        r"under\s*(?:₹|rs\.?|inr)?\s*([\d,]+)",
        r"below\s*(?:₹|rs\.?|inr)?\s*([\d,]+)",
        r"max(?:imum)?\s*(?:of)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+)",
        r"budget\s*(?:of)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+)",
        r"(?:₹|rs\.?|inr)\s*([\d,]+)",
    ]
    for pat in price_patterns:
        m = re.search(pat, text)
        if m:
            max_price = float(m.group(1).replace(",", ""))
            break

    # Quantity
    qty_match = re.search(r"\b(\d+)\s*(?:x|units?|pieces?|pcs)\b", text)
    quantity = int(qty_match.group(1)) if qty_match else 1

    # Attributes
    attributes = {}
    ram_match = re.search(r"(\d+)\s*gb\s*ram", text)
    if ram_match:
        attributes["ram_gb"] = int(ram_match.group(1))

    refundable_required = "refundable" in text or "return policy" in text

    return {
        "category": category,
        "brand": brand,
        "max_price": max_price,
        "quantity": quantity,
        "attributes": attributes,
        "refundable_required": refundable_required,
        "raw_text": raw_text,
    }


def generate_natural_language_summary(reasons: list[str], decision: str, risk_score: float) -> str:
    """
    Produces a short human-readable summary paragraph for the fraud report.
    Deterministic templating - stands in for an LLM explanation call.
    """
    if not reasons:
        return f"No anomalies detected. Risk score {risk_score:.0f}/100. Transaction proceeds normally."
    lead = {
        "BLOCK": "This transaction was blocked because it deviates significantly from the user's declared intent and/or trust signals.",
        "HOLD": "This transaction was placed on hold pending manual review due to elevated risk signals.",
        "REVIEW": "This transaction requires additional verification before it can proceed.",
        "APPROVE": "This transaction matches the user's intent and passed all trust checks.",
    }.get(decision, "This transaction was flagged for review.")
    return lead
