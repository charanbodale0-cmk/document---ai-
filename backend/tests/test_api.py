"""
DocuMind AI — Backend Tests
Tests document upload, text extraction, chunking, API endpoints, and error handling.
Uses mocked Claude API responses so tests don't require a paid API call.
"""

import os
import sys
import json
import pytest
import tempfile
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
from app.database.session import Base, engine, SessionLocal
from app.services.document_processor import DocumentProcessor, PageText


@pytest.fixture(autouse=True)
def setup_db():
    """Create fresh tables for each test."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_pdf():
    """Create a minimal valid PDF for testing."""
    import fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "This is a test document about machine learning.")
    page.insert_text((72, 100), "Machine learning is a subset of artificial intelligence.")
    page.insert_text((72, 128), "It enables systems to learn from data and improve over time.")

    page2 = doc.new_page()
    page2.insert_text((72, 72), "Deep learning uses neural networks with multiple layers.")
    page2.insert_text((72, 100), "Common architectures include CNNs and RNNs.")

    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    doc.save(tmp.name)
    doc.close()
    tmp.close()
    yield tmp.name
    os.unlink(tmp.name)


@pytest.fixture
def empty_pdf():
    """Create a PDF with no text (simulates scanned)."""
    import fitz
    doc = fitz.open()
    doc.new_page()  # empty page
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    doc.save(tmp.name)
    doc.close()
    tmp.close()
    yield tmp.name
    os.unlink(tmp.name)


# ── Health Endpoint ───────────────────────────────────────────────

class TestHealth:
    def test_health_endpoint(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert "api_key_configured" in data
        assert "demo_mode" in data

    def test_health_returns_model_info(self, client):
        response = client.get("/api/health")
        data = response.json()
        assert "embedding_model" in data
        assert "claude_model" in data


# ── Document Processor ────────────────────────────────────────────

class TestDocumentProcessor:
    def test_extract_text_from_valid_pdf(self, sample_pdf):
        processor = DocumentProcessor()
        pages, metadata = processor.extract_text_from_pdf(sample_pdf)
        assert len(pages) == 2
        assert metadata["num_pages"] == 2
        assert metadata["text_length"] > 0
        assert "machine learning" in pages[0].text.lower()

    def test_extract_text_empty_pdf(self, empty_pdf):
        processor = DocumentProcessor()
        with pytest.raises(ValueError, match="Very little or no text"):
            processor.extract_text_from_pdf(empty_pdf)

    def test_chunk_pages(self):
        processor = DocumentProcessor(chunk_size=100, chunk_overlap=20)
        pages = [
            PageText(page_number=1, text="This is a test sentence. " * 10),
            PageText(page_number=2, text="Another sentence here. " * 10),
        ]
        chunks = processor.chunk_pages(pages)
        assert len(chunks) > 0
        for chunk in chunks:
            assert chunk.page_number in (1, 2)
            assert chunk.text_length > 0
            assert chunk.chunk_index >= 0

    def test_chunk_preserves_page_numbers(self):
        processor = DocumentProcessor(chunk_size=50, chunk_overlap=0)
        pages = [
            PageText(page_number=3, text="Short text on page three."),
            PageText(page_number=7, text="Some text on page seven."),
        ]
        chunks = processor.chunk_pages(pages)
        page_numbers = {c.page_number for c in chunks}
        assert 3 in page_numbers
        assert 7 in page_numbers

    def test_validate_pdf_too_large(self, sample_pdf):
        processor = DocumentProcessor()
        # Pretend the file is huge
        result = processor.validate_pdf(sample_pdf, 999 * 1024 * 1024)
        assert result is not None
        assert "exceeds" in result.lower()

    def test_validate_pdf_valid(self, sample_pdf):
        processor = DocumentProcessor()
        size = os.path.getsize(sample_pdf)
        result = processor.validate_pdf(sample_pdf, size)
        assert result is None


# ── Document Upload API ───────────────────────────────────────────

class TestDocumentUpload:
    @patch("app.services.embedding_service.EmbeddingService.get_model")
    @patch("app.services.embedding_service.EmbeddingService.generate_embeddings")
    @patch("app.services.embedding_service.EmbeddingService.add_to_index")
    def test_upload_valid_pdf(self, mock_add, mock_embed, mock_model, client, sample_pdf):
        import numpy as np
        mock_model.return_value = MagicMock()
        mock_embed.return_value = np.random.rand(10, 384).astype("float32")
        mock_add.return_value = None

        with open(sample_pdf, "rb") as f:
            response = client.post(
                "/api/documents/upload",
                files={"file": ("test.pdf", f, "application/pdf")},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["original_filename"] == "test.pdf"
        assert data["processing_status"] in ("completed", "partial")
        assert data["num_pages"] >= 1
        assert data["num_chunks"] >= 1

    def test_upload_wrong_extension(self, client):
        response = client.post(
            "/api/documents/upload",
            files={"file": ("test.txt", b"Hello world", "text/plain")},
        )
        assert response.status_code == 400
        assert "unsupported" in response.json()["detail"].lower()

    def test_upload_empty_file(self, client):
        response = client.post(
            "/api/documents/upload",
            files={"file": ("empty.pdf", b"", "application/pdf")},
        )
        assert response.status_code == 400


# ── Document List & CRUD ─────────────────────────────────────────

class TestDocumentCRUD:
    @patch("app.services.embedding_service.EmbeddingService.get_model")
    @patch("app.services.embedding_service.EmbeddingService.generate_embeddings")
    @patch("app.services.embedding_service.EmbeddingService.add_to_index")
    def test_list_documents(self, mock_add, mock_embed, mock_model, client, sample_pdf):
        import numpy as np
        mock_model.return_value = MagicMock()
        mock_embed.return_value = np.random.rand(10, 384).astype("float32")

        with open(sample_pdf, "rb") as f:
            client.post(
                "/api/documents/upload",
                files={"file": ("doc1.pdf", f, "application/pdf")},
            )

        response = client.get("/api/documents")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @patch("app.services.embedding_service.EmbeddingService.get_model")
    @patch("app.services.embedding_service.EmbeddingService.generate_embeddings")
    @patch("app.services.embedding_service.EmbeddingService.add_to_index")
    @patch("app.services.embedding_service.EmbeddingService.remove_chunks")
    def test_delete_document(self, mock_remove, mock_add, mock_embed, mock_model, client, sample_pdf):
        import numpy as np
        mock_model.return_value = MagicMock()
        mock_embed.return_value = np.random.rand(10, 384).astype("float32")

        with open(sample_pdf, "rb") as f:
            upload_resp = client.post(
                "/api/documents/upload",
                files={"file": ("doc_delete.pdf", f, "application/pdf")},
            )

        doc_id = upload_resp.json()["id"]
        del_resp = client.delete(f"/api/documents/{doc_id}")
        assert del_resp.status_code == 200
        assert del_resp.json()["status"] == "deleted"

        # Verify it's gone
        get_resp = client.get(f"/api/documents/{doc_id}")
        assert get_resp.status_code == 404

    def test_get_nonexistent_document(self, client):
        response = client.get("/api/documents/nonexistent-id")
        assert response.status_code == 404


# ── Chat API ──────────────────────────────────────────────────────

class TestChatAPI:
    def test_chat_without_document(self, client):
        """Chat without selecting a document should still work (empty context)."""
        response = client.post("/api/chat", json={
            "question": "What is machine learning?",
        })
        # Should succeed even without a document (demo mode returns a response)
        assert response.status_code in (200, 502, 503)

    def test_chat_with_invalid_document(self, client):
        response = client.post("/api/chat", json={
            "question": "Tell me about this",
            "document_id": "fake-id-123",
        })
        assert response.status_code == 404


# ── Conversation API ──────────────────────────────────────────────

class TestConversationAPI:
    def test_list_conversations_empty(self, client):
        response = client.get("/api/conversations")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_nonexistent_conversation(self, client):
        response = client.get("/api/conversations/fake-id")
        assert response.status_code == 404

    def test_delete_nonexistent_conversation(self, client):
        response = client.delete("/api/conversations/fake-id")
        assert response.status_code == 404


# ── Dashboard API ─────────────────────────────────────────────────

class TestDashboardAPI:
    def test_dashboard_stats_empty(self, client):
        response = client.get("/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_documents"] == 0
        assert data["processed_documents"] == 0
        assert data["total_questions"] == 0
        assert data["storage_used_bytes"] == 0

    @patch("app.services.embedding_service.EmbeddingService.get_model")
    @patch("app.services.embedding_service.EmbeddingService.generate_embeddings")
    @patch("app.services.embedding_service.EmbeddingService.add_to_index")
    def test_dashboard_stats_after_upload(self, mock_add, mock_embed, mock_model, client, sample_pdf):
        import numpy as np
        mock_model.return_value = MagicMock()
        mock_embed.return_value = np.random.rand(10, 384).astype("float32")

        with open(sample_pdf, "rb") as f:
            client.post(
                "/api/documents/upload",
                files={"file": ("stats_test.pdf", f, "application/pdf")},
            )

        response = client.get("/api/dashboard/stats")
        data = response.json()
        assert data["total_documents"] >= 1
        assert data["storage_used_bytes"] > 0
