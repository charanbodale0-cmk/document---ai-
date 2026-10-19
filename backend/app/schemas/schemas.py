"""
DocuMind AI — Pydantic Schemas for API request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Document Schemas ──────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: str
    filename: str
    original_filename: str
    file_size: int
    file_type: str
    num_pages: int
    num_chunks: int
    processing_status: str
    processing_error: Optional[str] = None
    text_length: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentListOut(BaseModel):
    documents: List[DocumentOut]
    total: int


# ── Chat Schemas ──────────────────────────────────────────────────

class SourceCitation(BaseModel):
    document_id: str
    document_name: str
    page_number: int
    chunk_id: str
    text: str
    relevance_score: float = 0.0


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=5000)
    document_id: Optional[str] = None
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceCitation]
    conversation_id: str
    message_id: str
    model_used: Optional[str] = None
    token_usage: Optional[int] = None
    is_demo: bool = False


# ── Conversation Schemas ──────────────────────────────────────────

class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    sources: Optional[str] = None  # JSON string
    token_usage: Optional[int] = None
    model_used: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    id: str
    title: str
    document_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    document_name: Optional[str] = None

    class Config:
        from_attributes = True


class ConversationDetailOut(BaseModel):
    id: str
    title: str
    document_id: Optional[str] = None
    document_name: Optional[str] = None
    messages: List[MessageOut]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationRenameRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)


# ── Summary Schemas ───────────────────────────────────────────────

class SummaryRequest(BaseModel):
    summary_type: str = "short"  # "short", "detailed", "key_points", "terms"


class SummaryResponse(BaseModel):
    summary: str
    document_id: str
    document_name: str
    summary_type: str
    sources: List[SourceCitation] = []
    is_demo: bool = False


# ── Comparison Schemas ────────────────────────────────────────────

class CompareRequest(BaseModel):
    document_ids: List[str] = Field(..., min_length=2, max_length=5)


class CompareResponse(BaseModel):
    comparison: str
    document_names: List[str]
    sources: List[SourceCitation] = []
    is_demo: bool = False


# ── Study Mode Schemas ────────────────────────────────────────────

class StudyRequest(BaseModel):
    question_type: str = "mixed"  # "flashcards", "mcq", "short_answer", "mixed"
    num_questions: int = Field(default=5, ge=1, le=20)


class StudyResponse(BaseModel):
    questions: str  # formatted markdown
    document_id: str
    document_name: str
    is_demo: bool = False


# ── Extraction Schemas ────────────────────────────────────────────

class ExtractionRequest(BaseModel):
    extraction_type: str = "all"  # "dates", "names", "terms", "requirements", "numbers", "all"


class ExtractionResponse(BaseModel):
    extracted_data: str  # formatted markdown
    document_id: str
    document_name: str
    is_demo: bool = False


# ── Dashboard Schemas ─────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_documents: int = 0
    processed_documents: int = 0
    total_conversations: int = 0
    total_messages: int = 0
    total_questions: int = 0
    storage_used_bytes: int = 0
    recent_documents: List[DocumentOut] = []
    recent_conversations: List[ConversationOut] = []
    processing_success_rate: float = 0.0


# ── Health Schemas ────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str
    api_key_configured: bool
    demo_mode: bool
    embedding_model: str
    claude_model: str
