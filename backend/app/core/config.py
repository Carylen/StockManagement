from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://utstock:utstock_secret@localhost:5432/utstock_db"
    SECRET_KEY: str = "change-me-in-production-use-at-least-32-random-characters"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 12
    CORS_ORIGINS: str = "http://localhost:3000"
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "no-reply@utstock.app"
    LOG_LEVEL: str = "INFO"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS — supports JSON array or comma-separated string.

        .env examples (both valid):
            CORS_ORIGINS=http://localhost:3000
            CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
        """
        raw = self.CORS_ORIGINS.strip()
        if raw.startswith("["):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                pass
        return [o.strip() for o in raw.split(",") if o.strip()]

    model_config = {"env_file": None, "extra": "ignore"}


settings = Settings()
