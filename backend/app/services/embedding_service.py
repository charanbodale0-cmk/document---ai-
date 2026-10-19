"""
DocuMind AI — Embedding Service
Generates text embeddings using Sentence Transformers and manages FAISS vector index.
"""

import os
import json
import logging
import numpy as np
import faiss
from typing import List, Optional, Tuple
from sentence_transformers import SentenceTransformer
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Handles text embedding generation and FAISS vector index management."""

    _model: Optional[SentenceTransformer] = None
    _index: Optional[faiss.IndexFlatIP] = None
    _id_map: List[str] = []  # Maps FAISS row index -> chunk_id
    _dimension: int = 384  # MiniLM-L6-v2 dimension

    @classmethod
    def get_model(cls) -> SentenceTransformer:
        """Lazy-load the embedding model."""
        if cls._model is None:
            logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
            cls._model = SentenceTransformer(settings.EMBEDDING_MODEL)
            cls._dimension = cls._model.get_sentence_embedding_dimension()
            logger.info(f"Embedding model loaded. Dimension: {cls._dimension}")
        return cls._model

    @classmethod
    def get_index(cls) -> faiss.IndexFlatIP:
        """Get or create FAISS index. Uses Inner Product (cosine sim on normalized vectors)."""
        if cls._index is None:
            index_path = settings.vector_store_path / "faiss.index"
            map_path = settings.vector_store_path / "id_map.json"

            if index_path.exists() and map_path.exists():
                logger.info("Loading existing FAISS index...")
                cls._index = faiss.read_index(str(index_path))
                with open(map_path, "r") as f:
                    cls._id_map = json.load(f)
                logger.info(f"Loaded FAISS index with {cls._index.ntotal} vectors.")
            else:
                # Ensure model is loaded to get correct dimension
                cls.get_model()
                logger.info(f"Creating new FAISS index (dim={cls._dimension})...")
                cls._index = faiss.IndexFlatIP(cls._dimension)
                cls._id_map = []

        return cls._index

    @classmethod
    def save_index(cls):
        """Persist the FAISS index and id map to disk."""
        if cls._index is not None:
            index_path = settings.vector_store_path / "faiss.index"
            map_path = settings.vector_store_path / "id_map.json"

            faiss.write_index(cls._index, str(index_path))
            with open(map_path, "w") as f:
                json.dump(cls._id_map, f)
            logger.info(f"Saved FAISS index with {cls._index.ntotal} vectors.")

    @classmethod
    def generate_embeddings(cls, texts: List[str]) -> np.ndarray:
        """Generate normalized embeddings for a list of texts."""
        model = cls.get_model()
        embeddings = model.encode(
            texts,
            show_progress_bar=False,
            normalize_embeddings=True,  # For cosine similarity with IndexFlatIP
            batch_size=32,
        )
        return np.array(embeddings, dtype=np.float32)

    @classmethod
    def add_to_index(cls, chunk_ids: List[str], embeddings: np.ndarray):
        """Add embeddings to the FAISS index."""
        index = cls.get_index()
        index.add(embeddings)
        cls._id_map.extend(chunk_ids)
        cls.save_index()
        logger.info(f"Added {len(chunk_ids)} vectors. Total: {index.ntotal}")

    @classmethod
    def search(
        cls,
        query_text: str,
        top_k: int = None,
        chunk_ids_filter: Optional[List[str]] = None,
    ) -> List[Tuple[str, float]]:
        """
        Search the FAISS index for similar chunks.
        Returns list of (chunk_id, score) tuples.
        If chunk_ids_filter is provided, only return matches from those chunks.
        """
        top_k = top_k or settings.TOP_K_RESULTS
        index = cls.get_index()

        if index.ntotal == 0:
            return []

        query_embedding = cls.generate_embeddings([query_text])

        # Search more results if we need to filter
        search_k = min(top_k * 5, index.ntotal) if chunk_ids_filter else min(top_k, index.ntotal)

        scores, indices = index.search(query_embedding, search_k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(cls._id_map):
                continue
            chunk_id = cls._id_map[idx]

            # Apply filter if provided
            if chunk_ids_filter and chunk_id not in chunk_ids_filter:
                continue

            # Apply similarity threshold
            if score < settings.SIMILARITY_THRESHOLD:
                continue

            results.append((chunk_id, float(score)))

            if len(results) >= top_k:
                break

        return results

    @classmethod
    def remove_chunks(cls, chunk_ids_to_remove: List[str]):
        """
        Remove chunks from the index by rebuilding without them.
        FAISS IndexFlatIP doesn't support direct removal.
        """
        if not chunk_ids_to_remove or cls._index is None:
            return

        remove_set = set(chunk_ids_to_remove)
        keep_indices = []
        new_id_map = []

        for i, cid in enumerate(cls._id_map):
            if cid not in remove_set:
                keep_indices.append(i)
                new_id_map.append(cid)

        if not keep_indices:
            # All vectors removed — reset index
            cls._index = faiss.IndexFlatIP(cls._dimension)
            cls._id_map = []
            cls.save_index()
            return

        # Reconstruct vectors for kept items
        old_index = cls._index
        vectors = np.zeros((len(keep_indices), cls._dimension), dtype=np.float32)
        for new_i, old_i in enumerate(keep_indices):
            vectors[new_i] = old_index.reconstruct(old_i)

        # Create new index
        new_index = faiss.IndexFlatIP(cls._dimension)
        new_index.add(vectors)

        cls._index = new_index
        cls._id_map = new_id_map
        cls.save_index()
        logger.info(f"Removed {len(chunk_ids_to_remove)} vectors. Remaining: {new_index.ntotal}")

    @classmethod
    def reset(cls):
        """Reset the service state (used in testing)."""
        cls._model = None
        cls._index = None
        cls._id_map = []
