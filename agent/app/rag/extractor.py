"""NCERT Class 9 Textbook PDF Extractor and Chunking Engine with Figure Detection.

Extracts text, structured sections, page numbers, and figures with captions from every
Class 9 textbook in dataset/ (Science, Mathematics, Civics, Economics, Geography, History,
English Beehive, English Moments, Hindi, Health & Physical Education).
Provides full provenance metadata: {subject, book, chapter, section, page, text, figures, concept_id}.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import asdict, dataclass, field
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

MATH_CHAPTER_NAMES: dict[str, str] = {
    "iemh101.pdf": "Chapter 1: Number Systems",
    "iemh102.pdf": "Chapter 2: Polynomials",
    "iemh103.pdf": "Chapter 3: Coordinate Geometry",
    "iemh104.pdf": "Chapter 4: Linear Equations in Two Variables",
    "iemh105.pdf": "Chapter 5: Introduction to Euclid's Geometry",
    "iemh106.pdf": "Chapter 6: Lines and Angles",
    "iemh107.pdf": "Chapter 7: Triangles",
    "iemh108.pdf": "Chapter 8: Quadrilaterals",
    "iemh109.pdf": "Chapter 9: Circles",
    "iemh110.pdf": "Chapter 10: Heron's Formula",
    "iemh111.pdf": "Chapter 11: Surface Areas and Volumes",
    "iemh112.pdf": "Chapter 12: Statistics",
    "iemh1an.pdf": "Mathematics Answers",
    "iemh1ps.pdf": "Mathematics Prelims",
}

CIVICS_CHAPTER_NAMES: dict[str, str] = {
    "iess401.pdf": "Chapter 1: What is Democracy? Why Democracy?",
    "iess402.pdf": "Chapter 2: Constitutional Design",
    "iess403.pdf": "Chapter 3: Electoral Politics",
    "iess404.pdf": "Chapter 4: Working of Institutions",
    "iess405.pdf": "Chapter 5: Democratic Rights",
    "iess4ps.pdf": "Democratic Politics Prelims",
}

ECONOMICS_CHAPTER_NAMES: dict[str, str] = {
    "ieec101.pdf": "Chapter 1: The Story of Village Palampur",
    "ieec102.pdf": "Chapter 2: People as Resource",
    "ieec103.pdf": "Chapter 3: Poverty as a Challenge",
    "ieec104.pdf": "Chapter 4: Food Security in India",
    "ieec1ps.pdf": "Economics Prelims",
}

GEOGRAPHY_CHAPTER_NAMES: dict[str, str] = {
    "iess101.pdf": "Chapter 1: India - Size and Location",
    "iess102.pdf": "Chapter 2: Physical Features of India",
    "iess103.pdf": "Chapter 3: Drainage",
    "iess104.pdf": "Chapter 4: Climate",
    "iess105.pdf": "Chapter 5: Natural Vegetation and Wildlife",
    "iess106.pdf": "Chapter 6: Population",
    "iess1ps.pdf": "Contemporary India Prelims",
}

HISTORY_CHAPTER_NAMES: dict[str, str] = {
    "iess301.pdf": "Chapter 1: The French Revolution",
    "iess302.pdf": "Chapter 2: Socialism in Europe and the Russian Revolution",
    "iess303.pdf": "Chapter 3: Nazism and the Rise of Hitler",
    "iess304.pdf": "Chapter 4: Forest Society and Colonialism",
    "iess305.pdf": "Chapter 5: Pastoralists in the Modern World",
    "iess3ps.pdf": "India and Contemporary World Prelims",
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

FIG_CAPTION_REGEX = re.compile(
    r"(?:(?:Fig(?:ure|\.)|चित्र)\s*(\d+[\.:]\d+)[^.\n\r]{0,140})",
    re.IGNORECASE,
)


@dataclass
class FigureMetadata:
    figure_id: str
    subject: str
    book: str
    chapter: str
    chapter_num: int
    page: int
    figure_num: str
    caption: str
    concept_id: str = ""
    width: int = 0
    height: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


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
    concept_id: str = ""
    figures: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "chunk_id": getattr(self, "chunk_id", ""),
            "subject": getattr(self, "subject", ""),
            "book": getattr(self, "book", ""),
            "chapter": getattr(self, "chapter", ""),
            "chapter_num": getattr(self, "chapter_num", 0),
            "section": getattr(self, "section", ""),
            "page": getattr(self, "page", 1),
            "text": getattr(self, "text", ""),
            "char_count": getattr(self, "char_count", 0),
            "concept_id": getattr(self, "concept_id", ""),
            "figures": getattr(self, "figures", []),
        }


def clean_page_text(raw_text: str) -> str:
    """Strips repetitive running headers, footers, and normalizes whitespaces."""
    text = raw_text
    for pat in HEADER_FOOTER_PATTERNS:
        text = pat.sub("", text)
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    return " ".join(lines)


def parse_chapter_info(filename: str, book_folder: str, first_page_sample: str) -> tuple[str, int]:
    """Derives readable chapter title and number from filename or heading text."""
    lower_f = filename.lower()
    folder_lower = book_folder.lower()

    if folder_lower == "science" and lower_f in SCIENCE_CHAPTER_NAMES:
        title = SCIENCE_CHAPTER_NAMES[lower_f]
        m = re.search(r"Chapter\s+(\d+)", title, re.IGNORECASE)
        num = int(m.group(1)) if m else 0
        return title, num

    if "math" in folder_lower and lower_f in MATH_CHAPTER_NAMES:
        title = MATH_CHAPTER_NAMES[lower_f]
        m = re.search(r"Chapter\s+(\d+)", title, re.IGNORECASE)
        num = int(m.group(1)) if m else 0
        return title, num

    if "civic" in folder_lower and lower_f in CIVICS_CHAPTER_NAMES:
        title = CIVICS_CHAPTER_NAMES[lower_f]
        m = re.search(r"Chapter\s+(\d+)", title, re.IGNORECASE)
        num = int(m.group(1)) if m else 0
        return title, num

    if "eco" in folder_lower and lower_f in ECONOMICS_CHAPTER_NAMES:
        title = ECONOMICS_CHAPTER_NAMES[lower_f]
        m = re.search(r"Chapter\s+(\d+)", title, re.IGNORECASE)
        num = int(m.group(1)) if m else 0
        return title, num

    if "geo" in folder_lower and lower_f in GEOGRAPHY_CHAPTER_NAMES:
        title = GEOGRAPHY_CHAPTER_NAMES[lower_f]
        m = re.search(r"Chapter\s+(\d+)", title, re.IGNORECASE)
        num = int(m.group(1)) if m else 0
        return title, num

    if "hist" in folder_lower and lower_f in HISTORY_CHAPTER_NAMES:
        title = HISTORY_CHAPTER_NAMES[lower_f]
        m = re.search(r"Chapter\s+(\d+)", title, re.IGNORECASE)
        num = int(m.group(1)) if m else 0
        return title, num

    # Generic extraction from first page or filename digits
    num_match = re.search(r"(\d+)", filename)
    ch_num = int(num_match.group(1)) if num_match else 1

    ch_heading_match = re.search(r"(Chapter\s+\d+[:\s]+[^\n\.\?]{3,40})", first_page_sample, re.IGNORECASE)
    if ch_heading_match:
        ch_title = ch_heading_match.group(1).strip()
    else:
        ch_title = f"{book_folder} Chapter {ch_num}"

    return ch_title, ch_num


def assign_concept_id(subject: str, chapter_num: int, section_text: str, content: str) -> str:
    """Maps chapter section or content keywords to a verified concept_id."""
    sec_lower = section_text.lower()
    text_lower = content.lower()

    if subject == "Science":
        if chapter_num == 1:
            if "evaporation" in sec_lower or "evaporation" in text_lower or "cooling" in text_lower:
                return "sci_ch1_c5_evaporation"
            if "change" in sec_lower or "latent" in text_lower or "melting" in text_lower:
                return "sci_ch1_c4_change_of_state"
            if "state" in sec_lower or "solid" in text_lower or "gas" in text_lower:
                return "sci_ch1_c3_states_of_matter"
            if "characteristic" in sec_lower or "space" in text_lower or "attract" in text_lower:
                return "sci_ch1_c2_particle_characteristics"
            return "sci_ch1_c1_physical_nature"

        if chapter_num == 5:
            if "organelle" in sec_lower or "mitochondria" in text_lower or "plastid" in text_lower or "lysosome" in text_lower:
                return "sci_ch5_c4_cell_organelles"
            if "nucleus" in sec_lower or "wall" in text_lower or "cytoplasm" in text_lower:
                return "sci_ch5_c3_nucleus_cytoplasm"
            if "membrane" in sec_lower or "osmosis" in text_lower or "diffusion" in text_lower:
                return "sci_ch5_c2_plasma_membrane_osmosis"
            return "sci_ch5_c1_cell_discovery"

        if chapter_num == 7:
            if "equation" in sec_lower or "v = u" in text_lower:
                return "sci_ch7_c4_equations_motion"
            if "acceleration" in sec_lower or "rate of change of velocity" in text_lower:
                return "sci_ch7_c3_acceleration"
            if "speed" in sec_lower or "velocity" in text_lower:
                return "sci_ch7_c2_speed_velocity"
            return "sci_ch7_c1_describing_motion"

        if chapter_num == 8:
            if "third" in sec_lower or "action" in text_lower or "reaction" in text_lower:
                return "sci_ch8_c4_third_law_motion"
            if "second" in sec_lower or "momentum" in text_lower or "f = ma" in text_lower:
                return "sci_ch8_c3_second_law_momentum"
            if "first" in sec_lower or "inertia" in text_lower:
                return "sci_ch8_c2_first_law_inertia"
            return "sci_ch8_c1_balanced_unbalanced_forces"

        if chapter_num == 9:
            if "mass" in sec_lower or "weight" in text_lower or "moon" in text_lower:
                return "sci_ch9_c3_mass_vs_weight"
            if "free fall" in sec_lower or "acceleration due to gravity" in text_lower:
                return "sci_ch9_c2_free_fall_g"
            return "sci_ch9_c1_universal_gravitation"

    # Default fallback concept ID per subject and chapter
    return f"{subject.lower()[:4]}_ch{chapter_num}"


def extract_chunks_from_pdf(
    pdf_path: Path,
    book_name: str,
    subject: str,
    chunk_size_words: int = 250,
    overlap_words: int = 40,
) -> tuple[list[DocumentChunk], list[FigureMetadata]]:
    """Extracts text pages, figures with captions, and produces section chunks with provenance."""
    doc = pymupdf.open(str(pdf_path))
    chunks: list[DocumentChunk] = []
    figures: list[FigureMetadata] = []

    first_page_text = doc[0].get_text() if len(doc) > 0 else ""
    chapter_title, chapter_num = parse_chapter_info(pdf_path.name, book_name, first_page_text)

    for page_idx in range(len(doc)):
        page_num = page_idx + 1
        page = doc[page_idx]
        raw_text = page.get_text()
        cleaned = clean_page_text(raw_text)

        # Detect figure captions on this page
        page_figures: list[dict[str, Any]] = []
        for match in FIG_CAPTION_REGEX.finditer(raw_text):
            fnum = match.group(1).replace(":", ".")
            cap = match.group(0).strip()
            fig_id = f"{book_name.lower()[:4]}_ch{chapter_num}_p{page_num}_fig{fnum}"
            fig_item = FigureMetadata(
                figure_id=fig_id,
                subject=subject,
                book=book_name,
                chapter=chapter_title,
                chapter_num=chapter_num,
                page=page_num,
                figure_num=fnum,
                caption=cap,
                concept_id=assign_concept_id(subject, chapter_num, chapter_title, cap),
            )
            figures.append(fig_item)
            page_figures.append(fig_item.to_dict())

        if not cleaned or len(cleaned.split()) < 15:
            continue

        words = cleaned.split()
        current_section = f"{chapter_title} (Page {page_num})"

        sec_match = re.search(r"(\d+\.\d+\s+[A-Z][a-zA-Z\s]{3,35})", cleaned)
        if sec_match:
            current_section = sec_match.group(1).strip()

        concept_id = assign_concept_id(subject, chapter_num, current_section, cleaned)

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
                concept_id=concept_id,
                figures=page_figures if chunk_sub_idx == 0 else [],
            )
            chunks.append(chunk)
            chunk_sub_idx += 1

    doc.close()
    return chunks, figures


def extract_all_textbooks(
    dataset_root: Path,
    subjects_filter: list[str] | None = None,
) -> tuple[list[DocumentChunk], list[FigureMetadata], dict[str, Any]]:
    """Crawls all textbook folders in dataset, extracts chunks and figures, and returns stats."""
    all_chunks: list[DocumentChunk] = []
    all_figures: list[FigureMetadata] = []
    stats: dict[str, Any] = {
        "books": {},
        "total_books": 0,
        "total_files": 0,
        "total_pages": 0,
        "total_chars": 0,
        "total_chunks": 0,
        "total_figures": 0,
        "per_chapter": {},
    }

    if not dataset_root.exists():
        logger.error("Dataset root does not exist: %s", dataset_root)
        return all_chunks, all_figures, stats

    for folder_name in sorted(os.listdir(dataset_root)):
        folder_path = dataset_root / folder_name
        if not folder_path.is_dir():
            continue

        if subjects_filter and folder_name not in subjects_filter:
            continue

        pdf_files = sorted([f for f in folder_path.iterdir() if f.suffix.lower() == ".pdf"])
        if not pdf_files:
            continue

        stats["total_books"] += 1
        book_pages = 0
        book_chars = 0
        book_chunks_count = 0
        book_figures_count = 0

        for pdf_file in pdf_files:
            try:
                subject_name = (
                    "Science"
                    if "science" in folder_name.lower()
                    else "Mathematics"
                    if "math" in folder_name.lower()
                    else folder_name
                )
                chunks, figs = extract_chunks_from_pdf(
                    pdf_path=pdf_file,
                    book_name=folder_name,
                    subject=subject_name,
                )
                all_chunks.extend(chunks)
                all_figures.extend(figs)

                doc = pymupdf.open(str(pdf_file))
                book_pages += len(doc)
                doc.close()

                file_chars = sum(c.char_count for c in chunks)
                book_chars += file_chars
                book_chunks_count += len(chunks)
                book_figures_count += len(figs)

                ch_title = chunks[0].chapter if chunks else pdf_file.stem
                stats["per_chapter"][ch_title] = {
                    "chunks": len(chunks),
                    "figures": len(figs),
                    "chars": file_chars,
                }
            except Exception as e:
                logger.warning("Failed to extract %s: %s", pdf_file, e)

        stats["books"][folder_name] = {
            "files": len(pdf_files),
            "pages": book_pages,
            "chars": book_chars,
            "chunks": book_chunks_count,
            "figures": book_figures_count,
        }
        stats["total_files"] += len(pdf_files)
        stats["total_pages"] += book_pages
        stats["total_chars"] += book_chars
        stats["total_chunks"] += book_chunks_count
        stats["total_figures"] += book_figures_count

    return all_chunks, all_figures, stats
