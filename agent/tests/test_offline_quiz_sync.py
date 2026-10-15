"""Unit and Integration Tests for Offline Quiz & Sync Feature."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


@pytest.mark.asyncio
async def test_get_published_quizzes(client):
    """Verify GET /api/quizzes returns published quiz metadata."""
    res = await client.get("/api/quizzes")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 3

    # Check required fields
    quiz = data[0]
    assert "quiz_id" in quiz
    assert "title" in quiz
    assert "grade" in quiz
    assert "section" in quiz
    assert "question_count" in quiz
    assert quiz["question_count"] > 0
    assert "questions" in quiz


@pytest.mark.asyncio
async def test_get_quiz_detail(client):
    """Verify GET /api/quizzes/{quiz_id} returns full quiz details."""
    res = await client.get("/api/quizzes/quiz_g4_math_02")
    assert res.status_code == 200
    quiz = res.json()
    assert quiz["quiz_id"] == "quiz_g4_math_02"
    assert quiz["grade"] == "Grade 4"
    assert len(quiz["questions"]) >= 5
    q1 = quiz["questions"][0]
    assert "question_id" in q1
    assert "prompt" in q1
    assert "options" in q1
    assert "correct_index" in q1


@pytest.mark.asyncio
async def test_get_submitted_results(client):
    """Verify GET /api/results returns completed results."""
    res = await client.get("/api/results")
    assert res.status_code == 200
    results = res.json()
    assert isinstance(results, list)
    assert len(results) >= 1

    r = results[0]
    assert "id" in r
    assert "quiz_id" in r
    assert "title" in r
    assert "grade" in r
    assert "section" in r
    assert "score" in r
    assert "total" in r
    assert "percentage" in r
    assert "feedback" in r
    assert "status" in r


@pytest.mark.asyncio
async def test_idempotent_quiz_sync(client):
    """Verify POST /api/quizzes/sync validates answers and is idempotent."""
    attempt_payload = {
        "attempt_id": "test_idempotent_att_999",
        "quiz_id": "quiz_g4_math_02",
        "student_id": "student_odisha_01",
        "answers": [
            {"question_id": "g4_q1", "selected_option": 0},
            {"question_id": "g4_q2", "selected_option": 2},
            {"question_id": "g4_q3", "selected_option": 1},
            {"question_id": "g4_q4", "selected_option": 2},
            {"question_id": "g4_q5", "selected_option": 1},
        ],
        "completed_at": "2026-10-15T07:30:00Z"
    }

    # First submission
    res1 = await client.post("/api/quizzes/sync", json=attempt_payload)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["success"] is True
    assert data1["attempt_id"] == "test_idempotent_att_999"
    assert data1["status"] == "synchronized"
    assert data1["score"] == 5
    assert data1["total"] == 5
    assert data1["percentage"] == 100.0

    # Second submission (Idempotency test: duplicate submission should not fail or re-score)
    res2 = await client.post("/api/quizzes/sync", json=attempt_payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["success"] is True
    assert data2["attempt_id"] == "test_idempotent_att_999"
    assert data2["score"] == 5
    assert "already synchronized" in data2["message"].lower() or "idempotent" in data2["message"].lower()
