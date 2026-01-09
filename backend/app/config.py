from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    supabase_url: str
    supabase_anon_key: str
    
    # CORS settings
    cors_origins: list[str] = [
        "http://localhost:3000", 
        "http://127.0.0.1:3000", 
        "https://maker-tan.vercel.app",
        "https://maker-production-8686.up.railway.app"
    ]
    
    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

