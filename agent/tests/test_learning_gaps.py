"""Automated tests for EkalSahayak Learning Gap Detector."""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db import get_database


@pytest.mark.asyncio
async def test_learning_gaps_unassessed_state():
    """Requirement 3 & 5: When no assessment data exists, concepts must be 'Not assessed', never '0%'."""
    user_id = "test_unassessed_student_999"
    db = get_database()
    # Clean up any leftover profile/attempts
    await db.profiles.delete_one({"user_id": user_id})
    await db.quiz_attempts.delete_many({"user_id": user_id})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(f"/api/learning-gaps?lang=en")
        assert response.status_code == 200
        data = response.json()
        assert "has_assessment_data" in data
        assert "all_concepts" in data

        # Check concept states
        for c in data["all_concepts"]:
            if not c.get("has_assessment"):
                assert c["state"] == "not_assessed"
                assert c["status_label"] == "Not assessed"
                assert c["mastery_percent"] is None, "Untested concept must not display a 0% number"


@pytest.mark.asyncio
async def test_learning_gaps_weak_concept_detection():
    """Requirement 2: Low mastery or active misconception flags concept as 'Needs practice'."""
    user_id = "test_weak_student_123"
    db = get_database()
    await db.profiles.delete_one({"user_id": user_id})
    await db.quiz_attempts.delete_many({"user_id": user_id})

    # Seed profile with low mastery in evaporation and active misconception
    await db.profiles.insert_one({
        "user_id": user_id,
        "role": "student",
        "grade": "Class 9",
        "diagnostic_completed": True,
        "mastery_graph": {
            "evaporation": 0.30,
            "motion": 0.85,
        },
        "evidence_count": {
            "evaporation": 2,
            "motion": 4,
        },
        "misconceptions": [
            {
                "concept_id": "evaporation",
                "text": "Confuses boiling with evaporation (requires 100°C)",
                "resolved": False,
            }
        ],
    })

    from app.services.learning_gap_service import get_learning_gap_service
    gap_svc = get_learning_gap_service()
    data = await gap_svc.get_learning_gaps(user_id=user_id, lang="en")

    assert data["has_assessment_data"] is True
    assert data["weak_concepts_count"] >= 1

    evap_gap = next((c for c in data["weak_concepts"] if c["id"] == "evaporation"), None)
    assert evap_gap is not None
    assert evap_gap["status"] == "Needs practice"
    assert evap_gap["current_mastery_percent"] == 30
    assert "boiling" in evap_gap["flag_reason"].lower()
    assert "recommended_activity" in evap_gap
    assert evap_gap["recommended_activity"]["type"] == "lesson"
    assert "rural_context" in evap_gap["recommended_activity"]
    assert "mati matia" in evap_gap["recommended_activity"]["rural_context"].lower()
    assert evap_gap["retake_quiz"]["available"] is True
    assert evap_gap["retake_quiz"]["question"] is not None


@pytest.mark.asyncio
async def test_learning_gaps_retake_quiz_and_honest_comparison():
    """Requirement 2.C: Retake quiz updates mastery atomically and reports honest comparison."""
    user_id = "test_retake_student_456"
    db = get_database()
    await db.profiles.delete_one({"user_id": user_id})
    await db.quiz_attempts.delete_many({"user_id": user_id})

    # Seed initial low mastery
    await db.profiles.insert_one({
        "user_id": user_id,
        "role": "student",
        "grade": "Class 9",
        "diagnostic_completed": True,
        "mastery_graph": {"evaporation": 0.30},
        "evidence_count": {"evaporation": 1},
        "misconceptions": [
            {
                "concept_id": "evaporation",
                "text": "Evaporation only at boiling point",
                "resolved": False,
            }
        ],
    })

    from app.services.learning_gap_service import get_learning_gap_service
    gap_svc = get_learning_gap_service()

    # Step 1: Retake with correct answer (correct index is 0 for q_evap_01)
    retake_result = await gap_svc.retake_concept_quiz(
        user_id=user_id,
        topic="evaporation",
        question_id="q_evap_01",
        selected_index=0,
    )

    assert retake_result.get("success") is True, f"Retake failed: {retake_result}"
    assert retake_result["is_correct"] is True
    assert retake_result["pre_mastery_percent"] == 30
    assert retake_result["post_mastery_percent"] == 50
    assert retake_result["comparison_status"] == "improved"
    assert "improved" in retake_result["comparison_message"].lower()

    # Verify profile updated in Mongo
    updated_profile = await db.profiles.find_one({"user_id": user_id})
    assert updated_profile["mastery_graph"]["evaporation"] == 0.50
    assert updated_profile["evidence_count"]["evaporation"] == 2

    # Verify misconception marked resolved
    resolved_misc = [m for m in updated_profile.get("misconceptions", []) if m.get("concept_id") == "evaporation"]
    assert resolved_misc and resolved_misc[0].get("resolved") is True


@pytest.mark.asyncio
async def test_retake_question_endpoint():
    """Verify GET /api/learning-gaps/question returns valid question for topic."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/learning-gaps/question?topic=evaporation&lang=en")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == "q_evap_01"
        assert len(data["options"]) == 4
        assert "water" in data["prompt"].lower() or "evaporation" in data["prompt"].lower()
