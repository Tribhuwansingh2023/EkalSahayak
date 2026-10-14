"""Health, Readiness & Diagnostic Telemetry Router."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_database, ping_database
from app.security import require_admin

logger = logging.getLogger("ekalsahayak.routers.health")

router = APIRouter(tags=["Health & Diagnostics"])


@router.get("/health")
@router.get("/api/health")
async def health_status():
    """General service identification."""
    return {
        "status": "healthy",
        "service": "lakshya-ai-agent-engine",
        "version": "2.1.0",
        "framework": "LangGraph + Motor Async + Production Hardened",
        "active_curriculum": "BSE Odisha Class 9 Science",
    }


@router.get("/health/live")
async def liveness_probe():
    """Kubernetes / Docker liveness probe: returns 200 if process is up."""
    return {"status": "alive"}


@router.get("/health/ready")
async def readiness_probe():
    """Readiness probe: pings MongoDB with 1s timeout; fails fast with 503 if unreachable."""
    is_ready = await ping_database(timeout_ms=1000)
    if not is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "unready", "database": "disconnected"},
        )
    return {"status": "ready", "database": "connected"}


@router.get("/api/db/status")
async def get_db_status(admin_user: dict[str, Any] = Depends(require_admin)):
    """Admin-only diagnostic endpoint displaying MongoDB collection statistics."""
    db = get_database()
    collections = await db.list_collection_names()

    stats: dict[str, Any] = {"database": db.name, "collections": {}}
    for col in collections:
        try:
            count = await db[col].estimated_document_count()
            stats["collections"][col] = count
        except Exception:
            stats["collections"][col] = "unknown"

    return stats
