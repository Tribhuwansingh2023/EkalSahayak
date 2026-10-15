"""Automated tests for Diagnostic Assessment Workflow, result persistence, and evidence-based learning gaps."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_diagnostic_workflow_persistence_and_evidence():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Guest login
        auth_resp = await client.post("/api/auth/guest")
        assert auth_resp.status_code == 200
        token = auth_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Before diagnostic: no previous results
        results_before = await client.get("/api/assessment/diagnostic/results", headers=headers)
        assert results_before.status_code == 200
        assert results_before.json()["has_results"] is False

        # 3. Fetch questions
        q_resp = await client.get("/api/assessment/diagnostic", headers=headers)
        assert q_resp.status_code == 200
        q_data = q_resp.json()
        assert q_data["count"] >= 5
        assert q_data["has_previous_result"] is False

        # 4. Submit 6 questions: 4 correct, 2 wrong (Question 1 wrong -> Evaporation, Question 5 wrong -> Gravitation)
        submissions = [
            {"question_id": "diag_sci_01_matter_evaporation", "selected_index": 0},  # Wrong: option 0
            {"question_id": "diag_sci_02_cell_mitochondria", "selected_index": 1},   # Correct: option 1
            {"question_id": "diag_sci_03_motion_velocity", "selected_index": 1},     # Correct: option 1
            {"question_id": "diag_sci_04_force_inertia", "selected_index": 1},       # Correct: option 1
            {"question_id": "diag_sci_05_gravitation_mass_weight", "selected_index": 2}, # Wrong: option 2
            {"question_id": "diag_sci_06_cell_plasma_membrane", "selected_index": 1}, # Correct: option 1
        ]
        sub_resp = await client.post(
            "/api/assessment/diagnostic/submit",
            json={"answers": submissions, "lang": "en"},
            headers=headers,
        )
        assert sub_resp.status_code == 200
        eval_data = sub_resp.json()

        # Score must be 4/6 = 67%, not hardcoded 3/6
        assert eval_data["score"] == 4
        assert eval_data["total"] == 6
        assert eval_data["percentage"] == 0.67
        assert eval_data["diagnostic_completed"] is True

        # Topic aliases must be populated
        assert "evaporation" in eval_data["mastery_seeded"]
        assert eval_data["mastery_seeded"]["evaporation"] == 0.25
        assert "cell_biology" in eval_data["mastery_seeded"]
        assert eval_data["mastery_seeded"]["cell_biology"] == 0.70

        # Misconceptions derived from actual incorrect answers
        assert len(eval_data["misconceptions_identified"]) == 2
        evap_misc = next(m for m in eval_data["misconceptions_identified"] if "evaporation" in m["concept_id"])
        assert "ceramic heat conduction" in evap_misc["text"]

        # 5. Persisted results available via GET /api/assessment/diagnostic/results
        persisted_resp = await client.get("/api/assessment/diagnostic/results", headers=headers)
        assert persisted_resp.status_code == 200
        persisted_data = persisted_resp.json()
        assert persisted_data["has_results"] is True
        res = persisted_data["result"]
        assert res["score"] == 4
        assert res["total"] == 6
        assert len(res["breakdown"]) == 6

        # 6. Re-fetching questions indicates has_previous_result: True
        q_resp2 = await client.get("/api/assessment/diagnostic", headers=headers)
        assert q_resp2.status_code == 200
        assert q_resp2.json()["has_previous_result"] is True


@pytest.mark.asyncio
async def test_diagnostic_unmapped_question_handling():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        auth_resp = await client.post("/api/auth/guest")
        token = auth_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Submit unmapped question ID
        sub_resp = await client.post(
            "/api/assessment/diagnostic/submit",
            json={"answers": [{"question_id": "non_existent_q999", "selected_index": 0}], "lang": "en"},
            headers=headers,
        )
        assert sub_resp.status_code == 200
        eval_data = sub_resp.json()
        assert eval_data["score"] == 0
        # Breakdown flags for review without inventing false misconception
        assert len(eval_data["breakdown"]) == 1
        assert eval_data["breakdown"][0]["flagged_for_review"] is True
