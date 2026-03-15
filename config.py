from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/onlyus"
    REDIS_URL: str = "redis://localhost:6379"
    JWT_SECRET: str = "your_long_random_secret_key_minimum_32_chars"
    PORT: int = 8000
    EXPO_PUSH_URL: str = "https://exp.host/--/api/v2/push/send"
    CORS_ORIGINS: str = "*"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
