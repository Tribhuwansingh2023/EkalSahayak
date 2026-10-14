"""NCERT RAG Retriever Module.

Loads the hybrid sparse + dense index and performs top-k semantic retrieval with score thresholding
for out-of-curriculum detection.
"""

from __future__ import annotations

import logging
import pickle
import time
from pathlib import Path
from typing import Any

from app.rag.index import HybridRAGIndex
from app.rag.extractor import DocumentChunk

logger = logging.getLogger("ekalsahayak.rag.retriever")

_CACHED_INDEX: HybridRAGIndex | None = None


def get_rag_index() -> HybridRAGIndex:
    """Returns singleton cached instance of the RAG index."""
    global _CACHED_INDEX
    if _CACHED_INDEX is not None:
        return _CACHED_INDEX

    index_path = Path(__file__).resolve().parent.parent / "data" / "index" / "corpus_index.pkl"
    if not index_path.exists():
        # Check parent folder fallback
        alt = Path("c:/Users/tribh/Downloads/EkalShayak/EkalSahayak/agent/app/data/index/corpus_index.pkl")
        if alt.exists():
            index_path = alt
        else:
            raise FileNotFoundError(f"RAG index not found at {index_path}. Run app.rag.build_index first.")

    logger.info("Loading RAG index from %s...", index_path)
    with open(index_path, "rb") as f:
        _CACHED_INDEX = pickle.load(f)
    logger.info("Loaded RAG index with %d chunks.", len(_CACHED_INDEX.chunks))
    return _CACHED_INDEX


def retrieve_ncert_chunks(
    query: str,
    top_k: int = 3,
    min_score: float = 0.08,
) -> tuple[list[dict[str, Any]], float]:
    """Retrieves top-k matching NCERT chunks with similarity scores and exact citations.

    Returns:
        tuple of (list of chunk dicts with provenance, latency_ms)
    """
    t0 = time.time()
    index = get_rag_index()
    results = index.retrieve(query=query, top_k=top_k, min_score=min_score)
    latency_ms = round((time.time() - t0) * 1000, 2)

    chunks_with_metadata: list[dict[str, Any]] = []
    for chunk, score in results:
        chunk_dict = chunk.to_dict()
        chunk_dict["score"] = score
        chunk_dict["citation"] = f"NCERT Class 9 {chunk.book}, {chunk.chapter}, Page {chunk.page}"
        chunks_with_metadata.append(chunk_dict)

    return chunks_with_metadata, latency_ms
