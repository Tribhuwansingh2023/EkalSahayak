"""Phase 2: Server-Authoritative Quiz & Mastery Test Suite (Anti-Cheat).

Covers:
- Questions served to clients strictly omit correct answers
- Server-authoritative answer scoring
- Out-of-bounds option index validation
- Idempotency: duplicate attempt_ids are not double-counted
- Daily mastery gain cap (+0.30/day maximum) to stop farming
- Offline sync: server re-scores, dedupes by event_id, rejects future/stale timestamps, rejects client scores
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient


async def get_auth_token(async_client: AsyncClient, username: str = "quiz_tester") -> str:
    """Helper to register and obtain auth token."""
    resp = await async_client.post(
        "/api/auth/register",
        json={
            "username": username,
            "email": f"{username}@odisha.edu.in",
            "password": "StrongPassword123!",
        },
    )
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_questions_served_do_not_contain_correct_index(async_client: AsyncClient):
    """Served questions must strictly omit correct_index and answers."""
    token = await get_auth_token(async_client, "tester_q_strip")

    resp = await async_client.get(
        "/api/quiz/questions?topic=evaporation&limit=5",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    questions = resp.json()
    assert len(questions) > 0

    for q in questions:
        assert "correct_index" not in q
        assert "correct_option_index" not in q
        assert "answer" not in q
        assert "id" in q
        assert "prompt_odia" in q
        assert len(q["options_odia"]) >= 2


@pytest.mark.asyncio
async def test_server_authoritative_scoring_correct_and_wrong(async_client: AsyncClient):
    """Server evaluates answer from database question bank, updating mastery."""
    token = await get_auth_token(async_client, "tester_scoring")

    # 1. Submit correct answer for q_evap_01 (option 0)
    att_1 = str(uuid.uuid4())
    resp_correct = await async_client.post(
        "/api/quiz/answer",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "question_id": "q_evap_01",
            "selected_index": 0,
            "attempt_id": att_1,
        },
    )
    assert resp_correct.status_code == 200
    data1 = resp_correct.json()
    assert data1["correct"] is True
    assert data1["score_awarded"] == 10
    assert data1["new_mastery"] > 0.40

    # 2. Submit wrong answer for q_evap_01 (option 1)
    att_2 = str(uuid.uuid4())
    resp_wrong = await async_client.post(
        "/api/quiz/answer",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "question_id": "q_evap_01",
            "selected_index": 1,
            "attempt_id": att_2,
        },
    )
    assert resp_wrong.status_code == 200
    data2 = resp_wrong.json()
    assert data2["correct"] is False
    assert data2["score_awarded"] == 0
    assert data2["new_mastery"] < data1["new_mastery"]


@pytest.mark.asyncio
async def test_out_of_range_index_rejected(async_client: AsyncClient):
    """Option indices outside valid range return 422."""
    token = await get_auth_token(async_client, "tester_out_of_bounds")

    # Question q_evap_01 has 4 options (indices 0, 1, 2, 3)
    resp = await async_client.post(
        "/api/quiz/answer",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "question_id": "q_evap_01",
            "selected_index": 9,
            "attempt_id": str(uuid.uuid4()),
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_idempotent_attempts_not_double_counted(async_client: AsyncClient):
    """Replaying the same (user, question, attempt_id) does not increase mastery twice."""
    token = await get_auth_token(async_client, "tester_idempotent")
    fixed_attempt_id = f"fixed-attempt-{uuid.uuid4()}"

    # First attempt: increases mastery
    resp1 = await async_client.post(
        "/api/quiz/answer",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "question_id": "q_evap_01",
            "selected_index": 0,
            "attempt_id": fixed_attempt_id,
        },
    )
    mastery1 = resp1.json()["new_mastery"]

    # Second attempt (replay of exact same attempt_id): mastery remains identical
    resp2 = await async_client.post(
        "/api/quiz/answer",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "question_id": "q_evap_01",
            "selected_index": 0,
            "attempt_id": fixed_attempt_id,
        },
    )
    mastery2 = resp2.json()["new_mastery"]
    assert mastery1 == mastery2


@pytest.mark.asyncio
async def test_daily_mastery_gain_cap(async_client: AsyncClient):
    """Positive mastery gain per topic is capped at +0.30 per day."""
    token = await get_auth_token(async_client, "tester_gain_cap")

    # Each correct answer adds +0.08
    # 4 correct answers = 4 * 0.08 = 0.32 -> 4th should be capped
    mastery_history = []
    for _ in range(5):
        resp = await async_client.post(
            "/api/quiz/answer",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "question_id": "q_evap_01",
                "selected_index": 0,
                "attempt_id": str(uuid.uuid4()),
            },
        )
        assert resp.status_code == 200
        mastery_history.append(resp.json())

    # Check that cap was triggered
    capped_attempts = [m for m in mastery_history if m.get("daily_gain_capped") is True]
    assert len(capped_attempts) > 0
    # Final mastery gain cannot exceed +0.30 over initial 0.40
    assert mastery_history[-1]["new_mastery"] <= 0.7001


@pytest.mark.asyncio
async def test_offline_sync_deduplication_and_server_scoring(async_client: AsyncClient):
    """Offline batch reconciles events server-side, dedupes by event_id, and rejects invalid dates."""
    token = await get_auth_token(async_client, "tester_sync")
    now_iso = datetime.now(UTC).isoformat()
    too_old_iso = (datetime.now(UTC) - timedelta(days=40)).isoformat()
    future_iso = (datetime.now(UTC) + timedelta(days=2)).isoformat()

    ev1 = f"evt-{uuid.uuid4()}"
    ev2 = f"evt-{uuid.uuid4()}"

    batch_payload = {
        "actions": [
            {
                "event_id": ev1,
                "type": "quiz_answer",
                "question_id": "q_evap_01",
                "selected_index": 0,
                "topic": "evaporation",
                "client_ts": now_iso,
            },
            {
                "event_id": ev2,
                "type": "quiz_answer",
                "question_id": "q_evap_02",
                "selected_index": 0,
                "topic": "evaporation",
                "client_ts": now_iso,
            },
            # Stale event (>30 days old)
            {
                "event_id": f"evt-{uuid.uuid4()}",
                "type": "quiz_answer",
                "question_id": "q_evap_01",
                "selected_index": 0,
                "topic": "evaporation",
                "client_ts": too_old_iso,
            },
            # Future event (>10 mins in future)
            {
                "event_id": f"evt-{uuid.uuid4()}",
                "type": "quiz_answer",
                "question_id": "q_evap_01",
                "selected_index": 0,
                "topic": "evaporation",
                "client_ts": future_iso,
            },
        ]
    }

    resp = await async_client.post(
        "/api/agent/sync",
        headers={"Authorization": f"Bearer {token}"},
        json=batch_payload,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced_count"] == 2
    assert data["skipped_count"] == 2

    # Replay same batch again: all valid events should now be deduped and skipped
    resp_replay = await async_client.post(
        "/api/agent/sync",
        headers={"Authorization": f"Bearer {token}"},
        json=batch_payload,
    )
    assert resp_replay.status_code == 200
    data_replay = resp_replay.json()
    assert data_replay["synced_count"] == 0
    assert data_replay["skipped_count"] == 4


@pytest.mark.asyncio
async def test_offline_sync_rejects_client_score(async_client: AsyncClient):
    """Client attempts to submit 'score': 999 are rejected by strict schema validation (422)."""
    token = await get_auth_token(async_client, "tester_cheat_score")

    payload = {
        "actions": [
            {
                "event_id": f"evt-{uuid.uuid4()}",
                "type": "quiz_answer",
                "question_id": "q_evap_01",
                "selected_index": 0,
                "score": 999,  # Injected cheat score!
                "client_ts": datetime.now(UTC).isoformat(),
            }
        ]
    }

    resp = await async_client.post(
        "/api/agent/sync",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert resp.status_code == 422
