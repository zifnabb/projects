"""Application settings, loaded from environment / .env.

Field names map case-insensitively to env vars (e.g. ``DECKBUILDER_PORT`` →
``deckbuilder_port``). Only the server fields are used in Phase 0; the DB /
auth / HTTP fields are wired up in later phases but declared here so the
shape is stable.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Server ---
    app_name: str = "vermilion"
    deckbuilder_port: int = 8099
    environment: str = "development"

    # --- Database (Phase 1+) ---
    database_url: str = (
        "postgresql+asyncpg://deckbuilder:changeme@localhost:5436/deckbuilder"
    )

    # --- Auth (Phase 3+) ---
    jwt_secret: str = "dev-insecure-change-me"
    admin_username: str = "zifnabb"
    admin_password: str = "changeme"

    # --- Outbound HTTP adapter (Phase 2+) ---
    http_user_agent: str = "vermilion-deckbuilder/0.1 (+https://vermilion.cooldad.top)"


@lru_cache
def get_settings() -> Settings:
    return Settings()
