"""
DocuMind AI — Document Processor
Extracts text from PDFs, splits into overlapping chunks, preserves page numbers.
"""

import fitz  # PyMuPDF
import re
import logging
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class PageText:
    page_number: int
    text: str


@dataclass
class TextChunk:
    chunk_index: int
    page_number: int
    text: str
    text_length: int


class DocumentProcessor:
    """Handles PDF text extraction and chunking."""

    def __init__(
        self,
        chunk_size: int = None,
        chunk_overlap: int = None,
    ):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    def extract_text_from_pdf(self, file_path: str) -> Tuple[List[PageText], Dict]:
        """
        Extract text from a PDF file.
        Returns a list of PageText objects and document metadata.
        Raises ValueError for encrypted, empty, or corrupt files.
        """
        try:
            doc = fitz.open(file_path)
        except Exception as e:
            raise ValueError(f"Could not open PDF file: {str(e)}")

        if doc.is_encrypted:
            doc.close()
            raise ValueError(
                "This PDF is encrypted or password-protected. "
                "Please provide an unencrypted version."
            )

        num_pages = len(doc)
        if num_pages == 0:
            doc.close()
            raise ValueError("This PDF has no pages.")

        metadata = {
            "num_pages": num_pages,
            "title": doc.metadata.get("title", ""),
            "author": doc.metadata.get("author", ""),
            "subject": doc.metadata.get("subject", ""),
            "creator": doc.metadata.get("creator", ""),
        }

        pages: List[PageText] = []
        total_text_length = 0

        for page_num in range(num_pages):
            page = doc[page_num]
            text = page.get_text("text")
            # Clean up extraction artifacts
            text = self._clean_text(text)
            pages.append(PageText(page_number=page_num + 1, text=text))
            total_text_length += len(text)

        doc.close()

        metadata["text_length"] = total_text_length

        # Detect scanned PDFs with insufficient text
        if total_text_length < 50:
            raise ValueError(
                "Very little or no text could be extracted from this PDF. "
                "The document may contain scanned images that require OCR. "
                "OCR processing is not currently enabled."
            )

        # Warn about potentially scanned pages
        empty_pages = sum(1 for p in pages if len(p.text.strip()) < 10)
        if empty_pages > num_pages * 0.5:
            metadata["warning"] = (
                f"{empty_pages} of {num_pages} pages had very little text. "
                "Some pages may be scanned images."
            )

        return pages, metadata

    def chunk_pages(self, pages: List[PageText]) -> List[TextChunk]:
        """
        Split page text into overlapping chunks.
        Each chunk retains its source page number.
        """
        chunks: List[TextChunk] = []
        chunk_index = 0

        for page in pages:
            text = page.text.strip()
            if not text:
                continue

            # Split into sentences for smarter chunking
            sentences = self._split_into_sentences(text)
            current_chunk = ""

            for sentence in sentences:
                if len(current_chunk) + len(sentence) > self.chunk_size and current_chunk:
                    chunks.append(TextChunk(
                        chunk_index=chunk_index,
                        page_number=page.page_number,
                        text=current_chunk.strip(),
                        text_length=len(current_chunk.strip()),
                    ))
                    chunk_index += 1

                    # Overlap: keep tail of current chunk
                    if self.chunk_overlap > 0:
                        overlap_text = current_chunk[-self.chunk_overlap:]
                        current_chunk = overlap_text + " " + sentence
                    else:
                        current_chunk = sentence
                else:
                    current_chunk += (" " if current_chunk else "") + sentence

            # Flush remaining text
            if current_chunk.strip():
                chunks.append(TextChunk(
                    chunk_index=chunk_index,
                    page_number=page.page_number,
                    text=current_chunk.strip(),
                    text_length=len(current_chunk.strip()),
                ))
                chunk_index += 1

        return chunks

    def _clean_text(self, text: str) -> str:
        """Clean extracted text."""
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove excessive newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        # Remove null chars
        text = text.replace('\x00', '')
        return text.strip()

    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences using regex."""
        # Simple sentence splitter
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s for s in sentences if s.strip()]

    def validate_pdf(self, file_path: str, file_size: int) -> Optional[str]:
        """
        Validate a PDF file before processing.
        Returns None if valid, error message string if invalid.
        """
        if file_size > settings.max_file_size_bytes:
            return f"File size ({file_size / 1024 / 1024:.1f} MB) exceeds limit ({settings.MAX_FILE_SIZE_MB} MB)."

        try:
            doc = fitz.open(file_path)
            if doc.is_encrypted:
                doc.close()
                return "PDF is encrypted or password-protected."
            if len(doc) == 0:
                doc.close()
                return "PDF has no pages."
            doc.close()
        except Exception as e:
            return f"Invalid or corrupted PDF: {str(e)}"

        return None
