"""
DocuMind AI — FastAPI Application Entry Point
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.database.session import init_db
from app.api.documents import router as documents_router
from app.api.chat import router as chat_router
from app.api.dashboard import router as dashboard_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s — %(name)s — %(levelname)s — %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="DocuMind AI",
    description=(
        "AI-Powered Document Intelligence & Research Assistant. "
        "Upload PDFs, ask questions with RAG, get cited answers."
    ),
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(dashboard_router)
app.include_router(documents_router)
app.include_router(chat_router)


@app.on_event("startup")
def on_startup():
    """Initialize database and log configuration on startup."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    init_db()
    logger.info(f"Database initialized: {settings.DATABASE_URL}")
    logger.info(f"API Key configured: {settings.has_api_key}")
    logger.info(f"Demo mode: {settings.DEMO_MODE or not settings.has_api_key}")
    logger.info(f"Upload directory: {settings.upload_path}")
    logger.info(f"Embedding model: {settings.EMBEDDING_MODEL}")
    logger.info(f"Claude model: {settings.CLAUDE_MODEL}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=True,
    )
