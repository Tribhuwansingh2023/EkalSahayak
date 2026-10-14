"""Configuration module for EkalSahayak (Lakshya AI) Backend.

Uses pydantic-settings to load and strictly validate environment variables.
Fails fast in production mode if security criteria are not met.
"""

from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with fail-fast production validations."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    ENV: Literal["dev", "prod", "test"] = "dev"
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # Database
    MONGODB_URI: str = "mongodb://localhost:27017/ekalsahayak_db"
    MONGODB_DB_NAME: str = "ekalsahayak_db"
    MONGO_CONNECT_TIMEOUT_MS: int = 2000
    MONGO_SERVER_SELECTION_TIMEOUT_MS: int = 1000

    # Security & JWT
    JWT_SECRET_KEY: str = Field(
        default="",
        description="HMAC secret for signing tokens. Must be >= 32 chars in production.",
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "ekalsahayak-auth"
    JWT_AUDIENCE: str = "ekalsahayak-client"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: list[str] | str = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
    )

    # Rate Limiting & Lockout
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_INTERACT: str = "20/minute"
    RATE_LIMIT_VOICE: str = "10/minute"
    MAX_FAILED_LOGINS: int = 10
    LOCKOUT_MINUTES: int = 15

    # Demo / Seed
    SEED_DEMO: bool = True

    # Voice / STT / TTS
    STT_PROVIDER: Literal["null", "whisper", "bhashini"] = "null"
    AUDIO_CACHE_DIR: str = ".audio_cache"
    AUDIO_MAX_BYTES: int = 2 * 1024 * 1024  # 2 MB
    TTS_MAX_CHARS: int = 800
    QUERY_MAX_CHARS: int = 500

    # Optional External AI API Keys
    GROQ_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Optional Bhashini Credentials
    BHASHINI_API_KEY: str = ""
    BHASHINI_USER_ID: str = ""

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return []
            return [orig.strip() for orig in value.split(",") if orig.strip()]
        if isinstance(value, list):
            return [str(orig).strip() for orig in value if str(orig).strip()]
        return []

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        """Strict fail-fast validation for production environments."""
        if self.ENV == "prod":
            # 1. JWT Secret strength check
            if not self.JWT_SECRET_KEY or len(self.JWT_SECRET_KEY.strip()) < 32:
                raise ValueError("In production, JWT_SECRET_KEY must be provided and at least 32 characters long.")
            insecure_patterns = [
                "temporary",
                "secret",
                "default",
                "change-in-production",
                "generate with",
                "password",
            ]
            if any(pat in self.JWT_SECRET_KEY.lower() for pat in insecure_patterns):
                raise ValueError("In production, JWT_SECRET_KEY cannot contain default or placeholder keywords.")

            # 2. Strict CORS in production
            if not self.CORS_ORIGINS:
                raise ValueError("In production, CORS_ORIGINS must contain at least one explicit allowed origin.")
            if any("*" in orig for orig in self.CORS_ORIGINS):
                raise ValueError("In production, CORS_ORIGINS cannot contain wildcards ('*'). Must specify explicit origins.")

            # 3. No demo seeds in production
            if self.SEED_DEMO:
                # Force disable in prod
                self.SEED_DEMO = False
        else:
            # Safe local fallback in dev/test if not supplied
            if not self.JWT_SECRET_KEY:
                self.JWT_SECRET_KEY = "dev-fallback-secret-key-must-be-at-least-32-chars-long"

        return self


# Global singleton factory
settings = Settings()


def get_settings() -> Settings:
    """Dependency helper for FastAPI."""
    return settings
