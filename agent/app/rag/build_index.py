"""Builds and Serializes the NCERT Class 9 Hybrid RAG Index.

Executes:
1. Extraction of NCERT Class 9 PDFs (Science, Civics, Economics, Geography, History, Mathematics)
2. Tokenization and cleaning of all chapter sections
3. Construction of Sparse BM25-style TF-IDF + Dense TruncatedSVD Semantic Index
4. Serialization into agent/data/index/corpus_index.pkl
5. Outputs extraction and indexing statistics (files, pages, chars, chunks, index size)
"""

from __future__ import annotations

import logging
import os
import pickle
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer

from app.rag.extractor import DocumentChunk, extract_all_textbooks
from app.rag.index import HybridRAGIndex

logger = logging.getLogger("ekalsahayak.rag.build_index")


def build_and_save_index(
    dataset_dir: Path | None = None,
    output_path: Path | None = None,
) -> Path:
    start_time = time.time()
    logger.info("Starting NCERT Class 9 Textbook indexing...")

    # Locate dataset directory
    if dataset_dir is None:
        # Default relative to agent directory
        dataset_dir = Path(__file__).resolve().parent.parent.parent.parent / "dataset"
        if not dataset_dir.exists():
            # Check alternative path
            alt = Path("c:/Users/tribh/Downloads/EkalShayak/EkalSahayak/dataset")
            if alt.exists():
                dataset_dir = alt

    logger.info("Dataset root resolved to: %s", dataset_dir)

    # Output directory
    if output_path is None:
        data_dir = Path(__file__).resolve().parent.parent / "data" / "index"
        data_dir.mkdir(parents=True, exist_ok=True)
        output_path = data_dir / "corpus_index.pkl"
    else:
        output_path.parent.mkdir(parents=True, exist_ok=True)

    # 1. Extract all chunks
    chunks, stats = extract_all_textbooks(dataset_dir)
    if not chunks:
        raise RuntimeError(f"No chunks extracted from dataset at {dataset_dir}")

    logger.info(
        "Extracted %d chunks from %d files (%d pages, %d chars).",
        len(chunks),
        stats["total_files"],
        stats["total_pages"],
        stats["total_chars"],
    )

    for book_name, bstats in stats["books"].items():
        logger.info(
            " - Book: %-25s | Files: %2d | Pages: %3d | Chars: %8d | Chunks: %4d",
            book_name,
            bstats["files"],
            bstats["pages"],
            bstats["chars"],
            bstats["chunks"],
        )

    # 2. Build Sparse Vectorizer (Unigram + Bigram + Trigram for domain terms)
    corpus_texts = [c.text for c in chunks]
    tfidf = TfidfVectorizer(
        ngram_range=(1, 3),
        max_features=25000,
        sublinear_tf=True,
        stop_words="english",
    )
    sparse_matrix = tfidf.fit_transform(corpus_texts)

    # 3. Build Dense Semantic Space (TruncatedSVD)
    n_components = min(64, sparse_matrix.shape[1] - 1)
    svd = TruncatedSVD(n_components=n_components, random_state=42)
    dense_matrix = svd.fit_transform(sparse_matrix)

    # 4. Construct RAG index object
    index = HybridRAGIndex(
        chunks=chunks,
        tfidf=tfidf,
        svd=svd,
        sparse_matrix=sparse_matrix,
        dense_matrix=dense_matrix,
        stats=stats,
    )

    # 5. Serialize
    with open(output_path, "wb") as f:
        pickle.dump(index, f, protocol=pickle.HIGHEST_PROTOCOL)

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    duration = time.time() - start_time

    logger.info("Successfully built hybrid RAG index!")
    logger.info("Saved to: %s", output_path)
    logger.info("Index file size: %.2f MB", file_size_mb)
    logger.info("Total processing time: %.2f seconds", duration)

    return output_path


if __name__ == "__main__":
    out = build_and_save_index()
    print(f"RAG Index Ready: {out}")
