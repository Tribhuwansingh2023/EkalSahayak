"""Automated tests for Next Best Teaching Action 5+1 Agent Workflow."""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.agent.next_action_workflow import get_next_action_workflow
from app.db import get_database


@pytest.mark.asyncio
async def test_next_action_workflow_priority_recommendation():
    """Scenario 1: Evaluates observations, diagnoses gaps, and selects verified top priority action."""
    workflow = get_next_action_workflow()
    teacher_id = "test_teacher_auto_001"

    res = await workflow.run_workflow(teacher_id=teacher_id, lang="en")
    assert res["has_recommendation"] is True
    rec = res["recommendation"]

    # Grade 4 has 2 students with difficulties (< 40%) -> highest urgency
    assert "revise" in rec["action_title"].lower() and "root" in rec["action_title"].lower()
    assert rec["suggested_activity"]["id"] == "act_g4_roots_01"
    assert rec["suggested_activity"]["route"] == "/lesson/g4_roots_venation"
    assert len(rec["alternative_activities"]) >= 2

    # Verification passed
    assert res["verification"]["is_verified"] is True
    assert len(res["verification"]["checks_passed"]) >= 3

    # Auditable trace contains all 4 executed pipeline steps
    trace = res["trace"]
    assert len(trace) >= 4
    agent_names = [t["agent"] for t in trace]
    assert "ClassroomObservationAgent" in agent_names
    assert "LearningGapAnalysisAgent" in agent_names
    assert "TeachingPriorityAgent" in agent_names
    assert "RecommendationVerificationAgent" in agent_names

    # Multi-grade companion strategy present
    assert "multi_grade_coordination" in rec
    coord = rec["multi_grade_coordination"]
    assert coord["teacher_led_grade"] == "Grade 4"
    assert len(coord["independent_grades"]) == 2


@pytest.mark.asyncio
async def test_next_action_teacher_dismissal_memory_loop():
    """Scenario 6: Teacher dismissal is respected; workflow rotates to next highest priority."""
    workflow = get_next_action_workflow()
    teacher_id = "test_teacher_dismissal_999"

    db = get_database()
    await db.teaching_actions.delete_many({"teacher_id": teacher_id})

    # Step 1: Run workflow to get Grade 4 top recommendation
    res1 = await workflow.run_workflow(teacher_id=teacher_id, lang="en")
    action_id = res1["recommendation"]["action_id"]

    # Step 2: Teacher dismisses this recommendation
    decision_res = await workflow.approval_agent.record_decision(
        teacher_id=teacher_id,
        action_id=action_id,
        decision="dismissed",
        notes="Class already covered this outside yesterday.",
    )
    assert decision_res["success"] is True

    # Step 3: Run workflow again -> Grade 4 action must NOT be repeated! Grade 3 Math should now be prioritized
    res2 = await workflow.run_workflow(teacher_id=teacher_id, lang="en")
    assert res2["has_recommendation"] is True
    rec2 = res2["recommendation"]
    assert rec2["action_id"] != action_id
    assert rec2["target_grade_num"] == 3
    assert "Place Value" in rec2["concept"]


@pytest.mark.asyncio
async def test_next_action_api_endpoints():
    """Verify HTTP GET /api/teacher/next-action and POST /api/teacher/next-action/decision."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/teacher/next-action?lang=en")
        assert res.status_code == 200
        data = res.json()
        assert data["has_recommendation"] is True
        assert "recommendation" in data

        action_id = data["recommendation"]["action_id"]

        # Post start decision
        post_res = await ac.post("/api/teacher/next-action/decision", json={
            "action_id": action_id,
            "decision": "started",
            "selected_activity_id": "act_g4_roots_01",
            "notes": "Teacher starting 15-minute guided lesson",
        })
        assert post_res.status_code == 200
        post_data = post_res.json()
        assert post_data["success"] is True
        assert post_data["decision"] == "started"

        # Post approve decision
        approve_res = await ac.post("/api/teacher/next-action/decision", json={
            "action_id": action_id,
            "decision": "approved",
            "notes": "Approved by class teacher",
        })
        assert approve_res.status_code == 200
        assert approve_res.json()["decision"] == "approved"

        # Post edit decision
        edit_res = await ac.post("/api/teacher/next-action/decision", json={
            "action_id": action_id,
            "decision": "edited",
            "selected_activity_id": "act_g4_roots_peer",
            "notes": "Switched to peer observation",
        })
        assert edit_res.status_code == 200
        assert edit_res.json()["decision"] == "edited"
        assert edit_res.json()["selected_activity_id"] == "act_g4_roots_peer"

        # Get latest decision
        get_dec_res = await ac.get(f"/api/teacher/next-action/decision/{action_id}")
        assert get_dec_res.status_code == 200
        assert get_dec_res.json()["has_decision"] is True
        assert get_dec_res.json()["decision"]["decision"] == "edited"

        # Trace endpoint
        trace_res = await ac.get("/api/teacher/next-action/trace")
        assert trace_res.status_code == 200
        trace_data = trace_res.json()
        assert "trace" in trace_data
        assert len(trace_data["trace"]) >= 6

