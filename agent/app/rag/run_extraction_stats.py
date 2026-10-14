"""Prints exact extraction statistics across all books in dataset/."""

import sys
from pathlib import Path
from app.rag.extractor import extract_all_textbooks

# Support UTF-8 stdout
sys.stdout.reconfigure(encoding="utf-8")

dataset_dir = Path("../dataset")
if not dataset_dir.exists():
    dataset_dir = Path("dataset")

print(f"Extracting all books from: {dataset_dir.resolve()}...")
chunks, figures, stats = extract_all_textbooks(dataset_dir)

print("\n=======================================================")
print("          REAL NCERT CLASS 9 EXTRACTION STATS         ")
print("=======================================================")
print(f"Total Book Subjects:      {stats['total_books']}")
print(f"Total Textbooks (PDFs):   {stats['total_files']}")
print(f"Total Pages Extracted:    {stats['total_pages']}")
print(f"Total Characters:         {stats['total_chars']:,}")
print(f"Total Chunks Generated:   {stats['total_chunks']:,}")
print(f"Total Figures Detected:   {stats['total_figures']:,}")
print("=======================================================\n")

print("PER-BOOK BREAKDOWN:")
print(f"{'Subject Book':<38} | {'PDFs':>4} | {'Pages':>5} | {'Chunks':>6} | {'Figures':>7} | {'Characters':>10}")
print("-" * 82)
for bname, bstats in sorted(stats['books'].items()):
    print(f"{bname:<38} | {bstats['files']:>4} | {bstats['pages']:>5} | {bstats['chunks']:>6} | {bstats['figures']:>7} | {bstats['chars']:>10,}")

print("\nPER-CHAPTER BREAKDOWN (Sample):")
print(f"{'Chapter Title':<50} | {'Chunks':>6} | {'Figures':>7} | {'Characters':>10}")
print("-" * 80)
for ch, info in sorted(stats['per_chapter'].items()):
    print(f"{ch[:50]:<50} | {info['chunks']:>6} | {info['figures']:>7} | {info['chars']:>10,}")
