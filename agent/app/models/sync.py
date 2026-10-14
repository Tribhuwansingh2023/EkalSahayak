"""Offline-to-Online Synchronization Schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SyncEvent(BaseModel):
    """Raw offline learning event logged while disconnected.

    Server-Authoritative Anti-Cheat:
    - client 'score' is STRICTLY forbidden and not present in schema!
    - Server re-evaluates answers from question bank using question_id & selected_index.
    """

    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(..., min_length=4, max_length=128, description="Client-generated unique UUID")
    type: str = Field(..., min_length=1, max_length=64, description="E.g., 'quiz_answer', 'doubt_asked'")
    question_id: str | None = Field(default=None, max_length=64)
    selected_index: int | None = Field(default=None, ge=0, le=10)
    topic: str | None = Field(default=None, max_length=64)
    client_ts: datetime = Field(..., description="Timestamp recorded on device")


class SyncBatchRequest(BaseModel):
    """Batch of offline events submitted upon reconnection."""

    model_config = ConfigDict(extra="forbid")

    actions: list[SyncEvent] = Field(..., min_length=1, max_length=50, description="Up to 50 offline events per batch")


class SyncBatchResponse(BaseModel):
    """Result of batch synchronization."""

    synced_count: int
    skipped_count: int
    updated_mastery: dict[str, float]
    message: str
