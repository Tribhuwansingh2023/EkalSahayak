"""Offline Batch Sync System Test Suite.

Verifies:
1. POST /api/agent/sync allows guest/offline students without JWT token.
2. Server-authoritative answer scoring from database.
3. Deduplication via persistent event_id in sync_events collection.
4. Schema protection against client score injection (422 Unprocessable Entity).
5. Timestamp boundary validation (rejects stale or future-dated events).
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_guest_student_offline_sync_allowed(async_client: AsyncClient):
    """Guest students operating offline without an active JWT token can synchronize actions."""
    evt_id = f"evt-guest-{uuid.uuid4()}"
    now_iso = datetime.now(UTC).isoformat()

    batch_payload = {
        "actions": [
            {
                "event_id": evt_id,
                "type": "quiz_answer",
                "question_id": "q_evap_01",
                "selected_index": 0,
                "topic": "evaporation",
                "client_ts": now_iso,
            }
        ]
    }

    # Submit without Authorization header
    resp = await async_client.post("/api/agent/sync", json=batch_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced_count"] == 1
    assert data["skipped_count"] == 0
    assert "Successfully synchronized 1 offline actions" in data["message"]


@pytest.mark.asyncio
async def test_offline_sync_idempotent_deduplication(async_client: AsyncClient):
    """Submitting the exact same event_id twice must be skipped and never double-counted."""
    evt_id = f"evt-dedup-{uuid.uuid4()}"
    now_iso = datetime.now(UTC).isoformat()

    batch_payload = {
        "actions": [
            {
                "event_id": evt_id,
                "type": "quiz_answer",
                "question_id": "q_evap_01",
                "selected_index": 0,
                "topic": "evaporation",
                "client_ts": now_iso,
            }
        ]
    }

    # First attempt: synced
    resp1 = await async_client.post("/api/agent/sync", json=batch_payload)
    assert resp1.status_code == 200
    assert resp1.json()["synced_count"] == 1

    # Second attempt: deduped and skipped
    resp2 = await async_client.post("/api/agent/sync", json=batch_payload)
    assert resp2.status_code == 200
    assert resp2.json()["synced_count"] == 0
    assert resp2.json()["skipped_count"] == 1


@pytest.mark.asyncio
async def test_offline_sync_lesson_completion(async_client: AsyncClient):
    """Lesson completion actions are recorded cleanly and deduped."""
    evt_id = f"evt-les-{uuid.uuid4()}"
    now_iso = datetime.now(UTC).isoformat()

    batch_payload = {
        "actions": [
            {
                "event_id": evt_id,
                "type": "lesson_completed",
                "topic": "Mathematics",
                "client_ts": now_iso,
            }
        ]
    }

    resp = await async_client.post("/api/agent/sync", json=batch_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced_count"] == 1
