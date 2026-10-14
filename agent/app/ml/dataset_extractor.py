"""NCERT Class 9 Textbook Dataset Extractor.

Extracts text from all Class 9 NCERT PDF textbooks in the dataset directory,
cleans typography and hyphenation artifacts, and parses chapters into structured
learning units with concepts, definitions, summaries, and questions.
"""

import json
import logging
import os
import re
from pathlib import Path
from typing import Any

import pypdf

logger = logging.getLogger("ekalsahayak.extractor")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Known NCERT Class 9 Science Chapter Metadata Mapping
SCIENCE_CHAPTER_MAP: dict[str, dict[str, Any]] = {
    "iesc101.pdf": {
        "chapter_number": 1,
        "title": "Matter in Our Surroundings",
        "subject": "Science",
        "topic_key": "evaporation",
        "keywords": ["matter", "solid", "liquid", "gas", "evaporation", "boiling", "latent heat", "temperature", "diffusion", "particles", "celsius", "kelvin", "sublimation"],
        "odia_title": "ଆମ ଚାରିପାଖର ପଦାର୍ଥ (Matter in Our Surroundings)",
    },
    "iesc102.pdf": {
        "chapter_number": 2,
        "title": "Is Matter Around Us Pure",
        "subject": "Science",
        "topic_key": "matter_purity",
        "keywords": ["mixture", "solution", "suspension", "colloid", "solute", "solvent", "concentration", "tyndall effect", "distillation", "chromatography"],
        "odia_title": "ଆମ ଚାରିପାଖର ପଦାର୍ଥ ବିଶୁଦ୍ଧ କି? (Is Matter Around Us Pure?)",
    },
    "iesc103.pdf": {
        "chapter_number": 3,
        "title": "Atoms and Molecules",
        "subject": "Science",
        "topic_key": "atoms_molecules",
        "keywords": ["atom", "molecule", "chemical formula", "valency", "atomic mass", "dalton", "conservation of mass", "constant proportions", "mole"],
        "odia_title": "ପରମାଣୁ ଓ ଅଣୁ (Atoms and Molecules)",
    },
    "iesc104.pdf": {
        "chapter_number": 4,
        "title": "Structure of the Atom",
        "subject": "Science",
        "topic_key": "atomic_structure",
        "keywords": ["electron", "proton", "neutron", "thomson", "rutherford", "bohr", "atomic number", "mass number", "isotope", "valency", "shell"],
        "odia_title": "ପରମାଣୁର ଗଠନ (Structure of the Atom)",
    },
    "iesc105.pdf": {
        "chapter_number": 5,
        "title": "The Fundamental Unit of Life",
        "subject": "Science",
        "topic_key": "cell_biology",
        "keywords": ["cell", "plasma membrane", "nucleus", "cytoplasm", "mitochondria", "plastids", "vacuoles", "ribosomes", "osmosis", "endoplasmic reticulum", "golgi"],
        "odia_title": "ଜୀବନର ମୌଳିକ ଏକକ - କୋଷ (The Fundamental Unit of Life)",
    },
    "iesc106.pdf": {
        "chapter_number": 6,
        "title": "Tissues",
        "subject": "Science",
        "topic_key": "tissues",
        "keywords": ["tissue", "meristematic", "permanent", "parenchyma", "collenchyma", "sclerenchyma", "xylem", "phloem", "epithelial", "muscular", "nervous"],
        "odia_title": "କଳା / ଟିସୁ (Tissues)",
    },
    "iesc107.pdf": {
        "chapter_number": 7,
        "title": "Motion",
        "subject": "Science",
        "topic_key": "motion",
        "keywords": ["motion", "distance", "displacement", "speed", "velocity", "acceleration", "uniform motion", "rate of change", "equations of motion", "circular motion"],
        "odia_title": "ଗତି (Motion)",
    },
    "iesc108.pdf": {
        "chapter_number": 8,
        "title": "Force and Laws of Motion",
        "subject": "Science",
        "topic_key": "force",
        "keywords": ["force", "inertia", "first law of motion", "second law of motion", "third law of motion", "momentum", "mass", "balanced force", "unbalanced force"],
        "odia_title": "ବଳ ଓ ଗତି ନିୟମ (Force and Laws of Motion)",
    },
    "iesc109.pdf": {
        "chapter_number": 9,
        "title": "Gravitation",
        "subject": "Science",
        "topic_key": "gravitation",
        "keywords": ["gravitation", "universal law of gravitation", "free fall", "weight", "mass", "thrust", "pressure", "buoyancy", "archimedes principle", "density"],
        "odia_title": "ମାଧ୍ୟାକର୍ଷଣ (Gravitation)",
    },
    "iesc110.pdf": {
        "chapter_number": 10,
        "title": "Work and Energy",
        "subject": "Science",
        "topic_key": "work_energy",
        "keywords": ["work", "kinetic energy", "potential energy", "law of conservation of energy", "power", "joule", "watt", "mechanical energy"],
        "odia_title": "କାର୍ଯ୍ୟ ଓ ଶକ୍ତି (Work and Energy)",
    },
    "iesc111.pdf": {
        "chapter_number": 11,
        "title": "Sound",
        "subject": "Science",
        "topic_key": "sound",
        "keywords": ["sound", "vibration", "compression", "rarefaction", "longitudinal wave", "amplitude", "frequency", "wavelength", "echo", "ultrasound", "sonar"],
        "odia_title": "ଶବ୍ଦ (Sound)",
    },
    "iesc112.pdf": {
        "chapter_number": 12,
        "title": "Improvement in Food Resources",
        "subject": "Science",
        "topic_key": "food_resources",
        "keywords": ["crop", "irrigation", "manure", "fertilizer", "hybridisation", "weed", "animal husbandry", "poultry", "fisheries", "beekeeping"],
        "odia_title": "ଖାଦ୍ୟ ଉତ୍ସର ଉନ୍ନତିକରଣ (Improvement in Food Resources)",
    },
}


def clean_ncert_text(text: str) -> str:
    """Removes font ligatures, broken word spaces, and header/footer noise."""
    if not text:
        return ""

    # Replace weird typographic symbols
    text = text.replace("", "'").replace("\x0c", " ").replace("\r\n", "\n")

    # Fix common font split artifacts in NCERT (e.g., 'br eathe' -> 'breathe', 'pr evious' -> 'previous')
    common_fixes = [
        (r"\bbr\s+eathe\b", "breathe"),
        (r"\bpr\s+evious\b", "previous"),
        (r"\br\s+esembled\b", "resembled"),
        (r"\bdif\s+ferent\b", "different"),
        (r"\bper\s+forms\b", "performs"),
        (r"\bther\s+mometer\b", "thermometer"),
        (r"\btem\s+perature\b", "temperature"),
        (r"\bap\s+proximately\b", "approximately"),
        (r"\bevapo\s+ration\b", "evaporation"),
        (r"\bpar\s+ticles\b", "particles"),
        (r"\bacceler\s+ation\b", "acceleration"),
        (r"\bvelo\s+city\b", "velocity"),
        (r"\bcharac\s+teristic\b", "characteristic"),
        (r"\bsub\s+stance\b", "substance"),
        (r"\bgravita\s+tion\b", "gravitation"),
    ]
    for pattern, repl in common_fixes:
        text = re.sub(pattern, repl, text, flags=re.IGNORECASE)

    # Clean hyphenated line breaks (e.g., 'sub-\nstance' -> 'substance')
    text = re.sub(r"(\w+)-\n(\w+)", r"\1\2", text)

    # Normalize double linebreaks
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def extract_chapter_sections(text: str) -> list[dict[str, str]]:
    """Splits full chapter text into subsections based on decimal headings (e.g., 1.1, 1.2)."""
    # Regex matching NCERT decimal headings like "1.1 Physical Nature of Matter"
    section_pattern = re.compile(r"(?:\n|^)(\d+\.\d+(?:\.\d+)?\s+[A-Z][^\n]+)\n")
    matches = list(section_pattern.finditer(text))

    sections: list[dict[str, str]] = []
    if not matches:
        sections.append({"heading": "Overview", "content": text[:3000]})
        return sections

    for i in range(len(matches)):
        start_idx = matches[i].end()
        end_idx = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        heading = matches[i].group(1).strip()
        content = text[start_idx:end_idx].strip()
        if content:
            sections.append({"heading": heading, "content": content})

    return sections


def extract_questions_and_summaries(text: str) -> dict[str, Any]:
    """Extracts 'What you have learnt' summaries and end-of-chapter questions."""
    summary_match = re.search(r"What you have learnt\s*\n(.*?)(?=Exercises|Questions|\Z)", text, re.DOTALL | re.IGNORECASE)
    summary_text = summary_match.group(1).strip() if summary_match else ""

    exercises_match = re.search(r"(?:Exercises|Questions)\s*\n(.*)", text, re.DOTALL | re.IGNORECASE)
    exercises_text = exercises_match.group(1).strip() if exercises_match else ""

    # Split exercises into discrete question items
    q_items = []
    if exercises_text:
        raw_qs = re.split(r"\n(?=\d+\.\s+)", exercises_text)
        for q in raw_qs:
            q_clean = q.strip()
            if q_clean and len(q_clean) > 10:
                q_items.append(q_clean)

    return {
        "summary": summary_text,
        "questions": q_items[:10],  # Keep up to 10 key questions
    }


def extract_entire_dataset(dataset_dir: str, output_path: str) -> dict[str, Any]:
    """Iterates through NCERT Class 9 PDF files, extracts and cleans text, and saves structured JSON."""
    science_dir = Path(dataset_dir) / "Science"
    if not science_dir.exists():
        raise FileNotFoundError(f"Science dataset directory not found at: {science_dir}")

    corpus: dict[str, Any] = {
        "class": 9,
        "curriculum": "CBSE / NCERT Class 9",
        "total_chapters": 0,
        "chapters": [],
    }

    total_words = 0
    total_pages = 0

    pdf_files = sorted([f for f in os.listdir(science_dir) if f.startswith("iesc1") and f.endswith(".pdf")])
    logger.info("Found %d Science PDF files in %s", len(pdf_files), science_dir)

    for fname in pdf_files:
        meta = SCIENCE_CHAPTER_MAP.get(fname)
        if not meta:
            # Skip prelims (iesc1ps.pdf) and answer keys (iesc1an.pdf) for the main chapter index
            continue

        pdf_path = science_dir / fname
        try:
            reader = pypdf.PdfReader(str(pdf_path))
            num_pages = len(reader.pages)
            total_pages += num_pages

            page_texts = []
            for page in reader.pages:
                txt = page.extract_text()
                if txt:
                    page_texts.append(txt)

            raw_chapter_text = "\n\n".join(page_texts)
            cleaned_text = clean_ncert_text(raw_chapter_text)
            sections = extract_chapter_sections(cleaned_text)
            extra = extract_questions_and_summaries(cleaned_text)

            word_count = len(cleaned_text.split())
            total_words += word_count

            chapter_entry = {
                "file_name": fname,
                "chapter_number": meta["chapter_number"],
                "title": meta["title"],
                "subject": meta["subject"],
                "topic_key": meta["topic_key"],
                "odia_title": meta["odia_title"],
                "keywords": meta["keywords"],
                "num_pages": num_pages,
                "word_count": word_count,
                "full_text": cleaned_text,
                "sections": sections,
                "summary": extra["summary"],
                "sample_questions": extra["questions"],
            }
            corpus["chapters"].append(chapter_entry)
            logger.info("Extracted Chapter %d: %s (%d pages, %d words, %d sections)",
                        meta["chapter_number"], meta["title"], num_pages, word_count, len(sections))

        except Exception as exc:
            logger.error("Failed to extract %s: %s", fname, exc)

    corpus["total_chapters"] = len(corpus["chapters"])
    corpus["total_pages"] = total_pages
    corpus["total_words"] = total_words

    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(corpus, f, ensure_ascii=False, indent=2)

    logger.info("Extraction complete! Saved %d chapters (%d words) to %s",
                corpus["total_chapters"], total_words, output_path)
    return corpus


if __name__ == "__main__":
    default_dataset = r"c:\Users\tribh\Downloads\EkalShayak\EkalSahayak\dataset"
    default_output = r"c:\Users\tribh\Downloads\EkalShayak\EkalSahayak\agent\app\data\ncert_class9_corpus.json"
    extract_entire_dataset(default_dataset, default_output)
