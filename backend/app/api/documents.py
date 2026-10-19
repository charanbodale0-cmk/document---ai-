"""
DocuMind AI — Document API Routes
Handles upload, listing, retrieval, deletion, retry, summary, comparison,
study questions, and information extraction.
"""

import os
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import List
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.session import get_db
from app.models.models import Document, DocumentChunk, ProcessingStatus, ProcessingJob
from app.schemas.schemas import (
    DocumentOut, DocumentListOut, SummaryRequest, SummaryResponse,
    CompareRequest, CompareResponse, StudyRequest, StudyResponse,
    ExtractionRequest, ExtractionResponse, SourceCitation,
)
from app.services.document_processor import DocumentProcessor
from app.services.embedding_service import EmbeddingService
from app.services.retrieval_service import RetrievalService
from app.services.claude_service import get_ai_service
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["Documents"])

processor = DocumentProcessor()


def _secure_filename(filename: str) -> str:
    """Generate a safe filename preserving extension."""
    ext = Path(filename).suffix.lower()
    safe_name = f"{uuid.uuid4().hex}{ext}"
    return safe_name


def _process_document(doc_id: str, file_path: str, db: Session):
    """
    Process a PDF document: extract text, chunk, embed, index.
    Updates the document record in-place.
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        return

    doc.processing_status = ProcessingStatus.PROCESSING
    db.commit()

    try:
        # Step 1: Extract text
        pages, metadata = processor.extract_text_from_pdf(file_path)
        doc.num_pages = metadata["num_pages"]
        doc.text_length = metadata["text_length"]

        # Step 2: Chunk
        chunks = processor.chunk_pages(pages)
        if not chunks:
            raise ValueError("No text chunks could be created from this document.")

        # Step 3: Store chunks in DB
        db_chunks = []
        chunk_texts = []
        chunk_ids = []

        for chunk in chunks:
            db_chunk = DocumentChunk(
                document_id=doc_id,
                chunk_index=chunk.chunk_index,
                page_number=chunk.page_number,
                text=chunk.text,
                text_length=chunk.text_length,
            )
            db.add(db_chunk)
            db.flush()  # get the ID
            db_chunks.append(db_chunk)
            chunk_texts.append(chunk.text)
            chunk_ids.append(db_chunk.id)

        # Step 4: Generate embeddings
        embeddings = EmbeddingService.generate_embeddings(chunk_texts)

        # Step 5: Add to FAISS index
        EmbeddingService.add_to_index(chunk_ids, embeddings)

        # Update embedding_id references
        for db_chunk, cid in zip(db_chunks, chunk_ids):
            db_chunk.embedding_id = cid

        doc.num_chunks = len(db_chunks)
        doc.processing_status = ProcessingStatus.COMPLETED
        doc.processing_error = None

        # Check for warnings
        if metadata.get("warning"):
            doc.processing_status = ProcessingStatus.PARTIAL
            doc.processing_error = metadata["warning"]

        db.commit()
        logger.info(f"Document {doc_id} processed: {len(chunks)} chunks, {doc.num_pages} pages")

    except ValueError as e:
        doc.processing_status = ProcessingStatus.FAILED
        doc.processing_error = str(e)
        db.commit()
        logger.error(f"Document {doc_id} processing failed: {e}")

    except Exception as e:
        doc.processing_status = ProcessingStatus.FAILED
        doc.processing_error = f"Processing error: {str(e)}"
        db.commit()
        logger.error(f"Document {doc_id} processing error: {e}")


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload and process a PDF document."""
    # Validate extension
    ext = Path(file.filename or "").suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    # Validate content type
    if file.content_type and "pdf" not in file.content_type.lower():
        raise HTTPException(
            status_code=400,
            detail="File content type does not appear to be a PDF."
        )

    # Read file
    content = await file.read()
    file_size = len(content)

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if file_size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File size ({file_size / 1024 / 1024:.1f} MB) exceeds limit ({settings.MAX_FILE_SIZE_MB} MB)."
        )

    # Save file
    safe_name = _secure_filename(file.filename or "document.pdf")
    upload_path = settings.upload_path / safe_name

    with open(upload_path, "wb") as f:
        f.write(content)

    # Validate PDF structure
    validation_error = processor.validate_pdf(str(upload_path), file_size)
    if validation_error:
        os.remove(upload_path)
        raise HTTPException(status_code=400, detail=validation_error)

    # Create DB record
    doc = Document(
        filename=safe_name,
        original_filename=file.filename or "document.pdf",
        file_size=file_size,
        file_type=file.content_type or "application/pdf",
        upload_path=str(upload_path),
        processing_status=ProcessingStatus.PENDING,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Process document (synchronous for simplicity — can be moved to background task)
    _process_document(doc.id, str(upload_path), db)
    db.refresh(doc)

    return doc


@router.get("", response_model=DocumentListOut)
def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=200),
    status: str = Query("", max_length=50),
    sort_by: str = Query("created_at", max_length=50),
    sort_order: str = Query("desc", max_length=10),
    db: Session = Depends(get_db),
):
    """List documents with search, filters, sorting, and pagination."""
    query = db.query(Document)

    if search:
        query = query.filter(
            Document.original_filename.ilike(f"%{search}%")
        )

    if status:
        try:
            ps = ProcessingStatus(status)
            query = query.filter(Document.processing_status == ps)
        except ValueError:
            pass

    # Sorting
    sort_col = getattr(Document, sort_by, Document.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    total = query.count()
    documents = query.offset(skip).limit(limit).all()

    return DocumentListOut(documents=documents, total=total)


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: str, db: Session = Depends(get_db)):
    """Get a specific document's details."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


@router.delete("/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    """Delete a document and all associated chunks and vector records."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Get chunk IDs for vector index cleanup
    chunk_ids = [c.id for c in db.query(DocumentChunk.id).filter(
        DocumentChunk.document_id == document_id
    ).all()]

    # Remove from FAISS
    if chunk_ids:
        try:
            EmbeddingService.remove_chunks(chunk_ids)
        except Exception as e:
            logger.warning(f"Error removing vectors: {e}")

    # Remove uploaded file
    if doc.upload_path and os.path.exists(doc.upload_path):
        try:
            os.remove(doc.upload_path)
        except Exception as e:
            logger.warning(f"Error removing file: {e}")

    # Cascade delete handles chunks, conversations, messages
    db.delete(doc)
    db.commit()

    return {"status": "deleted", "document_id": document_id}


@router.post("/{document_id}/retry", response_model=DocumentOut)
def retry_processing(document_id: str, db: Session = Depends(get_db)):
    """Retry processing a failed document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if doc.processing_status not in (ProcessingStatus.FAILED, ProcessingStatus.PARTIAL):
        raise HTTPException(
            status_code=400,
            detail="Document is not in a failed or partial state."
        )

    # Remove old chunks and vectors
    old_chunk_ids = [c.id for c in db.query(DocumentChunk.id).filter(
        DocumentChunk.document_id == document_id
    ).all()]
    if old_chunk_ids:
        EmbeddingService.remove_chunks(old_chunk_ids)
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
    db.commit()

    # Re-process
    _process_document(doc.id, doc.upload_path, db)
    db.refresh(doc)
    return doc


# ── Summary ───────────────────────────────────────────────────────

@router.post("/{document_id}/summary", response_model=SummaryResponse)
def summarize_document(
    document_id: str,
    request: SummaryRequest,
    db: Session = Depends(get_db),
):
    """Generate a summary for a document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    if doc.processing_status not in (ProcessingStatus.COMPLETED, ProcessingStatus.PARTIAL):
        raise HTTPException(status_code=400, detail="Document has not been processed yet.")

    sources = RetrievalService.get_document_chunks_text(db, document_id, max_chunks=30)
    if not sources:
        raise HTTPException(status_code=400, detail="No text chunks available for this document.")

    ai = get_ai_service()
    result = ai.summarize(sources, summary_type=request.summary_type)

    is_demo = not settings.has_api_key or settings.DEMO_MODE

    return SummaryResponse(
        summary=result["answer"],
        document_id=document_id,
        document_name=doc.original_filename,
        summary_type=request.summary_type,
        sources=sources[:5],
        is_demo=is_demo,
    )


# ── Comparison ────────────────────────────────────────────────────

@router.post("/compare", response_model=CompareResponse)
def compare_documents(
    request: CompareRequest,
    db: Session = Depends(get_db),
):
    """Compare two or more documents."""
    docs = db.query(Document).filter(Document.id.in_(request.document_ids)).all()

    if len(docs) < 2:
        raise HTTPException(status_code=400, detail="At least 2 valid documents are required.")

    for doc in docs:
        if doc.processing_status not in (ProcessingStatus.COMPLETED, ProcessingStatus.PARTIAL):
            raise HTTPException(
                status_code=400,
                detail=f"Document '{doc.original_filename}' has not been processed."
            )

    sources_by_doc = {}
    all_sources = []
    for doc in docs:
        doc_sources = RetrievalService.get_document_chunks_text(db, doc.id, max_chunks=15)
        sources_by_doc[doc.original_filename] = doc_sources
        all_sources.extend(doc_sources)

    ai = get_ai_service()
    result = ai.compare_documents(sources_by_doc)

    is_demo = not settings.has_api_key or settings.DEMO_MODE

    return CompareResponse(
        comparison=result["answer"],
        document_names=[d.original_filename for d in docs],
        sources=all_sources[:10],
        is_demo=is_demo,
    )


# ── Study Questions ───────────────────────────────────────────────

@router.post("/{document_id}/study-questions", response_model=StudyResponse)
def generate_study_questions(
    document_id: str,
    request: StudyRequest,
    db: Session = Depends(get_db),
):
    """Generate study questions from a document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    if doc.processing_status not in (ProcessingStatus.COMPLETED, ProcessingStatus.PARTIAL):
        raise HTTPException(status_code=400, detail="Document has not been processed yet.")

    sources = RetrievalService.get_document_chunks_text(db, document_id, max_chunks=20)
    ai = get_ai_service()
    result = ai.generate_study_questions(
        sources,
        question_type=request.question_type,
        num_questions=request.num_questions,
    )

    is_demo = not settings.has_api_key or settings.DEMO_MODE

    return StudyResponse(
        questions=result["answer"],
        document_id=document_id,
        document_name=doc.original_filename,
        is_demo=is_demo,
    )


# ── Information Extraction ────────────────────────────────────────

@router.post("/{document_id}/extract", response_model=ExtractionResponse)
def extract_information(
    document_id: str,
    request: ExtractionRequest,
    db: Session = Depends(get_db),
):
    """Extract specific information from a document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    if doc.processing_status not in (ProcessingStatus.COMPLETED, ProcessingStatus.PARTIAL):
        raise HTTPException(status_code=400, detail="Document has not been processed yet.")

    sources = RetrievalService.get_document_chunks_text(db, document_id, max_chunks=20)
    ai = get_ai_service()
    result = ai.extract_information(sources, extraction_type=request.extraction_type)

    is_demo = not settings.has_api_key or settings.DEMO_MODE

    return ExtractionResponse(
        extracted_data=result["answer"],
        document_id=document_id,
        document_name=doc.original_filename,
        is_demo=is_demo,
    )
