"""RAG Index Data Structures."""

from __future__ import annotations

from typing import Any
import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer

from app.rag.extractor import DocumentChunk


class HybridRAGIndex:
    """Hybrid Sparse + Dense Semantic Retrieval Index for NCERT Chunks."""

    def __init__(
        self,
        chunks: list[DocumentChunk],
        tfidf: TfidfVectorizer,
        svd: TruncatedSVD,
        sparse_matrix: Any,
        dense_matrix: np.ndarray,
        stats: dict[str, Any],
    ) -> None:
        self.chunks = chunks
        self.tfidf = tfidf
        self.svd = svd
        self.sparse_matrix = sparse_matrix
        self.dense_matrix = dense_matrix
        self.stats = stats

    def retrieve(
        self,
        query: str,
        top_k: int = 3,
        min_score: float = 0.08,
    ) -> list[tuple[DocumentChunk, float]]:
        """Retrieves top-k relevant chunks with score thresholding for out-of-domain detection."""
        if not query.strip() or not self.chunks:
            return []

        # Sparse scoring
        q_sparse = self.tfidf.transform([query])
        sparse_scores = (self.sparse_matrix * q_sparse.T).toarray().ravel()

        # Dense semantic scoring
        q_dense = self.svd.transform(q_sparse)
        dense_norm = np.linalg.norm(q_dense) + 1e-9
        mat_norm = np.linalg.norm(self.dense_matrix, axis=1) + 1e-9
        dense_scores = (self.dense_matrix @ q_dense.T).ravel() / (mat_norm * dense_norm)

        # Hybrid fusion: 60% Sparse (exact terminology like "mitochondria", "inertia") + 40% Dense (semantic)
        combined_scores = 0.6 * sparse_scores + 0.4 * np.maximum(dense_scores, 0)

        # Rank and filter
        ranked_indices = np.argsort(-combined_scores)
        results: list[tuple[DocumentChunk, float]] = []

        for idx in ranked_indices[: top_k * 2]:
            score = float(combined_scores[idx])
            if score >= min_score:
                results.append((self.chunks[idx], round(score, 4)))
            if len(results) >= top_k:
                break

        return results
