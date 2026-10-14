"""Pytest test verifying Diagnostic, Dynamic Planner, and Lesson Player grounded in NCERT."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_study_plan_and_lesson_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Guest login
        auth_resp = await client.post("/api/auth/guest")
        assert auth_resp.status_code == 200
        auth_data = auth_resp.json()
        token = auth_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Before diagnostic -> needs_diagnostic: True, items: []
        plan_before = await client.get("/api/studyplan", headers=headers)
        assert plan_before.status_code == 200
        plan_data = plan_before.json()
        assert plan_data["needs_diagnostic"] is True
        assert len(plan_data["items"]) == 0

        # 3. Get diagnostic questions
        diag_resp = await client.get("/api/assessment/diagnostic", headers=headers)
        assert diag_resp.status_code == 200
        diag_q = diag_resp.json()
        assert diag_q["count"] >= 5

        # 4. Submit diagnostic with known answers
        answers = [
            {"question_id": "diag_sci_01_matter_evaporation", "selected_index": 1},
            {"question_id": "diag_sci_02_cell_mitochondria", "selected_index": 1},
            {"question_id": "diag_sci_03_motion_velocity", "selected_index": 1},
            {"question_id": "diag_sci_04_force_inertia", "selected_index": 1},
            {"question_id": "diag_sci_05_gravitation_mass_weight", "selected_index": 0},  # Wrong -> misconception
            {"question_id": "diag_sci_06_cell_plasma_membrane", "selected_index": 0},      # Wrong -> misconception
        ]
        submit_resp = await client.post(
            "/api/assessment/diagnostic/submit",
            json={"answers": answers, "lang": "en"},
            headers=headers,
        )
        assert submit_resp.status_code == 200
        eval_data = submit_resp.json()
        assert eval_data["score"] == 4
        assert len(eval_data["misconceptions_identified"]) == 2

        # 5. After diagnostic -> personalized study plan with Review & Learn
        plan_after = await client.get("/api/studyplan?lang=en", headers=headers)
        assert plan_after.status_code == 200
        plan_after_data = plan_after.json()
        assert plan_after_data["needs_diagnostic"] is False
        assert len(plan_after_data["items"]) > 0

        # Verify no fresh items are marked 'done'
        for it in plan_after_data["items"]:
            assert it["status"] == "not_started"

        # 6. Lesson Player for concept
        target_concept = plan_after_data["items"][0]["concept_id"]
        lesson_resp = await client.get(f"/api/lesson/{target_concept}?lang=en", headers=headers)
        assert lesson_resp.status_code == 200
        lesson_data = lesson_resp.json()
        assert "hook" in lesson_data["blocks"]
        assert "explanation" in lesson_data["blocks"]
        assert "rural_example" in lesson_data["blocks"]

        # 7. Tutor Agent simplification (attempt 1)
        simp1_resp = await client.post(
            "/api/lesson/simplify",
            json={"concept_id": target_concept, "attempt": 1, "lang": "en"},
            headers=headers,
        )
        assert simp1_resp.status_code == 200
        assert simp1_resp.json()["can_retry"] is True

        # 8. Tutor Agent simplification (attempt 2 -> prerequisite recommendation)
        simp2_resp = await client.post(
            "/api/lesson/simplify",
            json={"concept_id": target_concept, "attempt": 2, "lang": "en"},
            headers=headers,
        )
        assert simp2_resp.status_code == 200
        assert simp2_resp.json()["suggest_prerequisite"] is True
