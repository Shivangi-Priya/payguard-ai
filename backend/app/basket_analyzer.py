"""
Layer 2 - Basket Integrity Analyzer

Independently scores the *structural* integrity of the final basket
(discounts, taxes, shipping, hidden add-ons, subscriptions, merchant
switch) separate from raw intent comparison in Layer 1.
"""


def analyze_basket(basket_items: list[dict], declared_merchant_id: str | None,
                    actual_merchant_id: str, shipping: float = 0.0, taxes: float = 0.0,
                    discount: float = 0.0, declared_max_price: float | None = None) -> dict:
    reasons = []
    penalty = 0

    basket_total_raw = sum(i["unit_price"] * i.get("quantity", 1) for i in basket_items)

    # Final basket amount vs. the user's declared budget ceiling is itself a
    # basket-integrity signal (Layer 2 "Price" check), independent of the
    # category-level comparison done in the Intent Engine.
    if declared_max_price is not None and basket_total_raw > declared_max_price:
        overage_pct = (basket_total_raw - declared_max_price) / declared_max_price if declared_max_price else 1
        pts = min(60, 35 + overage_pct * 120)
        penalty += pts
        reasons.append(
            f"Final basket amount ₹{basket_total_raw:,.0f} exceeds the user's approved budget of "
            f"₹{declared_max_price:,.0f}."
        )

    addon_items = [i for i in basket_items if i.get("is_addon")]
    subscription_items = [i for i in basket_items if "subscription" in (i.get("category") or "").lower()]

    if addon_items:
        names = ", ".join(i["product_name"] for i in addon_items)
        pts = min(30, 10 * len(addon_items))
        penalty += pts
        reasons.append(f"Hidden/add-on product(s) detected in basket: {names}.")

    if subscription_items:
        names = ", ".join(i["product_name"] for i in subscription_items)
        penalty += 20
        reasons.append(f"Unexpected subscription add-on(s) detected: {names}.")

    if declared_merchant_id and actual_merchant_id and declared_merchant_id != actual_merchant_id:
        penalty += 25
        reasons.append("Merchant was silently changed after the user's original selection.")

    basket_subtotal = sum(i["unit_price"] * i.get("quantity", 1) for i in basket_items)
    if basket_subtotal > 0:
        if shipping > basket_subtotal * 0.15:
            penalty += 10
            reasons.append(f"Shipping charges (₹{shipping:,.0f}) are unusually high relative to basket value.")
        if taxes > basket_subtotal * 0.35:
            penalty += 8
            reasons.append(f"Tax amount (₹{taxes:,.0f}) is abnormally high.")
        if discount > basket_subtotal * 0.6:
            penalty += 12
            reasons.append("Suspiciously large discount applied - possible price manipulation.")

    score = max(0, 100 - penalty)
    return {"score": round(score, 1), "reasons": reasons}
