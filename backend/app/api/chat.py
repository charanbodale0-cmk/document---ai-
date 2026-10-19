"""
DocuMind AI — Chat API Routes
Handles conversations and RAG-based question answering.
"""

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.session import get_db
from app.models.models import (
    Conversation, Message, Document, MessageRole, ProcessingStatus,
)
from app.schemas.schemas import (
    ChatRequest, ChatResponse, ConversationOut, ConversationDetailOut,
    MessageOut, ConversationRenameRequest, SourceCitation,
)
from app.services.retrieval_service import RetrievalService
from app.services.claude_service import get_ai_service
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """
    Send a question and get a RAG-grounded answer.
    Creates a new conversation if conversation_id is not provided.
    """
    # Validate document if specified
    doc = None
    if request.document_id:
        doc = db.query(Document).filter(Document.id == request.document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")
        if doc.processing_status not in (ProcessingStatus.COMPLETED, ProcessingStatus.PARTIAL):
            raise HTTPException(
                status_code=400,
                detail="Document has not been processed yet. Please wait for processing to complete."
            )

    # Get or create conversation
    conversation = None
    if request.conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == request.conversation_id
        ).first()

    if not conversation:
        conversation = Conversation(
            title=request.question[:80] + ("..." if len(request.question) > 80 else ""),
            document_id=request.document_id,
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # Retrieve relevant context
    sources: List[SourceCitation] = []
    if request.document_id:
        sources = RetrievalService.retrieve(
            db=db,
            query=request.question,
            document_id=request.document_id,
        )

    # Build conversation history
    history_messages = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.created_at).all()

    conversation_history = []
    for msg in history_messages[-10:]:  # Last 10 messages for context window
        conversation_history.append({
            "role": msg.role.value if isinstance(msg.role, MessageRole) else msg.role,
            "content": msg.content,
        })

    # Get AI response
    ai = get_ai_service()
    try:
        result = ai.ask_question(
            question=request.question,
            sources=sources,
            conversation_history=conversation_history if conversation_history else None,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"AI service error: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"AI service error: {str(e)}"
        )

    # Save user message
    user_msg = Message(
        conversation_id=conversation.id,
        role=MessageRole.USER,
        content=request.question,
    )
    db.add(user_msg)

    # Save assistant message with sources
    sources_json = json.dumps([s.model_dump() for s in sources]) if sources else None
    assistant_msg = Message(
        conversation_id=conversation.id,
        role=MessageRole.ASSISTANT,
        content=result["answer"],
        sources=sources_json,
        token_usage=result.get("token_usage"),
        model_used=result.get("model"),
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    is_demo = not settings.has_api_key or settings.DEMO_MODE

    return ChatResponse(
        answer=result["answer"],
        sources=sources,
        conversation_id=conversation.id,
        message_id=assistant_msg.id,
        model_used=result.get("model"),
        token_usage=result.get("token_usage"),
        is_demo=is_demo,
    )


# ── Conversations ─────────────────────────────────────────────────

@router.get("/conversations", response_model=List[ConversationOut])
def list_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List all conversations ordered by most recent."""
    conversations = db.query(Conversation).order_by(
        Conversation.updated_at.desc()
    ).offset(skip).limit(limit).all()

    result = []
    for conv in conversations:
        msg_count = db.query(func.count(Message.id)).filter(
            Message.conversation_id == conv.id
        ).scalar()
        doc_name = None
        if conv.document_id:
            doc = db.query(Document).filter(Document.id == conv.document_id).first()
            doc_name = doc.original_filename if doc else None

        result.append(ConversationOut(
            id=conv.id,
            title=conv.title,
            document_id=conv.document_id,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            message_count=msg_count or 0,
            document_name=doc_name,
        ))

    return result


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailOut)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    """Get a conversation with all messages."""
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at).all()

    doc_name = None
    if conv.document_id:
        doc = db.query(Document).filter(Document.id == conv.document_id).first()
        doc_name = doc.original_filename if doc else None

    return ConversationDetailOut(
        id=conv.id,
        title=conv.title,
        document_id=conv.document_id,
        document_name=doc_name,
        messages=messages,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.put("/conversations/{conversation_id}")
def rename_conversation(
    conversation_id: str,
    request: ConversationRenameRequest,
    db: Session = Depends(get_db),
):
    """Rename a conversation."""
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    conv.title = request.title
    db.commit()
    return {"status": "updated", "title": conv.title}


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    """Delete a conversation and all its messages."""
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    db.delete(conv)
    db.commit()
    return {"status": "deleted", "conversation_id": conversation_id}
