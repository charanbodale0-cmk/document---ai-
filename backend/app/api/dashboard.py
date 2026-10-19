"""
DocuMind AI — Dashboard API Routes
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.session import get_db
from app.models.models import Document, Conversation, Message, MessageRole, ProcessingStatus
from app.schemas.schemas import DashboardStats, DocumentOut, ConversationOut, HealthResponse
from app.core.config import settings

router = APIRouter(prefix="/api", tags=["Dashboard"])


@router.get("/health", response_model=HealthResponse)
def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        api_key_configured=settings.has_api_key,
        demo_mode=settings.DEMO_MODE or not settings.has_api_key,
        embedding_model=settings.EMBEDDING_MODEL,
        claude_model=settings.CLAUDE_MODEL,
    )


@router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get real dashboard statistics from the database."""
    total_docs = db.query(func.count(Document.id)).scalar() or 0
    processed_docs = db.query(func.count(Document.id)).filter(
        Document.processing_status == ProcessingStatus.COMPLETED
    ).scalar() or 0

    total_conversations = db.query(func.count(Conversation.id)).scalar() or 0
    total_messages = db.query(func.count(Message.id)).scalar() or 0
    total_questions = db.query(func.count(Message.id)).filter(
        Message.role == MessageRole.USER
    ).scalar() or 0

    storage_used = db.query(func.sum(Document.file_size)).scalar() or 0

    # Success rate
    failed_docs = db.query(func.count(Document.id)).filter(
        Document.processing_status == ProcessingStatus.FAILED
    ).scalar() or 0
    attempted = processed_docs + failed_docs
    success_rate = (processed_docs / attempted * 100) if attempted > 0 else 0.0

    # Recent documents
    recent_docs = db.query(Document).order_by(
        Document.created_at.desc()
    ).limit(5).all()

    # Recent conversations
    recent_convs_raw = db.query(Conversation).order_by(
        Conversation.updated_at.desc()
    ).limit(5).all()

    recent_convs = []
    for conv in recent_convs_raw:
        msg_count = db.query(func.count(Message.id)).filter(
            Message.conversation_id == conv.id
        ).scalar() or 0
        doc_name = None
        if conv.document_id:
            doc = db.query(Document).filter(Document.id == conv.document_id).first()
            doc_name = doc.original_filename if doc else None
        recent_convs.append(ConversationOut(
            id=conv.id,
            title=conv.title,
            document_id=conv.document_id,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            message_count=msg_count,
            document_name=doc_name,
        ))

    return DashboardStats(
        total_documents=total_docs,
        processed_documents=processed_docs,
        total_conversations=total_conversations,
        total_messages=total_messages,
        total_questions=total_questions,
        storage_used_bytes=storage_used,
        recent_documents=recent_docs,
        recent_conversations=recent_convs,
        processing_success_rate=round(success_rate, 1),
    )
