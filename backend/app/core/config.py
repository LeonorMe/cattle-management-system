from typing import Optional, Any
from pydantic import PostgresDsn, field_validator, ValidationInfo, RootModel
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ENV: str = "dev"
    SECRET_KEY: str = "dev_secret_key_change_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database settings
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "cattle_db"
    POSTGRES_PORT: str = "5432"
    
    DATABASE_URL: Optional[str] = None

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str], info: ValidationInfo) -> Any:
        if isinstance(v, str) and v:
            return v
            
        return str(PostgresDsn.build(
            scheme="postgresql",
            username=info.data.get("POSTGRES_USER"),
            password=info.data.get("POSTGRES_PASSWORD"),
            host=info.data.get("POSTGRES_SERVER"),
            port=int(info.data.get("POSTGRES_PORT")),
            path=f"{info.data.get('POSTGRES_DB') or ''}",
        ))

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
