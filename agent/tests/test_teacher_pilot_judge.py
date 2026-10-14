"""Pytest test verifying Teacher Multi-Grade Orchestrator, Pilot Evaluation, and Judge Mode."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_teacher_classroom_and_period_plan():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Authenticate user
        auth_resp = await client.post("/api/auth/guest")
        assert auth_resp.status_code == 200
        token = auth_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create a classroom
        create_resp = await client.post(
            "/api/teacher/classroom",
            json={
                "name": "Class 9 & 8 Composite Science",
                "grades": ["Class 8", "Class 9"],
            },
            headers=headers,
        )
        assert create_resp.status_code in (200, 201)
        classroom_data = create_resp.json()
        classroom_id = classroom_data["id"]
        assert "invite_code" in classroom_data

        # 3. Verify honest empty state for fresh classroom (0 students, no fake learners)
        dash_resp = await client.get(f"/api/teacher/dashboard/{classroom_id}", headers=headers)
        assert dash_resp.status_code == 200
        dash_data = dash_resp.json()
        assert dash_data["student_count"] == 0
        assert len(dash_data["stuck_concepts"]) == 0
        assert len(dash_data["misconception_clusters"]) == 0

        # 4. Plan my period - Multi-grade parallel orchestrator
        plan_resp = await client.post(
            "/api/teacher/plan-period",
            json={
                "classroom_id": classroom_id,
                "duration_minutes": 40,
                "subject": "Science",
            },
            headers=headers,
        )
        assert plan_resp.status_code == 200
        plan_data = plan_resp.json()
        assert "group_a" in plan_data
        assert "group_b" in plan_data
        assert "teacher_orchestration" in plan_data
        assert plan_data["duration_minutes"] == 40

        # 5. Printable period plan HTML
        print_resp = await client.get(f"/api/teacher/period-plan/print?classroom_id={classroom_id}", headers=headers)
        assert print_resp.status_code == 200
        assert "text/html" in print_resp.headers["content-type"]
        assert "One-Page Period Plan" in print_resp.text


@pytest.mark.asyncio
async def test_pilot_evaluation_and_judge_mode():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Init pilot session
        init_resp = await client.get("/api/pilot/init")
        assert init_resp.status_code == 200
        init_data = init_resp.json()
        participant_code = init_data["participant_code"]
        assert participant_code.startswith("PILOT-")

        # 2. Pilot pre-test questions
        pre_resp = await client.get(f"/api/pilot/pre-test?participant_code={participant_code}")
        assert pre_resp.status_code == 200
        pre_data = pre_resp.json()
        pre_qs = pre_data["questions"]
        assert len(pre_qs) >= 5

        # 3. Submit pre-test (score 2/5)
        pre_submit_resp = await client.post(
            "/api/pilot/pre-test/submit",
            json={
                "participant_code": participant_code,
                "answers": [
                    {"question_id": pre_qs[0]["id"], "selected_index": 1},
                    {"question_id": pre_qs[1]["id"], "selected_index": 1},
                    {"question_id": pre_qs[2]["id"], "selected_index": 0},
                    {"question_id": pre_qs[3]["id"], "selected_index": 0},
                    {"question_id": pre_qs[4]["id"], "selected_index": 0},
                ],
            },
        )
        assert pre_submit_resp.status_code == 200
        pre_res = pre_submit_resp.json()
        assert "score" in pre_res

        # 4. Post-test questions & submit (score higher to show positive delta)
        post_resp = await client.get(f"/api/pilot/post-test?participant_code={participant_code}")
        assert post_resp.status_code == 200
        post_data = post_resp.json()
        post_qs = post_data["questions"]
        assert len(post_qs) >= 5

        post_submit_resp = await client.post(
            "/api/pilot/post-test/submit",
            json={
                "participant_code": participant_code,
                "answers": [
                    {"question_id": q["id"], "selected_index": 1}
                    for q in post_qs[:5]
                ],
            },
        )
        assert post_submit_resp.status_code == 200
        post_res = post_submit_resp.json()
        assert "post_score" in post_res
        assert "gain_delta" in post_res

        # 5. Aggregate pilot summary
        summary_resp = await client.get("/api/pilot/summary")
        assert summary_resp.status_code == 200
        summary_data = summary_resp.json()
        assert summary_data["n"] >= 1
        assert "mean_pre" in summary_data
        assert "mean_post" in summary_data
        assert "mean_delta" in summary_data

        # 6. Export pilot CSV
        csv_resp = await client.get("/api/pilot/export-csv")
        assert csv_resp.status_code == 200
        assert "text/csv" in csv_resp.headers["content-type"]
        assert "Participant Code" in csv_resp.text

        # 7. Judge mode telemetry
        judge_resp = await client.get("/api/pilot/judge-mode")
        assert judge_resp.status_code == 200
        judge_data = judge_resp.json()
        assert judge_data["rag_total_chunks"] >= 2000
        assert judge_data["offline_chapter_pack_kb"] > 0
        assert judge_data["grounding_rate_pct"] >= 90.0
