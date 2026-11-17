"""Application settings. SECRET_KEY must come from the environment in production."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_DATABASE_URL = "sqlite+aiosqlite:///./data/compliance_one.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = DEFAULT_DATABASE_URL
    # Empty by default. A hardcoded production secret is never shipped in code.
    # docker-compose.yml sets SECRET_KEY for local development only.
    SECRET_KEY: str = ""
    ENV: str = "development"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    JWT_ALGORITHM: str = "HS256"
    CORS_ORIGINS: str = (
        "http://localhost:8081,http://127.0.0.1:8081,"
        "http://localhost:19006,http://127.0.0.1:19006,"
        "http://localhost:8080,http://127.0.0.1:8000"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [part.strip() for part in self.CORS_ORIGINS.split(",") if part.strip()]

    @property
    def jwt_secret(self) -> str:
        if self.SECRET_KEY.strip():
            return self.SECRET_KEY
        if self.ENV.lower() in {"development", "dev", "test"}:
            # Last-resort dev/test fallback when compose/env is not loaded
            # (e.g. pytest). Never used when ENV is production.
            return "dev-only-insecure-secret-do-not-use-in-production"
        raise RuntimeError("SECRET_KEY must be set when ENV is not development")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
