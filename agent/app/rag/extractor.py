"""NCERT Class 9 Textbook PDF Extractor and Chunking Engine.

Extracts text from all downloaded CBSE NCERT Class 9 textbooks (Science, Civics, Economics,
Geography, History, Mathematics), cleans headers and footers, detects sections, and chunks
with complete provenance metadata: {subject, book, chapter, section, page, text, chunk_id}.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import pymupdf

logger = logging.getLogger("ekalsahayak.rag.extractor")

SCIENCE_CHAPTER_NAMES: dict[str, str] = {
    "iesc101.pdf": "Chapter 1: Matter in Our Surroundings",
    "iesc102.pdf": "Chapter 2: Is Matter Around Us Pure",
    "iesc103.pdf": "Chapter 3: Atoms and Molecules",
    "iesc104.pdf": "Chapter 4: Structure of the Atom",
    "iesc105.pdf": "Chapter 5: The Fundamental Unit of Life (Cell)",
    "iesc106.pdf": "Chapter 6: Tissues",
    "iesc107.pdf": "Chapter 7: Motion",
    "iesc108.pdf": "Chapter 8: Force and Laws of Motion",
    "iesc109.pdf": "Chapter 9: Gravitation",
    "iesc110.pdf": "Chapter 10: Work and Energy",
    "iesc111.pdf": "Chapter 11: Sound",
    "iesc112.pdf": "Chapter 12: Improvement in Food Resources",
    "iesc1an.pdf": "Science Answers and Hints",
    "iesc1ps.pdf": "Science Prelims and Syllabus",
}

HEADER_FOOTER_PATTERNS = [
    re.compile(r"Rationalised\s+20\d\d[-–]\d\d?", re.IGNORECASE),
    re.compile(r"Reprint\s+20\d\d[-–]\d\d?", re.IGNORECASE),
    re.compile(r"^\s*SCIENCE\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*\d+\s+SCIENCE\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*SCIENCE\s+\d+\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*MATHEMATICS\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*SOCIAL SCIENCE\s*$", re.IGNORECASE | re.MULTILINE),
]


@dataclass
class DocumentChunk:
    chunk_id: str
    subject: str
    book: str
    chapter: str
    chapter_num: int
    section: str
    page: int
    text: str
    char_count: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def clean_page_text(raw_text: str) -> str:
    """Strips repetitive running headers, footers, and normalizes whitespaces."""
    text = raw_text
    for pat in HEADER_FOOTER_PATTERNS:
        text = pat.sub("", text)
    # Normalize multiple newlines and spaces
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    return " ".join(lines)


def parse_chapter_info(filename: str, book_folder: str, first_page_sample: str) -> tuple[str, int]:
    """Derives readable chapter title and number from filename or heading text."""
    lower_f = filename.lower()
    if book_folder == "Science" and lower_f in SCIENCE_CHAPTER_NAMES:
        title = SCIENCE_CHAPTER_NAMES[lower_f]
        m = re.search(r"Chapter\s+(\d+)", title, re.IGNORECASE)
        num = int(m.group(1)) if m else 0
        return title, num

    # Generic extraction
    num_match = re.search(r"(\d+)", filename)
    ch_num = int(num_match.group(1)) if num_match else 1
    
    # Check if first page has "Chapter X"
    ch_heading_match = re.search(r"(Chapter\s+\d+[:\s]+[^\n\.\?]{3,40})", first_page_sample, re.IGNORECASE)
    if ch_heading_match:
        ch_title = ch_heading_match.group(1).strip()
    else:
        ch_title = f"{book_folder} Chapter {ch_num}"

    return ch_title, ch_num


def extract_chunks_from_pdf(
    pdf_path: Path,
    book_name: str,
    subject: str,
    chunk_size_words: int = 250,
    overlap_words: int = 40,
) -> list[DocumentChunk]:
    """Extracts pages from a single PDF and creates overlapping section chunks."""
    doc = pymupdf.open(str(pdf_path))
    chunks: list[DocumentChunk] = []
    
    # Peek at first page to identify chapter title
    first_page_text = doc[0].get_text() if len(doc) > 0 else ""
    chapter_title, chapter_num = parse_chapter_info(pdf_path.name, book_name, first_page_text)

    for page_idx in range(len(doc)):
        page_num = page_idx + 1
        page = doc[page_idx]
        raw_text = page.get_text()
        cleaned = clean_page_text(raw_text)

        if not cleaned or len(cleaned.split()) < 15:
            continue

        words = cleaned.split()
        current_section = f"{chapter_title} (Page {page_num})"

        # Check for section headers like "8.2 First Law of Motion"
        sec_match = re.search(r"(\d+\.\d+\s+[A-Z][a-zA-Z\s]{3,35})", cleaned)
        if sec_match:
            current_section = sec_match.group(1).strip()

        # Word-based chunking with overlap
        step = max(chunk_size_words - overlap_words, 50)
        chunk_sub_idx = 0
        for i in range(0, len(words), step):
            chunk_words = words[i : i + chunk_size_words]
            if len(chunk_words) < 25:
                continue

            chunk_text = " ".join(chunk_words)
            chunk_id = f"{book_name.lower()[:4]}_ch{chapter_num}_p{page_num}_c{chunk_sub_idx}"

            chunk = DocumentChunk(
                chunk_id=chunk_id,
                subject=subject,
                book=book_name,
                chapter=chapter_title,
                chapter_num=chapter_num,
                section=current_section,
                page=page_num,
                text=chunk_text,
                char_count=len(chunk_text),
            )
            chunks.append(chunk)
            chunk_sub_idx += 1

    doc.close()
    return chunks


def extract_all_textbooks(
    dataset_root: Path,
    subjects_filter: list[str] | None = None,
) -> tuple[list[DocumentChunk], dict[str, Any]]:
    """Crawls all textbook folders in dataset, extracts chunks, and returns stats."""
    all_chunks: list[DocumentChunk] = []
    stats: dict[str, Any] = {
        "books": {},
        "total_files": 0,
        "total_pages": 0,
        "total_chars": 0,
        "total_chunks": 0,
    }

    if not dataset_root.exists():
        logger.error("Dataset root does not exist: %s", dataset_root)
        return all_chunks, stats

    for folder_name in sorted(os.listdir(dataset_root)):
        folder_path = dataset_root / folder_name
        if not folder_path.is_dir():
            continue

        if subjects_filter and folder_name not in subjects_filter:
            continue

        pdf_files = sorted([f for f in folder_path.iterdir() if f.suffix.lower() == ".pdf"])
        if not pdf_files:
            continue

        book_pages = 0
        book_chars = 0
        book_chunks_count = 0

        for pdf_file in pdf_files:
            try:
                doc = pymupdf.open(str(pdf_file))
                book_pages += len(doc)
                doc.close()

                chunks = extract_chunks_from_pdf(
                    pdf_path=pdf_file,
                    book_name=folder_name,
                    subject="Science" if "science" in folder_name.lower() else folder_name,
                )
                all_chunks.extend(chunks)

                file_chars = sum(c.char_count for c in chunks)
                book_chars += file_chars
                book_chunks_count += len(chunks)
            except Exception as e:
                logger.warning("Failed to extract %s: %s", pdf_file, e)

        stats["books"][folder_name] = {
            "files": len(pdf_files),
            "pages": book_pages,
            "chars": book_chars,
            "chunks": book_chunks_count,
        }
        stats["total_files"] += len(pdf_files)
        stats["total_pages"] += book_pages
        stats["total_chars"] += book_chars
        stats["total_chunks"] += book_chunks_count

    return all_chunks, stats
