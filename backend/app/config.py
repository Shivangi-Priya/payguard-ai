"""
PayGuard AI - Configuration
Loads risk engine weights and thresholds from environment (with sane defaults),
so the scoring model is fully configurable without code changes.
"""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "PayGuard AI"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./payguard.db")

    # LLM configuration - if no key is present we fall back to a deterministic
    # mock AI layer so the whole app works fully offline.
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    USE_MOCK_AI: bool = os.getenv("USE_MOCK_AI", "true").lower() == "true"

    # ---- Risk engine weights (must sum to 1.0) ----
    WEIGHT_INTENT: float = float(os.getenv("WEIGHT_INTENT", 0.30))
    WEIGHT_BASKET: float = float(os.getenv("WEIGHT_BASKET", 0.20))
    WEIGHT_MERCHANT: float = float(os.getenv("WEIGHT_MERCHANT", 0.20))
    WEIGHT_AGENT: float = float(os.getenv("WEIGHT_AGENT", 0.15))
    WEIGHT_MANDATE: float = float(os.getenv("WEIGHT_MANDATE", 0.15))

    # ---- Risk thresholds ----
    THRESHOLD_LOW: int = int(os.getenv("THRESHOLD_LOW", 30))
    THRESHOLD_MEDIUM: int = int(os.getenv("THRESHOLD_MEDIUM", 60))
    THRESHOLD_HIGH: int = int(os.getenv("THRESHOLD_HIGH", 80))

    # CORS
    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
