import os

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_JWT_SECRET = "dev-secret-change-this-in-production-use-openssl"

_KNOWN_WEAK_JWT_SECRETS = {
    _DEV_JWT_SECRET,
    "change-me-generate-with-openssl-rand-hex-32",
    "change-me-openssl-rand-hex-32",
    "secret",
    "changeme",
    "password",
    "test",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Atelier"
    env: str = "dev"
    images_dir: str = "/app/data/images"
    image_search_provider: str = "mock"
    max_download_mb: int = 25
    min_image_width: int = 400
    default_results_per_search: int = 30

    DATABASE_URL: str = "postgresql+asyncpg://art:art@localhost:5432/art"
    JWT_SECRET: str = _DEV_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    JWT_LIFETIME_SECONDS: int = 60 * 60 * 24 * 7

    COOKIE_NAME: str = "artref_auth"
    COOKIE_MAX_AGE_SECONDS: int = 60 * 60 * 24 * 7
    COOKIE_SECURE: bool | None = None
    COOKIE_SAMESITE: str | None = None

    ENVIRONMENT: str = "production"
    APP_DOMAIN: str = "localhost"

    FIRST_ADMIN_EMAIL: str = "sergio@meioorc.com"
    FIRST_ADMIN_PASSWORD: str = ""

    PASSWORD_RESET_ENABLED: bool = False
    PASSWORD_RESET_TOKEN_LIFETIME_SECONDS: int = 60 * 60

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    BRAVE_API_KEY: str = ""
    SERPAPI_KEY: str = ""
    GOOGLE_CSE_KEY: str = ""
    GOOGLE_CSE_CX: str = ""

    RATE_LIMITS_DISABLED: bool = False

    CORS_ORIGINS: list[str] | None = None

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            import json
            return json.loads(v)
        return v

    @field_validator("JWT_SECRET")
    @classmethod
    def jwt_secret_strong(cls, v: str) -> str:
        env = os.getenv("ENVIRONMENT", "production").lower()
        is_prod = env == "production"

        if is_prod:
            stripped = v.strip()
            if stripped in _KNOWN_WEAK_JWT_SECRETS:
                raise ValueError(
                    "JWT_SECRET is a known placeholder — generate a real one "
                    "with `openssl rand -hex 32` before deploying to production."
                )
            if len(stripped) < 32:
                raise ValueError(
                    "JWT_SECRET must be at least 32 characters in production."
                )
            if len(set(stripped)) < 8:
                raise ValueError(
                    "JWT_SECRET has too little entropy "
                    "(fewer than 8 distinct characters)."
                )
        else:
            if len(v) < 16:
                raise ValueError("JWT_SECRET must be at least 16 characters.")
        return v

    @model_validator(mode="after")
    def derive_environment_defaults(self) -> "Settings":
        is_prod = self.ENVIRONMENT.lower() == "production"

        if self.COOKIE_SECURE is None:
            object.__setattr__(self, "COOKIE_SECURE", is_prod)
        if self.COOKIE_SAMESITE is None:
            object.__setattr__(
                self, "COOKIE_SAMESITE", "strict" if is_prod else "lax"
            )
        if is_prod and self.RATE_LIMITS_DISABLED:
            raise ValueError(
                "RATE_LIMITS_DISABLED=True is not allowed when ENVIRONMENT=production."
            )
        if self.PASSWORD_RESET_ENABLED:
            missing = [
                name
                for name, value in (
                    ("SMTP_HOST", self.SMTP_HOST),
                    ("SMTP_FROM", self.SMTP_FROM),
                )
                if not value
            ]
            if missing:
                raise ValueError(
                    "PASSWORD_RESET_ENABLED=True requires SMTP configuration; "
                    f"missing: {', '.join(missing)}."
                )
            if self.SMTP_USE_TLS and self.SMTP_USE_SSL:
                raise ValueError(
                    "SMTP_USE_TLS and SMTP_USE_SSL are mutually exclusive."
                )
        if self.CORS_ORIGINS is None:
            if is_prod:
                origin = f"https://{self.APP_DOMAIN}" if self.APP_DOMAIN else ""
                object.__setattr__(
                    self, "CORS_ORIGINS", [origin] if origin else []
                )
            else:
                object.__setattr__(
                    self,
                    "CORS_ORIGINS",
                    ["http://localhost:5173", "http://localhost:3000"],
                )
        return self


settings = Settings()
