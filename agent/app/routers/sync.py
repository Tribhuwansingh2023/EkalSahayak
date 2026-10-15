"""Offline Batch Sync Router."""

from typing import Any

from fastapi import APIRouter, Depends

from app.models.sync import SyncBatchRequest, SyncBatchResponse
from app.security import get_current_user
from app.services.sync_service import get_sync_service

router = APIRouter(prefix="/api/agent", tags=["Offline Sync"])


@router.post("/sync", response_model=SyncBatchResponse)
async def sync_offline_actions(
    batch: SyncBatchRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Reconciles offline learning events with server-authoritative scoring & deduplication."""
    sync_svc = get_sync_service()
    return await sync_svc.process_batch(current_user["id"], batch)

