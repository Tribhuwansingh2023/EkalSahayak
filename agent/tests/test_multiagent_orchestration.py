"""Comprehensive Test Suite for Hierarchical 5-Agent Multi-Agent Orchestration Network.

Validates:
1. CurriculumRAGAgent: Real NCERT Class 9 retrieval, citation extraction, out-of-curriculum boundaries.
2. PedagogicalDiagnosticAgent: Bloom's taxonomy 5 levels, prerequisite dependencies, misconception diagnosis.
3. VernacularCulturalAnchorAgent: Odia, zero-Devanagari Hinglish, audio scripts, refinement handling.
4. FactVerificationCriticAgent: Reflexion critic, hallucination risk scanning, groundedness scoring.
5. FormativeAssessmentAgent: 3-tier adaptive quizzes, server-authoritative scoring, monotonic mastery.
6. MultiAgentOrchestrator: Dual parallel dispatch, reflection loops, end-to-end consensus & telemetry.
7. Multiagent FastAPI Endpoints: /api/agent/multiagent/orchestrate, /agents, /debate.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.agent.multiagent.assessment_agent import FormativeAssessmentAgent
from app.agent.multiagent.base_agent import (
    AgentRole,
    BloomLevel,
    CriticVerdict,
)
from app.agent.multiagent.critic_agent import FactVerificationCriticAgent
from app.agent.multiagent.curriculum_rag_agent import CurriculumRAGAgent
from app.agent.multiagent.diagnostic_agent import PedagogicalDiagnosticAgent
from app.agent.multiagent.orchestrator import (
    MultiAgentOrchestrator,
    get_multiagent_orchestrator,
)
from app.agent.multiagent.vernacular_anchor_agent import VernacularCulturalAnchorAgent
from app.main import app


# =====================================================================
# 1. CurriculumRAGAgent Tests
# =====================================================================

@pytest.mark.asyncio
async def test_curriculum_rag_agent_real_ncert_retrieval():
    """Verifies that CurriculumRAGAgent retrieves genuine NCERT citations from real corpus."""
    agent = CurriculumRAGAgent()
    artifact, telemetry = await agent.execute(
        query="What is inertia and Newton's first law of motion?",
        shared_state={},
    )

    assert artifact["is_grounded"] is True
    assert artifact["is_out_of_curriculum"] is False
    assert "Force and Laws of Motion" in artifact["chapter"] or "NCERT" in artifact["citation"]
    assert len(artifact["key_terms"]) > 0
    assert "inertia" in artifact["key_terms"] or "force" in artifact["key_terms"]
    assert artifact["confidence"] >= 0.50

    # Telemetry checks
    assert telemetry.role == AgentRole.CURRICULUM_RAG
    assert telemetry.duration_ms > 0
    assert "hybrid" in telemetry.model_used


@pytest.mark.asyncio
async def test_curriculum_rag_agent_out_of_curriculum():
    """Verifies out-of-curriculum detection for non-syllabus queries."""
    agent = CurriculumRAGAgent()
    artifact, telemetry = await agent.execute(
        query="Explain Bitcoin cryptocurrency mining on GPU hardware",
        shared_state={},
    )

    assert artifact["is_out_of_curriculum"] is True
    assert artifact["is_grounded"] is False
    assert artifact["confidence"] <= 0.30


# =====================================================================
# 2. PedagogicalDiagnosticAgent Tests
# =====================================================================

@pytest.mark.asyncio
async def test_diagnostic_agent_bloom_levels():
    """Verifies Bloom's Taxonomy cognitive classification across levels 1 to 5."""
    diag = PedagogicalDiagnosticAgent()

    # Level 1: Remember
    art1, _ = await diag.execute("State the definition of inertia", {})
    assert art1["bloom_level"] == BloomLevel.REMEMBER.value

    # Level 2: Understand
    art2, _ = await diag.execute("Explain how evaporation works in simple words", {})
    assert art2["bloom_level"] == BloomLevel.UNDERSTAND.value

    # Level 3: Apply
    art3, _ = await diag.execute("What happens if a passenger jumps off a moving rural bus?", {})
    assert art3["bloom_level"] == BloomLevel.APPLY.value

    # Level 4: Analyze
    art4, _ = await diag.execute("What is the difference between mass and weight?", {})
    assert art4["bloom_level"] == BloomLevel.ANALYZE.value

    # Level 5: Evaluate
    art5, _ = await diag.execute("Is it true that heavier bodies fall faster in vacuum? Justify.", {})
    assert art5["bloom_level"] == BloomLevel.EVALUATE.value


@pytest.mark.asyncio
async def test_diagnostic_agent_misconception_detection():
    """Verifies automated scanning of student misconceptions."""
    diag = PedagogicalDiagnosticAgent()
    artifact, _ = await diag.execute(
        query="Doesn't action and reaction cancel each other out because they are equal and opposite?",
        shared_state={"detected_topic": "force"},
    )

    assert artifact["misconception_diagnosed"] is not None
    assert "cancel each other" in artifact["misconception_diagnosed"]
    assert "TWO DIFFERENT bodies" in artifact["misconception_remediation"]


# =====================================================================
# 3. VernacularCulturalAnchorAgent Tests
# =====================================================================

@pytest.mark.asyncio
async def test_vernacular_anchor_agent_odia_and_hinglish():
    """Verifies authentic rural Odia and zero-Devanagari Romanized Hinglish generation."""
    agent = VernacularCulturalAnchorAgent()

    # Odia
    odia_art, _ = await agent.execute(
        query="Why is water cool in a clay pot during summer?",
        shared_state={"language": "or", "detected_topic": "evaporation"},
    )
    assert "ମାଟି ମାଠିଆ" in odia_art["anchor_title"]
    assert "ଲୀନ ତାପ" in odia_art["explanation"]
    assert len(odia_art["audio_script"]) > 10

    # Hinglish (hi-Latn) - strictly Roman script
    hinglish_art, _ = await agent.execute(
        query="Why does matka water cool?",
        shared_state={"language": "hi-Latn", "detected_topic": "evaporation"},
    )
    assert "matke" in hinglish_art["explanation"]
    # Verify ZERO Devanagari characters in hi-Latn mode
    assert not any(0x0900 <= ord(ch) <= 0x097F for ch in hinglish_art["explanation"])


@pytest.mark.asyncio
async def test_vernacular_anchor_agent_critic_refinement():
    """Verifies that the agent incorporates corrective critic feedback during reflection."""
    agent = VernacularCulturalAnchorAgent()
    refined_art, telemetry = await agent.execute(
        query="Explain inertia",
        shared_state={
            "language": "en",
            "detected_topic": "inertia",
            "critic_critique": "Inertia depends exclusively on mass, independent of velocity.",
        },
    )

    assert refined_art["is_refined"] is True
    assert "Inertia depends exclusively on mass" in refined_art["explanation"]
    assert telemetry.artifacts["is_refined"] is True


# =====================================================================
# 4. FactVerificationCriticAgent Tests
# =====================================================================

@pytest.mark.asyncio
async def test_critic_agent_approval_on_grounded_content():
    """Verifies that grounded scientific explanation receives APPROVED verdict."""
    critic = FactVerificationCriticAgent()
    artifact, _ = await critic.execute(
        query="Explain evaporation",
        shared_state={
            "ncert_grounding": {
                "is_grounded": True,
                "key_terms": ["evaporation", "latent heat", "cooling"],
                "citation": "NCERT Class 9 Science, Chapter 1",
            },
            "vernacular_data": {
                "explanation": "Evaporation is a surface phenomenon where liquid absorbs latent heat of vaporisation to keep water cool.",
                "is_refined": False,
            },
        },
    )

    assert artifact["verdict"] == CriticVerdict.APPROVED.value
    assert artifact["is_approved"] is True
    assert artifact["groundedness_score"] >= 0.75
    assert artifact["hallucination_risk"] == 0.0


@pytest.mark.asyncio
async def test_critic_agent_hallucination_rejection():
    """Verifies that factually erroneous pseudo-science is flagged with REVISE verdict."""
    critic = FactVerificationCriticAgent()
    artifact, _ = await critic.execute(
        query="Explain energy",
        shared_state={
            "ncert_grounding": {"is_grounded": True, "key_terms": ["energy"]},
            "vernacular_data": {
                "explanation": "When friction acts, energy is destroyed completely and disappears forever.",
                "is_refined": False,
            },
        },
    )

    assert artifact["verdict"] == CriticVerdict.REVISE.value
    assert artifact["is_approved"] is False
    assert artifact["hallucination_risk"] > 0.20
    assert "Conservation of Energy" in artifact["actionable_critique"]


# =====================================================================
# 5. FormativeAssessmentAgent Tests
# =====================================================================

@pytest.mark.asyncio
async def test_formative_assessment_3tier_quiz():
    """Verifies 3-tier question bank generation and monotonic mastery progression."""
    agent = FormativeAssessmentAgent()
    artifact, _ = await agent.execute(
        query="What is inertia?",
        shared_state={"detected_topic": "inertia", "language": "en", "diagnostic_data": {"bloom_level": 3}},
    )

    questions = artifact["questions"]
    assert len(questions) == 3
    assert questions[0]["tier"] == 1  # Concept recall
    assert questions[1]["tier"] == 2  # Misconception trap
    assert questions[2]["tier"] == 3  # Rural application

    # Monotonic mastery computation test
    m_old = 0.50
    m_new, delta = agent.compute_mastery_delta(current_mastery=m_old, is_correct=True, response_time_seconds=8.0)
    assert m_new > m_old
    assert delta > 0.0


# =====================================================================
# 6. MultiAgentOrchestrator End-to-End Tests
# =====================================================================

@pytest.mark.asyncio
async def test_orchestrator_end_to_end_pipeline():
    """Verifies the complete 5-agent coordination with full telemetry trace generation."""
    orchestrator = get_multiagent_orchestrator()

    result = await orchestrator.orchestrate(
        query="How does a clay pot cool water during summer in our village?",
        user_id="student_odisha_01",
        language="or",
        max_reflexion_loops=2,
    )

    assert result["status"] == "success"
    assert result["total_latency_ms"] > 0
    resp = result["response"]

    # Verify content payload
    assert "ମାଟି ମାଠିଆ" in resp["cultural_anchor"]
    assert len(resp["explanation"]) > 30
    assert len(resp["formative_quiz"]) >= 3
    assert resp["groundedness_score"] >= 0.70
    assert resp["hallucination_risk"] <= 0.15

    # Verify multi-agent telemetry traces
    telemetry = result["multiagent_telemetry"]
    assert len(telemetry["active_agents"]) == 5
    assert telemetry["total_steps"] >= 5

    # Ensure all 5 agent roles are present in the traces
    roles_in_trace = [t["role"] for t in telemetry["traces"]]
    assert AgentRole.CURRICULUM_RAG.value in roles_in_trace
    assert AgentRole.PEDAGOGICAL_DIAGNOSTIC.value in roles_in_trace
    assert AgentRole.VERNACULAR_ANCHOR.value in roles_in_trace
    assert AgentRole.FACT_VERIFICATION_CRITIC.value in roles_in_trace
    assert AgentRole.FORMATIVE_ASSESSMENT.value in roles_in_trace
    assert AgentRole.SUPERVISOR_ORCHESTRATOR.value in roles_in_trace


# =====================================================================
# 7. FastAPI Endpoints Integration Tests
# =====================================================================

@pytest.mark.asyncio
async def test_multiagent_api_orchestrate_endpoint():
    """Verifies POST /api/agent/multiagent/orchestrate API endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/agent/multiagent/orchestrate",
            json={
                "query": "Explain Newton's first law of motion and inertia",
                "language": "hi-Latn",
                "max_reflexion_loops": 1,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "response" in data
        assert "multiagent_telemetry" in data
        assert len(data["multiagent_telemetry"]["traces"]) >= 5


@pytest.mark.asyncio
async def test_multiagent_api_agents_registry():
    """Verifies GET /api/agent/multiagent/agents capability registry."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/agent/multiagent/agents")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_specialized_agents"] == 5
        agent_ids = [a["id"] for a in data["agents"]]
        assert "CurriculumRAGAgent" in agent_ids
        assert "FactVerificationCriticAgent" in agent_ids


@pytest.mark.asyncio
async def test_multiagent_api_debate_endpoint():
    """Verifies POST /api/agent/multiagent/debate adversarial audit endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/agent/multiagent/debate",
            json={
                "proposed_explanation": "Water seeping through clay pot pores evaporates and absorbs latent heat to cause cooling.",
                "query": "Why does clay pot keep water cool?",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["is_approved"] is True
        assert data["groundedness_score"] >= 0.70
