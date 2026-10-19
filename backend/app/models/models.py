"""
DocuMind AI — SQLAlchemy ORM Models
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Text, DateTime, Boolean,
    ForeignKey, Enum as SAEnum, Index
)
from sqlalchemy.orm import relationship
from app.database.session import Base
import enum


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"  # e.g. text extracted but OCR might be needed


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=generate_uuid)
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)  # bytes
    file_type = Column(String(50), default="application/pdf")
    num_pages = Column(Integer, default=0)
    num_chunks = Column(Integer, default=0)
    processing_status = Column(
        SAEnum(ProcessingStatus),
        default=ProcessingStatus.PENDING,
        nullable=False,
    )
    processing_error = Column(Text, nullable=True)
    text_length = Column(Integer, default=0)
    upload_path = Column(String(1000), nullable=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_documents_status", "processing_status"),
        Index("ix_documents_created", "created_at"),
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True, default=generate_uuid)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    text_length = Column(Integer, default=0)
    embedding_id = Column(String, nullable=True)  # reference into FAISS index
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    document = relationship("Document", back_populates="chunks")

    __table_args__ = (
        Index("ix_chunks_document", "document_id"),
        Index("ix_chunks_page", "document_id", "page_number"),
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String(500), default="New Conversation")
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    document = relationship("Document", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan",
                            order_by="Message.created_at")

    __table_args__ = (
        Index("ix_conversations_updated", "updated_at"),
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(SAEnum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)  # JSON string of source citations
    token_usage = Column(Integer, nullable=True)
    model_used = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("ix_messages_conversation", "conversation_id"),
    )


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(String, primary_key=True, default=generate_uuid)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    job_type = Column(String(50), nullable=False)  # "extraction", "embedding", "indexing"
    status = Column(SAEnum(ProcessingStatus), default=ProcessingStatus.PENDING)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    __table_args__ = (
        Index("ix_jobs_document", "document_id"),
    )


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(200), primary_key=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
