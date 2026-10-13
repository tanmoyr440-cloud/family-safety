"""Application configuration settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Global configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Family Safety Net API"
    app_version: str = "0.1.0"
    environment: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    portal_base_url: str = "http://localhost:5173"

    # CORS
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    cors_origin_regex: str | None = r"^https:\/\/.*\.vercel\.app$"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/family_safety_net"

    # Security
    secret_key: str = "dev-insecure-secret-key-at-least-32-characters-long"

    # Notifications & Allowlist
    notifications_allowlist: list[str] = []
    dry_run: bool = False

    # SMS Provider (Twilio)
    twilio_account_sid: str = "AC_mock_twilio_account_sid"
    twilio_auth_token: str = "mock_twilio_auth_token"
    twilio_from_number: str = "+15005550006"

    # Email Provider (Resend)
    resend_api_key: str = "re_mock_resend_api_key"
    resend_from_email: str = "alerts@familysafetynet.app"

    # SMTP Email Provider (e.g. Gmail)
    smtp_enabled: bool = False
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_use_tls: bool = True

    # Groww Adapter (Phase 7 feature flag)
    groww_adapter_enabled: bool = False
    groww_api_key: str | None = None
    groww_api_secret: str | None = None
    groww_api_totp: str | None = None


settings = Settings()
