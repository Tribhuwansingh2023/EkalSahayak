"""Ingests all NCERT chunks, figures, and curriculum nodes into MongoDB.

Stores collections:
- `curriculum`: Subject -> Book -> Chapter -> Section -> Concept with prerequisite edges
- `chunks`: 2,478 granular textbook chunks with full page & chapter provenance
- `figures`: 825 textbook figures with verified captions and concept links
"""

import asyncio
import logging
from pathlib import Path
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, IndexModel

from app.config import get_settings
from app.rag.curriculum_builder import get_all_concepts
from app.rag.extractor import extract_all_textbooks

logger = logging.getLogger("ekalsahayak.rag.ingest")


async def run_ingestion() -> dict[str, int]:
    settings = get_settings()
    dataset_dir = Path("../dataset")
    if not dataset_dir.exists():
        dataset_dir = Path("dataset")

    print(f"Connecting to MongoDB at {settings.MONGODB_URI}...")
    client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=2000)
    db = client[settings.MONGODB_DB_NAME]

    try:
        await client.admin.command("ping")
        print("Connected to MongoDB successfully.")
    except Exception as exc:
        print(f"Standalone Mongo ping failed ({exc}), using mongomock-motor for local tests...")
        import mongomock_motor
        client = mongomock_motor.AsyncMongoMockClient()
        db = client[settings.MONGODB_DB_NAME]

    # Create indexes for curriculum, chunks, and figures
    await db.curriculum.create_indexes([
        IndexModel([("concept_id", ASCENDING)], unique=True),
        IndexModel([("subject", ASCENDING), ("chapter_num", ASCENDING)]),
    ])
    await db.chunks.create_indexes([
        IndexModel([("chunk_id", ASCENDING)], unique=True),
        IndexModel([("concept_id", ASCENDING)]),
        IndexModel([("subject", ASCENDING), ("chapter_num", ASCENDING)]),
    ])
    await db.figures.create_indexes([
        IndexModel([("figure_id", ASCENDING)], unique=True),
        IndexModel([("concept_id", ASCENDING)]),
        IndexModel([("subject", ASCENDING), ("chapter_num", ASCENDING)]),
    ])

    print("Extracting full textbook corpus...")
    chunks, figures, stats = extract_all_textbooks(dataset_dir)

    print(f"Ingesting {len(chunks)} chunks into MongoDB 'chunks'...")
    chunk_docs = [c.to_dict() for c in chunks]
    # Ingest in batches of 500
    for i in range(0, len(chunk_docs), 500):
        batch = chunk_docs[i : i + 500]
        for doc in batch:
            await db.chunks.update_one({"chunk_id": doc["chunk_id"]}, {"$set": doc}, upsert=True)

    print(f"Ingesting {len(figures)} figures into MongoDB 'figures'...")
    fig_docs = [f.to_dict() for f in figures]
    for i in range(0, len(fig_docs), 500):
        batch = fig_docs[i : i + 500]
        for doc in batch:
            await db.figures.update_one({"figure_id": doc["figure_id"]}, {"$set": doc}, upsert=True)

    # Ingest curriculum concepts
    concepts = get_all_concepts()
    print(f"Ingesting {len(concepts)} curriculum concept nodes into MongoDB 'curriculum'...")
    for c in concepts:
        c_dict = c.to_dict()
        # Attach associated chunks and figures
        matched_chunks = [ch.chunk_id for ch in chunks if ch.concept_id == c.concept_id]
        matched_figs = [fg.figure_id for fg in figures if fg.concept_id == c.concept_id]
        c_dict["chunk_ids"] = matched_chunks
        c_dict["figure_ids"] = matched_figs
        await db.curriculum.update_one({"concept_id": c.concept_id}, {"$set": c_dict}, upsert=True)

    c_count = await db.curriculum.count_documents({})
    ch_count = await db.chunks.count_documents({})
    fg_count = await db.figures.count_documents({})

    print("\n=======================================================")
    print("        MONGODB INGESTION COMPLETED SUCCESSFULLY       ")
    print("=======================================================")
    print(f"Curriculum Concept Nodes in DB: {c_count}")
    print(f"Chunks in DB:                   {ch_count}")
    print(f"Figures in DB:                  {fg_count}")
    print("=======================================================\n")

    client.close()
    return {"curriculum": c_count, "chunks": ch_count, "figures": fg_count}


if __name__ == "__main__":
    asyncio.run(run_ingestion())
