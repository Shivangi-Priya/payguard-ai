"""
PayGuard AI - Seed / Demo Data

Populates users, trusted agents (with real Ed25519 keypairs), merchants
(mix of healthy + risky), and a batch of historical transactions covering
approved, review, high-risk, and blocked outcomes so the dashboard looks
alive on first load.
"""
import datetime as dt
import random
from sqlalchemy.orm import Session

from . import models, crypto_utils
from .core_pipeline import run_transaction_pipeline

random.seed(42)


def run_seed(db: Session):
    print("Seeding PayGuard AI demo data...")

    # ---------------- Users ----------------
    users = [
        models.User(name="Aarav Sharma", email="aarav@example.com", default_spending_limit=70000),
        models.User(name="Priya Nair", email="priya@example.com", default_spending_limit=50000),
        models.User(name="Rohan Mehta", email="rohan@example.com", default_spending_limit=100000),
    ]
    db.add_all(users)
    db.flush()

    # ---------------- Merchants ----------------
    merchant_defs = [
        ("TechBazaar Electronics", "electronics", True, 0.03, 0.02, 40),
        ("StyleHub Fashion", "fashion", True, 0.05, 0.03, 25),
        ("QuickMart Groceries", "grocery", True, 0.01, 0.01, 60),
        ("GadgetVerse", "electronics", True, 0.04, 0.02, 30),
        ("MegaDeals Marketplace", "general", False, 0.22, 0.15, 12),  # risky
        ("FlashSale Outlet", "general", True, 0.18, 0.12, 15),  # risky
        ("PrimeStyle Sneakers", "fashion", True, 0.02, 0.01, 20),
        ("HomeEssentials Co", "home", True, 0.03, 0.02, 18),
        ("AudioWorld", "electronics", True, 0.04, 0.03, 22),
        ("GiftCardExpress", "giftcard", True, 0.01, 0.01, 8),
        ("SuspiciousDeals24", "general", False, 0.30, 0.20, 5),  # very risky
        ("BudgetTech Traders", "electronics", True, 0.16, 0.10, 14),
    ]
    merchants = []
    for name, cat, kyc, refund, cancel, prev_count in merchant_defs:
        m = models.Merchant(
            name=name, category=cat, kyc_verified=kyc, refund_rate=refund,
            cancellation_rate=cancel, agentic_txn_count_prev_period=prev_count,
            agentic_txn_count=prev_count,
        )
        merchants.append(m)
    db.add_all(merchants)
    db.flush()

    def merchant(name):
        return next(m for m in merchants if m.name == name)

    # ---------------- Agents (with real crypto identities) ----------------
    agent_defs = [
        ("ShopSmart Assistant", "trusted-ai-provider", users[0], ["shopping", "payment"], 70000, "trusted", "active"),
        ("PersonalShopper Pro", "trusted-ai-provider", users[1], ["shopping", "payment"], 50000, "trusted", "active"),
        ("AutoBuy Agent", "verified-partner-labs", users[2], ["shopping", "payment"], 100000, "trusted", "active"),
        ("BargainBot", "unverified-startup", users[0], ["shopping"], 20000, "unverified", "active"),
        ("LegacyAgent v1", "trusted-ai-provider", users[1], ["shopping", "payment"], 30000, "trusted", "suspended"),
    ]
    agents = []
    for name, issuer, user, perms, limit, trust, status in agent_defs:
        a = models.Agent(
            name=name, issuer=issuer, user_id=user.id, permissions=perms,
            spending_limit=limit, trust_level=trust, status=status,
        )
        db.add(a)
        db.flush()
        pub, priv = crypto_utils.generate_keypair()
        db.add(models.AgentKey(agent_id=a.id, public_key_pem=pub, private_key_pem=priv))
        db.add(models.AgentEvent(agent_id=a.id, event_type="registered", detail=f"Registered by issuer {issuer}"))
        agents.append(a)
    db.commit()
    for a in agents:
        db.refresh(a)

    trusted_agent = agents[0]
    user0 = users[0]

    # ---------------- Historical transactions ----------------
    scenarios = [
        # (user, agent, merchant, intent_text, basket, tamper_sig, attack_type)
        (users[0], agents[0], merchant("TechBazaar Electronics"),
         "Buy a laptop under ₹70,000 with at least 16GB RAM.",
         [{"product_name": "UltraBook 14", "category": "laptop", "brand": "hp", "quantity": 1,
           "unit_price": 64999.0, "refundable": True, "is_addon": False, "attributes": {"ram_gb": 16}}],
         False, None),
        (users[1], agents[1], merchant("StyleHub Fashion"),
         "Buy running shoes under ₹5,000.",
         [{"product_name": "AirRun Sneakers", "category": "shoes", "brand": "nike", "quantity": 1,
           "unit_price": 4499.0, "refundable": True, "is_addon": False, "attributes": {}}],
         False, None),
        (users[2], agents[2], merchant("GadgetVerse"),
         "Buy a smartwatch under ₹15,000.",
         [{"product_name": "FitTrack Watch", "category": "watch", "brand": "samsung", "quantity": 1,
           "unit_price": 13999.0, "refundable": True, "is_addon": False, "attributes": {}}],
         False, None),
        (users[0], agents[0], merchant("TechBazaar Electronics"),
         "Buy the best laptop under ₹70,000 with at least 16GB RAM.",
         [{"product_name": "PowerBook X1", "category": "laptop", "brand": "asus", "quantity": 1,
           "unit_price": 92999.0, "refundable": True, "is_addon": False, "attributes": {"ram_gb": 16}}],
         False, "intent_manipulation"),
        (users[1], agents[1], merchant("PrimeStyle Sneakers"),
         "Buy running shoes under ₹5,000.",
         [{"product_name": "Studio Headphones", "category": "headphones", "brand": "bose", "quantity": 1,
           "unit_price": 11999.0, "refundable": True, "is_addon": False, "attributes": {}}],
         False, "intent_manipulation"),
        (users[2], agents[2], merchant("MegaDeals Marketplace"),
         "Buy a wireless mouse under ₹1,500.",
         [{"product_name": "ProMouse X", "category": "electronics", "brand": None, "quantity": 1,
           "unit_price": 1299.0, "refundable": True, "is_addon": False, "attributes": {}},
          {"product_name": "Extended Warranty Plan", "category": "subscription", "brand": None, "quantity": 1,
           "unit_price": 2999.0, "refundable": False, "is_addon": True, "attributes": {}}],
         False, "malicious_merchant"),
        (users[0], agents[3], merchant("BudgetTech Traders"),
         "Buy a phone charger under ₹800.",
         [{"product_name": "FastCharge Adapter", "category": "electronics", "brand": None, "quantity": 1,
           "unit_price": 699.0, "refundable": True, "is_addon": False, "attributes": {}}],
         False, None),
        (users[1], agents[4], merchant("HomeEssentials Co"),
         "Buy a table lamp under ₹2,000.",
         [{"product_name": "LED Desk Lamp", "category": "home", "brand": None, "quantity": 1,
           "unit_price": 1799.0, "refundable": True, "is_addon": False, "attributes": {}}],
         True, "fake_agent"),
        (users[2], agents[2], merchant("AudioWorld"),
         "Buy noise-cancelling headphones under ₹20,000.",
         [{"product_name": "SilentPro Headphones", "category": "headphones", "brand": "sony", "quantity": 1,
           "unit_price": 18999.0, "refundable": True, "is_addon": False, "attributes": {}}],
         False, None),
        (users[0], agents[0], merchant("SuspiciousDeals24"),
         "Buy a power bank under ₹2,500.",
         [{"product_name": "MegaCharge 20000mAh", "category": "electronics", "brand": None, "quantity": 1,
           "unit_price": 2399.0, "refundable": False, "is_addon": False, "attributes": {}}],
         False, "malicious_merchant"),
    ]

    for user, agent, merch, text, basket, tamper, attack in scenarios:
        run_transaction_pipeline(
            db, user, agent, merch, raw_intent_text=text, basket_items_in=basket,
            tamper_signature=tamper, attack_type=attack,
        )

    # Backdate the seeded transactions to spread over the last 7 days for nicer charts
    all_txns = db.query(models.Transaction).order_by(models.Transaction.created_at.asc()).all()
    base = dt.datetime.utcnow() - dt.timedelta(days=7)
    for idx, t in enumerate(all_txns):
        t.created_at = base + dt.timedelta(hours=idx * 14 + random.randint(0, 5))
    db.commit()

    # A handful of extra "normal" approved transactions across days for chart richness
    good_merchants = [merchant("QuickMart Groceries"), merchant("TechBazaar Electronics"),
                       merchant("AudioWorld"), merchant("HomeEssentials Co")]
    for i in range(15):
        u = random.choice(users)
        a = trusted_agent if u.id == user0.id else agents[1]
        m = random.choice(good_merchants)
        price = random.choice([999, 1499, 2999, 4999, 9999, 14999])
        txn = run_transaction_pipeline(
            db, u, a, m,
            raw_intent_text=f"Buy a product under ₹{price + 1000}.",
            basket_items_in=[{
                "product_name": f"Everyday Item {i}", "category": m.category, "brand": None,
                "quantity": 1, "unit_price": float(price), "refundable": True, "is_addon": False, "attributes": {},
            }],
        )
        txn.created_at = base + dt.timedelta(days=random.randint(0, 6), hours=random.randint(0, 23))
    db.commit()

    print(f"Seed complete: {len(users)} users, {len(agents)} agents, {len(merchants)} merchants, "
          f"{db.query(models.Transaction).count()} transactions.")
