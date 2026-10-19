"""
DocuMind AI — Core Configuration
Loads settings from environment variables with sensible defaults.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "DocuMind AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Server
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:5173"

    # Anthropic API
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

    # Upload
    MAX_FILE_SIZE_MB: int = 50
    UPLOAD_DIR: str = "uploads"
    ALLOWED_EXTENSIONS: List[str] = [".pdf"]

    # Chunking
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    # Embedding
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # RAG
    TOP_K_RESULTS: int = 5
    SIMILARITY_THRESHOLD: float = 0.3

    # Database
    DATABASE_URL: str = "sqlite:///./documind.db"

    # Security
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Demo Mode
    DEMO_MODE: bool = False

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def upload_path(self) -> Path:
        base = Path(__file__).parent.parent.parent
        path = base / self.UPLOAD_DIR
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def vector_store_path(self) -> Path:
        base = Path(__file__).parent.parent.parent
        path = base / "vector_store"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def has_api_key(self) -> bool:
        return bool(self.ANTHROPIC_API_KEY) and self.ANTHROPIC_API_KEY != "your_anthropic_api_key_here"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
