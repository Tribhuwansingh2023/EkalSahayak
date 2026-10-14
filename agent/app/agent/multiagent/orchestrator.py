"""Hierarchical Supervisor Orchestrator with Reflexion Feedback Loop.

Coordinates the 5 specialized multi-agents:
1. CurriculumRAGAgent (Grounding & NCERT Sourcing)
2. PedagogicalDiagnosticAgent (Bloom's Taxonomy & Prerequisite Gap)
3. VernacularCulturalAnchorAgent (Rural Odia/Hinglish Metaphor Bridge)
4. FactVerificationCriticAgent (Reflexion Critic & Anti-Hallucination Guard)
5. FormativeAssessmentAgent (Dynamic 3-Tier Quiz & Monotonic Mastery)

Includes parallel dispatch, critique-refine loops, and comprehensive telemetry aggregation.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from app.agent.multiagent.assessment_agent import FormativeAssessmentAgent
from app.agent.multiagent.base_agent import AgentRole, AgentTelemetry, CriticVerdict
from app.agent.multiagent.critic_agent import FactVerificationCriticAgent
from app.agent.multiagent.curriculum_rag_agent import CurriculumRAGAgent
from app.agent.multiagent.diagnostic_agent import PedagogicalDiagnosticAgent
from app.agent.multiagent.vernacular_anchor_agent import VernacularCulturalAnchorAgent

logger = logging.getLogger("ekalsahayak.multiagent.orchestrator")


class MultiAgentOrchestrator:
    """Master Orchestrator managing specialized agent dispatch, reflection loops, and state synthesis."""

    def __init__(self) -> None:
        self.rag_agent = CurriculumRAGAgent()
        self.diagnostic_agent = PedagogicalDiagnosticAgent()
        self.vernacular_agent = VernacularCulturalAnchorAgent()
        self.critic_agent = FactVerificationCriticAgent()
        self.assessment_agent = FormativeAssessmentAgent()

    async def orchestrate(
        self,
        query: str,
        user_id: str = "anonymous",
        language: str = "or",
        student_profile: dict[str, Any] | None = None,
        max_reflexion_loops: int = 2,
    ) -> dict[str, Any]:
        """Runs the complete 5-agent hierarchical orchestration workflow."""
        start_time = time.perf_counter()
        shared_state: dict[str, Any] = {
            "query": query,
            "user_id": user_id,
            "language": language,
            "student_profile": student_profile or {},
            "detected_topic": "general_science",
        }

        all_telemetry: list[dict[str, Any]] = []

        # -------------------------------------------------------------
        # Phase 1: Dual Dispatch (Parallel RAG & Diagnostic Analysis)
        # -------------------------------------------------------------
        rag_task = asyncio.create_task(self.rag_agent.execute(query, shared_state))
        diag_task = asyncio.create_task(self.diagnostic_agent.execute(query, shared_state))

        (rag_artifact, rag_tel), (diag_artifact, diag_tel) = await asyncio.gather(rag_task, diag_task)

        all_telemetry.append(rag_tel.to_dict())
        all_telemetry.append(diag_tel.to_dict())

        # Update shared state with grounding and cognitive diagnostic
        shared_state["ncert_grounding"] = rag_artifact
        shared_state["diagnostic_data"] = diag_artifact
        if rag_artifact.get("chapter"):
            shared_state["detected_topic"] = rag_artifact["chapter"]

        # -------------------------------------------------------------
        # Phase 2: Vernacular Cognitive Synthesis
        # -------------------------------------------------------------
        vernacular_artifact, vern_tel = await self.vernacular_agent.execute(query, shared_state)
        all_telemetry.append(vern_tel.to_dict())
        shared_state["vernacular_data"] = vernacular_artifact

        # -------------------------------------------------------------
        # Phase 3: Adversarial Reflexion Loop (Critic & Refinement)
        # -------------------------------------------------------------
        critic_artifact, critic_tel = await self.critic_agent.execute(query, shared_state)
        all_telemetry.append(critic_tel.to_dict())
        shared_state["critic_data"] = critic_artifact

        reflexion_iterations = 0
        while critic_artifact.get("verdict") == CriticVerdict.REVISE.value and reflexion_iterations < max_reflexion_loops:
            reflexion_iterations += 1
            logger.info("Reflexion Loop triggered (iteration %d). Re-dispatching Vernacular Agent with critic feedback.", reflexion_iterations)

            # Pass actionable critique to Vernacular Agent
            shared_state["critic_critique"] = critic_artifact.get("actionable_critique", "")

            # Re-run Vernacular Agent with corrective instructions
            vernacular_artifact, vern_refine_tel = await self.vernacular_agent.execute(query, shared_state)
            vern_refine_tel.step_name = f"REFINE_VERNACULAR_EXPLANATION_L{reflexion_iterations}"
            all_telemetry.append(vern_refine_tel.to_dict())
            shared_state["vernacular_data"] = vernacular_artifact

            # Re-evaluate with Critic Agent
            critic_artifact, critic_re_tel = await self.critic_agent.execute(query, shared_state)
            critic_re_tel.step_name = f"REFLEXION_RE_EVALUATION_L{reflexion_iterations}"
            all_telemetry.append(critic_re_tel.to_dict())
            shared_state["critic_data"] = critic_artifact

        # -------------------------------------------------------------
        # Phase 4: Formative Assessment Synthesis
        # -------------------------------------------------------------
        assessment_artifact, assess_tel = await self.assessment_agent.execute(query, shared_state)
        all_telemetry.append(assess_tel.to_dict())
        shared_state["assessment_data"] = assessment_artifact

        # -------------------------------------------------------------
        # Phase 5: Response Packet Assembly & Supervisor Metrics
        # -------------------------------------------------------------
        total_duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        supervisor_telemetry = AgentTelemetry(
            agent_id="Hierarchical-Supervisor-Orchestrator",
            role=AgentRole.SUPERVISOR_ORCHESTRATOR,
            step_name="SUPERVISE_MULTI_AGENT_CONSENSUS",
            input_summary=query[:100],
            model_used="hierarchical-dag-orchestrator-v2",
        )
        supervisor_telemetry.finish(
            confidence=critic_artifact.get("confidence", 0.95),
            rationale=f"5 specialized agents orchestrated in {total_duration_ms}ms with {reflexion_iterations} reflexion loops.",
            artifacts={
                "reflexion_iterations": reflexion_iterations,
                "critic_approved": critic_artifact.get("is_approved", True),
                "total_agents_engaged": 5,
            },
        )
        all_telemetry.append(supervisor_telemetry.to_dict())

        return {
            "status": "success",
            "query": query,
            "language": language,
            "total_latency_ms": total_duration_ms,
            "reflexion_loops_executed": reflexion_iterations,
            # Core Content Payload
            "response": {
                "concept": vernacular_artifact.get("concept", "Science Concept"),
                "cultural_anchor": vernacular_artifact.get("anchor_title", ""),
                "explanation": vernacular_artifact.get("explanation", ""),
                "audio_script": vernacular_artifact.get("audio_script", ""),
                "ncert_citation": rag_artifact.get("citation", ""),
                "ncert_verbatim_definition": rag_artifact.get("definition", ""),
                "groundedness_score": critic_artifact.get("groundedness_score", 0.90),
                "hallucination_risk": critic_artifact.get("hallucination_risk", 0.0),
                "bloom_level": diag_artifact.get("bloom_level", 2),
                "bloom_category": diag_artifact.get("bloom_name", "UNDERSTAND"),
                "scaffolding_plan": diag_artifact.get("scaffolding_plan", ""),
                "misconception_diagnosed": diag_artifact.get("misconception_diagnosed"),
                "formative_quiz": assessment_artifact.get("questions", []),
            },
            # Complete Multi-Agent Audit Trail
            "multiagent_telemetry": {
                "active_agents": [
                    self.rag_agent.name,
                    self.diagnostic_agent.name,
                    self.vernacular_agent.name,
                    self.critic_agent.name,
                    self.assessment_agent.name,
                ],
                "total_steps": len(all_telemetry),
                "traces": all_telemetry,
            },
        }


# Singleton Orchestrator Instance
_ORCHESTRATOR_INSTANCE: MultiAgentOrchestrator | None = None


def get_multiagent_orchestrator() -> MultiAgentOrchestrator:
    """Returns singleton instance of the MultiAgentOrchestrator."""
    global _ORCHESTRATOR_INSTANCE
    if _ORCHESTRATOR_INSTANCE is None:
        _ORCHESTRATOR_INSTANCE = MultiAgentOrchestrator()
    return _ORCHESTRATOR_INSTANCE
