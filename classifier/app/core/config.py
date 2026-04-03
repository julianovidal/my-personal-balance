from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Balance Classifier API"
    secret_key: str = "change-me"
    database_url: str = "postgresql+psycopg2://balance:balance@localhost:5432/balance"
    cors_origins: list[str] = ["http://localhost:5173"]
    model_data_dir: str = "data"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
