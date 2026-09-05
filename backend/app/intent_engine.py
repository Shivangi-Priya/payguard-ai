"""
Layer 1 - Intent Verification Engine

Compares USER INTENT -> FINAL BASKET and produces an Intent Match Score (0-100)
plus human-readable reasons for any mismatch.
"""


def analyze_intent(intent: dict, basket_items: list[dict]) -> dict:
    """
    intent: {category, brand, max_price, quantity, attributes, refundable_required}
    basket_items: [{product_name, category, brand, quantity, unit_price, refundable, attributes}]

    Returns: {score, reasons: [str], mismatches: [dict]}
    """
    reasons = []
    mismatches = []
    penalty = 0

    basket_total = sum(i["unit_price"] * i.get("quantity", 1) for i in basket_items)
    basket_qty = sum(i.get("quantity", 1) for i in basket_items)
    primary_item = max(basket_items, key=lambda i: i["unit_price"]) if basket_items else None

    # --- Category check ---
    if intent.get("category") and primary_item:
        item_cat = (primary_item.get("category") or "").lower()
        if item_cat and item_cat != intent["category"].lower():
            penalty += 40
            reasons.append(
                f"User requested category '{intent['category']}' but basket contains '{item_cat}'."
            )
            mismatches.append({"field": "category", "expected": intent["category"], "actual": item_cat})

    # --- Price / budget check ---
    # A user-declared "under ₹X" is a hard spending constraint, not a soft
    # preference - breaching it is treated as a serious intent violation.
    if intent.get("max_price") is not None:
        if basket_total > intent["max_price"]:
            overage = basket_total - intent["max_price"]
            overage_pct = overage / intent["max_price"] if intent["max_price"] else 1
            pts = min(65, 40 + overage_pct * 130)
            penalty += pts
            reasons.append(
                f"User specified a maximum of ₹{intent['max_price']:,.0f} but the basket totals "
                f"₹{basket_total:,.0f} (₹{overage:,.0f} over budget)."
            )
            mismatches.append({"field": "price", "expected_max": intent["max_price"], "actual": basket_total})

    # --- Quantity check ---
    expected_qty = intent.get("quantity", 1)
    if basket_qty > expected_qty:
        penalty += min(20, 8 * (basket_qty - expected_qty))
        reasons.append(
            f"User requested {expected_qty} item(s) but the basket contains {basket_qty} item(s)."
        )
        mismatches.append({"field": "quantity", "expected": expected_qty, "actual": basket_qty})

    # --- Brand check ---
    if intent.get("brand") and primary_item:
        item_brand = (primary_item.get("brand") or "").lower()
        if item_brand and item_brand != intent["brand"].lower():
            penalty += 15
            reasons.append(
                f"User requested brand '{intent['brand'].title()}' but agent selected '{item_brand.title()}'."
            )
            mismatches.append({"field": "brand", "expected": intent["brand"], "actual": item_brand})

    # --- Refundability check ---
    if intent.get("refundable_required") and primary_item is not None:
        if not primary_item.get("refundable", True):
            penalty += 15
            reasons.append("User required a refundable product, but the selected item is non-refundable.")
            mismatches.append({"field": "refundable", "expected": True, "actual": False})

    # --- Attribute checks (e.g. RAM) ---
    for attr, expected_val in (intent.get("attributes") or {}).items():
        actual_val = (primary_item or {}).get("attributes", {}).get(attr)
        if actual_val is not None and isinstance(expected_val, (int, float)):
            if actual_val < expected_val:
                penalty += 10
                reasons.append(
                    f"User required {attr.replace('_', ' ')} >= {expected_val}, basket item has {actual_val}."
                )
                mismatches.append({"field": attr, "expected_min": expected_val, "actual": actual_val})

    # --- Add-on / unexpected extra items ---
    if len(basket_items) > 1:
        extra = [i for i in basket_items if i is not primary_item]
        addon_value = sum(i["unit_price"] * i.get("quantity", 1) for i in extra)
        if addon_value > 0:
            penalty += min(15, addon_value / max(basket_total, 1) * 30)
            names = ", ".join(i["product_name"] for i in extra)
            reasons.append(f"Basket contains additional unrequested item(s): {names}.")
            mismatches.append({"field": "addon_items", "items": names})

    score = max(0, 100 - penalty)
    return {
        "score": round(score, 1),
        "reasons": reasons,
        "mismatches": mismatches,
        "basket_total": basket_total,
    }
