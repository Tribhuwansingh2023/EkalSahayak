"""FastAPI Router for Hierarchical Multi-Agent Orchestration.

Exposes endpoints for the 5-agent network:
- POST /api/agent/multiagent/orchestrate: Full 5-agent coordinated execution.
- GET  /api/agent/multiagent/agents: Agent roles, contracts, and capability registry.
- POST /api/agent/multiagent/debate: Adversarial verification and groundedness audit.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.agent.multiagent.orchestrator import get_multiagent_orchestrator
from app.agent.multiagent.critic_agent import FactVerificationCriticAgent
from app.agent.multiagent.curriculum_rag_agent import CurriculumRAGAgent
from app.security import get_current_user_optional

logger = logging.getLogger("ekalsahayak.routers.multiagent")

router = APIRouter(prefix="/api/agent/multiagent", tags=["Hierarchical Multi-Agents"])


class OrchestrationRequest(BaseModel):
    """Payload for multi-agent coordinated execution."""

    query: str = Field(..., min_length=2, max_length=500, description="Student academic inquiry or doubt.")
    language: str = Field(default="or", description="Target vernacular language code (e.g. 'or', 'hi-Latn', 'en').")
    max_reflexion_loops: int = Field(default=2, ge=0, le=4, description="Maximum self-correction reflexion iterations.")


class DebateRequest(BaseModel):
    """Payload for adversarial verification audit."""

    proposed_explanation: str = Field(..., min_length=10, description="Generated vernacular explanation to audit.")
    query: str = Field(default="", description="Original student doubt.")


@router.post(
    "/orchestrate",
    summary="Execute 5-Agent Hierarchical Orchestration",
    response_description="Consolidated multi-agent response with grounding, analogy, quiz, and full telemetry traces.",
)
async def orchestrate_multi_agent(
    req: OrchestrationRequest,
    current_user: dict[str, Any] | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    """Coordinates the 5 specialized agents:

    1. CurriculumRAGAgent (NCERT citation & verbatim definition)
    2. PedagogicalDiagnosticAgent (Bloom's Taxonomy Level 1-5 & Misconception Gap)
    3. VernacularCulturalAnchorAgent (Rural Odia / Hinglish Cognitive Anchors)
    4. FactVerificationCriticAgent (Reflexion Critic & Anti-Hallucination Guard)
    5. FormativeAssessmentAgent (Dynamic 3-Tier Formative Micro-Quiz)
    """
    user_id = current_user.get("user_id", "anonymous") if current_user else "anonymous"
    student_profile = current_user.get("profile", {}) if current_user else {}

    orchestrator = get_multiagent_orchestrator()

    try:
        result = await orchestrator.orchestrate(
            query=req.query,
            user_id=user_id,
            language=req.language,
            student_profile=student_profile,
            max_reflexion_loops=req.max_reflexion_loops,
        )
        return result
    except Exception as exc:
        logger.exception("Multi-agent orchestration error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Multi-agent execution encountered an internal error: {str(exc)}",
        )


@router.get(
    "/agents",
    summary="List Registered Multi-Agents",
    response_description="Registry of all 5 specialized autonomous agents, their roles, and capabilities.",
)
async def list_registered_agents() -> dict[str, Any]:
    """Returns the agent cards and architectural topology."""
    return {
        "status": "operational",
        "orchestration_topology": "Hierarchical Supervisor with Dual Parallel Dispatch and Reflexion Loop",
        "total_specialized_agents": 5,
        "agents": [
            {
                "id": "CurriculumRAGAgent",
                "role": "curriculum_rag_agent",
                "specialization": "Grounded Retrieval & Verbatim NCERT Sourcing",
                "evidence_source": "12 NCERT Class 9 Science Chapters (Real Corpus, 67.8k words)",
                "technique": "Hybrid Sparse BM25 + Dense Semantic Vector Indexing",
            },
            {
                "id": "PedagogicalDiagnosticAgent",
                "role": "pedagogical_diagnostic_agent",
                "specialization": "Bloom's Taxonomy Classification & Misconception Scaffolding",
                "framework": "Bloom's Revised Taxonomy (Levels 1 to 5: Remember, Understand, Apply, Analyze, Evaluate)",
                "technique": "Cognitive Depth Classifier & Prerequisite Dependency Graph",
            },
            {
                "id": "VernacularCulturalAnchorAgent",
                "role": "vernacular_anchor_agent",
                "specialization": "Rural Indic Dialect & Cultural Metaphor Grounding",
                "anchors": ["Mati Mathia (Clay Pot)", "Village Bus", "Catching Cricket Ball", "Falling Coconut", "Temple Bell", "School Brick Masonry"],
                "modalities": ["Odia Script (or)", "Zero-Devanagari Romanized Hinglish (hi-Latn)", "English (en)", "Phonetic Read-Along"],
            },
            {
                "id": "FactVerificationCriticAgent",
                "role": "fact_verification_critic_agent",
                "specialization": "Adversarial Anti-Hallucination & Reflexion Self-Correction",
                "technique": "Reflexion Critique-and-Refine Loop with Rubric Scoring (Groundedness Score G >= 0.82)",
                "guards": ["Conservation of Energy", "Galilean Free Fall", "Phase Change Latent Heat", "Action-Reaction Disjoint Bodies"],
            },
            {
                "id": "FormativeAssessmentAgent",
                "role": "formative_assessment_agent",
                "specialization": "Dynamic 3-Tier Formative Assessment & Monotonic Mastery Scorer",
                "structure": "Tier 1: Definition Recall, Tier 2: Misconception Trap, Tier 3: Rural Application Scenario",
                "scoring": "Server-authoritative, monotonic IRT/Bayesian progression with anti-cheat speed bounds",
            },
        ],
    }


@router.post(
    "/debate",
    summary="Adversarial Verification Debate Round",
    response_description="Adversarial audit evaluating proposed explanation against retrieved NCERT evidence.",
)
async def debate_verification_audit(req: DebateRequest) -> dict[str, Any]:
    """Runs the FactVerificationCriticAgent against a proposed scientific explanation."""
    rag_agent = CurriculumRAGAgent()
    critic_agent = FactVerificationCriticAgent()

    # Retrieve real grounding
    query_text = req.query if req.query else req.proposed_explanation[:100]
    rag_artifact, _ = await rag_agent.execute(query_text, {})

    shared_state = {
        "ncert_grounding": rag_artifact,
        "vernacular_data": {"explanation": req.proposed_explanation, "is_refined": False},
    }

    critic_artifact, critic_tel = await critic_agent.execute(query_text, shared_state)

    return {
        "status": "success",
        "verdict": critic_artifact.get("verdict"),
        "is_approved": critic_artifact.get("is_approved"),
        "groundedness_score": critic_artifact.get("groundedness_score"),
        "hallucination_risk": critic_artifact.get("hallucination_risk"),
        "actionable_critique": critic_artifact.get("actionable_critique"),
        "verified_against_citation": rag_artifact.get("citation"),
        "critic_telemetry": critic_tel.to_dict(),
    }
