from pydantic import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    ENV: str = "dev"

    class Config:
        env_file = ".env"

settings = Settings()
