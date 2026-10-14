"""Tests for Native Class 9 Pedagogical Model trained on NCERT Textbooks.

Verifies:
1. NCERT Class 9 dataset extraction completeness (all 12 chapters, >60,000 words).
2. Model training and dense semantic representation.
3. Antigravity Agentic Loop:
   - Step 1: Planning (intent, prerequisite, misconception boundary).
   - Step 2: Action (grounded Odia explanation, rural cultural anchor, NCERT micro-quiz).
   - Step 3: Failure Reflection & Recovery ("if failure how it fixes"):
     Root-cause diagnosis, step-down scaffolding analogy, and remedial micro-drill.
4. FastAPI endpoint integration (/api/agent/reflect-failure and /api/agent/interact).
"""

import json
import os

import pytest
from httpx import AsyncClient

from app.ml.pedagogical_model import (
    Class9AgenticModel,
    get_class9_agentic_model,
)


async def get_auth_token(async_client: AsyncClient, username: str = "class9_tester") -> str:
    """Helper to register and obtain auth token with real database user ObjectId."""
    resp = await async_client.post(
        "/api/auth/register",
        json={
            "username": username,
            "email": f"{username}@odisha.edu.in",
            "password": "StrongPassword123!",
        },
    )
    return resp.json()["access_token"]


def test_ncert_corpus_extraction_completeness():
    """Verifies that all 12 Science chapters were extracted into ncert_class9_corpus.json."""
    corpus_path = r"c:\Users\tribh\Downloads\EkalShayak\EkalSahayak\agent\app\data\ncert_class9_corpus.json"
    assert os.path.exists(corpus_path), f"Corpus file does not exist at {corpus_path}"

    with open(corpus_path, encoding="utf-8") as f:
        data = json.load(f)

    assert data["class"] == 9
    assert data["total_chapters"] == 12
    assert data["total_words"] > 60000
    assert len(data["chapters"]) == 12

    # Verify key chapters exist
    chapter_titles = [c["title"] for c in data["chapters"]]
    assert "Matter in Our Surroundings" in chapter_titles
    assert "The Fundamental Unit of Life" in chapter_titles
    assert "Motion" in chapter_titles
    assert "Force and Laws of Motion" in chapter_titles
    assert "Gravitation" in chapter_titles


def test_model_training_and_serialization(tmp_path):
    """Verifies model trains on corpus and can be serialized/deserialized."""
    corpus_path = r"c:\Users\tribh\Downloads\EkalShayak\EkalSahayak\agent\app\data\ncert_class9_corpus.json"
    model = Class9AgenticModel()
    model.train_from_corpus(corpus_path)
    assert model.is_trained is True

    # Test serialization
    save_file = str(tmp_path / "test_model.pkl")
    model.save_model(save_file)
    assert os.path.exists(save_file)

    # Test loading
    new_model = Class9AgenticModel()
    new_model.load_model(save_file)
    assert new_model.is_trained is True


def test_antigravity_step1_planning():
    """Verifies planning breaks down student inquiry into pedagogical steps and checks prerequisites."""
    model = get_class9_agentic_model()

    # Query 1: Evaporation inquiry with misconception trigger
    q1 = "ଖରାଦିନେ ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ? କିନ୍ତୁ ପାଣି ତ ୧୦୦ ଡିଗ୍ରୀରେ ଫୁଟେ!"
    plan1 = model.plan_interaction(q1)

    assert plan1["stage"] == "PLANNING"
    assert plan1["target_topic"] == "evaporation"
    assert plan1["target_chapter"] == 1
    assert plan1["diagnosed_misconception"] is not None
    assert "୧୦୦" in plan1["diagnosed_misconception"] or "100" in plan1["diagnosed_misconception"]
    assert plan1["prerequisite_required"] is True
    assert len(plan1["steps"]) == 5

    # Query 2: Newton's First Law / Inertia inquiry
    q2 = "ଚଳନ୍ତା ବସ୍ରେ ବ୍ରେକ୍ ମାରିଲେ ଆମେ ଆଗକୁ କାହିଁକି ଝୁଙ୍କି ପଡ଼ୁ? (What is inertia?)"
    plan2 = model.plan_interaction(q2)

    assert plan2["stage"] == "PLANNING"
    assert plan2["target_topic"] == "force"
    assert plan2["target_chapter"] == 8
    assert "Inertia" in plan2["topic_title"] or "Force" in plan2["topic_title"]


def test_antigravity_step2_action_execution():
    """Verifies action execution produces grounded Odia explanation, rural analogy, and NCERT micro-quiz."""
    model = get_class9_agentic_model()
    q = "ମାଟି ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ?"
    plan = model.plan_interaction(q)
    action = model.execute_action(plan, q)

    assert action["stage"] == "ACTION_EXECUTED"
    assert action["detected_topic"] == "evaporation"
    assert "ମାଟି ମାଠିଆ" in action["response_odia"]
    assert "NCERT Class 9 Science" in action["response_odia"]
    assert len(action["micro_quiz"]) >= 1

    # Check that micro-quiz contains valid questions and options
    q_item = action["micro_quiz"][0]
    assert "question_odia" in q_item
    assert len(q_item["options_odia"]) >= 4
    assert 0 <= q_item["correct_index"] < len(q_item["options_odia"])


def test_antigravity_step3_failure_reflection_and_recovery():
    """Verifies that when a student fails a quiz or shows confusion, the model diagnoses the root cause and synthesizes a remedial fix."""
    model = get_class9_agentic_model()

    # Case A: Student selects incorrect distractor 0 ("Condensation") for evaporation question
    fix_result = model.reflect_and_fix(
        concept_key="evaporation",
        student_answer_index=0,
        question_id="ncert_evap_q1",
    )

    assert fix_result["status"] == "FAILURE_DETECTED_AND_FIXED"
    assert fix_result["recovery_needed"] is True
    assert "reflection" in fix_result
    assert "root_cause" in fix_result["reflection"]
    assert fix_result["reflection"]["student_choice"] == "ଘନୀଭବନ (Condensation) ହେତୁ"

    # Verifies empathetic scaffolding in Odia
    remedial_odia = fix_result["remedial_explanation_odia"]
    assert "ଭୁଲ୍ ହେଲା, କିନ୍ତୁ ବିଲକୁଲ୍ ଚିନ୍ତା କର ନାହିଁ" in remedial_odia
    assert "ସରଳ ପାହାଚ" in remedial_odia

    # Verifies step-down remedial check item
    scaffold = fix_result["scaffolded_check"]
    assert scaffold["id"].startswith("remedial_")
    assert len(scaffold["options_odia"]) == 2
    assert scaffold["correct_index"] == 0

    # Case B: Student answers correctly -> No failure recovery needed
    success_result = model.reflect_and_fix(
        concept_key="evaporation",
        student_answer_index=1,
        question_id="ncert_evap_q1",
    )
    assert success_result["status"] == "SUCCESS"
    assert success_result["recovery_needed"] is False


@pytest.mark.asyncio
async def test_reflect_failure_api_endpoint(async_client: AsyncClient):
    """Verifies authenticated POST /api/agent/reflect-failure endpoint."""
    token = await get_auth_token(async_client, "student_tester_reflect")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "topic": "evaporation",
        "question_id": "ncert_evap_q1",
        "selected_index": 2,  # Incorrect option
        "student_query": "ମୁଁ ଭାବିଲି ୧୦୦ ଡିଗ୍ରୀରେ ଫୁଟିବ",
    }
    resp = await async_client.post("/api/agent/reflect-failure", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "FAILURE_DETECTED_AND_FIXED"
    assert data["recovery_needed"] is True
    assert "remedial_explanation_odia" in data
    assert "scaffolded_check" in data


@pytest.mark.asyncio
async def test_native_model_powers_agent_interact(async_client: AsyncClient):
    """Verifies that /api/agent/interact runs natively on the trained Class 9 model without external APIs."""
    token = await get_auth_token(async_client, "student_tester_interact")
    headers = {"Authorization": f"Bearer {token}"}

    req_payload = {
        "query": "ଚଳନ୍ତା ବସ୍ରେ ବ୍ରେକ୍ ମାରିଲେ ଆମେ ଆଗକୁ କାହିଁକି ଝୁଙ୍କି ପଡ଼ୁ?",
        "language": "odia",
        "input_type": "text",
        "is_offline": False,
    }
    resp = await async_client.post("/api/agent/interact", json=req_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["detected_topic"] == "force"
    assert "final_response_odia" in data
    assert len(data["final_response_odia"]) > 50
    # Verifies traces exist and contain execution steps
    traces = data["traces"]
    step_names = [t["step_name"] for t in traces]
    assert "INTAKE_AND_PREREQUISITE_DIAGNOSIS" in step_names
    assert "VERNACULAR_ANALOGY_GENERATION" in step_names
    assert "FORMATIVE_ASSESSMENT_CREATION" in step_names
