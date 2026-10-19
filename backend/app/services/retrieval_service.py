"""
DocuMind AI — Retrieval Service
Orchestrates RAG: embeds query, searches vector index, fetches chunk text from DB.
"""

import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.models import DocumentChunk, Document
from app.schemas.schemas import SourceCitation
from app.services.embedding_service import EmbeddingService
from app.core.config import settings

logger = logging.getLogger(__name__)


class RetrievalService:
    """Retrieves relevant document chunks for a given query."""

    @staticmethod
    def retrieve(
        db: Session,
        query: str,
        document_id: Optional[str] = None,
        top_k: int = None,
    ) -> List[SourceCitation]:
        """
        Run semantic search and return enriched source citations.
        If document_id is given, restrict search to that document's chunks.
        """
        top_k = top_k or settings.TOP_K_RESULTS

        # Get chunk IDs for filtering if document-scoped
        chunk_ids_filter = None
        if document_id:
            chunks = db.query(DocumentChunk.id).filter(
                DocumentChunk.document_id == document_id
            ).all()
            chunk_ids_filter = [c.id for c in chunks]

            if not chunk_ids_filter:
                logger.warning(f"No chunks found for document {document_id}")
                return []

        # Search the vector index
        results = EmbeddingService.search(
            query_text=query,
            top_k=top_k,
            chunk_ids_filter=chunk_ids_filter,
        )

        if not results:
            return []

        # Fetch chunk details from DB
        chunk_ids = [cid for cid, _ in results]
        score_map = {cid: score for cid, score in results}

        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.id.in_(chunk_ids)
        ).all()

        # Build enriched citations
        citations: List[SourceCitation] = []
        for chunk in chunks:
            doc = db.query(Document).filter(Document.id == chunk.document_id).first()
            citations.append(SourceCitation(
                document_id=chunk.document_id,
                document_name=doc.original_filename if doc else "Unknown",
                page_number=chunk.page_number,
                chunk_id=chunk.id,
                text=chunk.text,
                relevance_score=score_map.get(chunk.id, 0.0),
            ))

        # Sort by relevance score descending
        citations.sort(key=lambda c: c.relevance_score, reverse=True)
        return citations

    @staticmethod
    def get_document_chunks_text(
        db: Session,
        document_id: str,
        max_chunks: int = 20,
    ) -> List[SourceCitation]:
        """Get chunks from a specific document (for summarization, etc.)."""
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).order_by(DocumentChunk.chunk_index).limit(max_chunks).all()

        doc = db.query(Document).filter(Document.id == document_id).first()
        doc_name = doc.original_filename if doc else "Unknown"

        return [
            SourceCitation(
                document_id=chunk.document_id,
                document_name=doc_name,
                page_number=chunk.page_number,
                chunk_id=chunk.id,
                text=chunk.text,
                relevance_score=1.0,
            )
            for chunk in chunks
        ]
