"""Shared Multi-Agent Contracts, Enums, and Telemetry Data Structures.

Provides standardized message passing, telemetry tracking, and lifecycle contracts
for the 5 specialized autonomous agents in EkalSahayak.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any, Protocol


class AgentRole(str, Enum):
    """Specialized Multi-Agent Roles."""

    CURRICULUM_RAG = "curriculum_rag_agent"
    PEDAGOGICAL_DIAGNOSTIC = "pedagogical_diagnostic_agent"
    VERNACULAR_ANCHOR = "vernacular_anchor_agent"
    FACT_VERIFICATION_CRITIC = "fact_verification_critic_agent"
    FORMATIVE_ASSESSMENT = "formative_assessment_agent"
    SUPERVISOR_ORCHESTRATOR = "supervisor_orchestrator"


class CriticVerdict(str, Enum):
    """Adversarial Critic Reflexion Verdict."""

    APPROVED = "APPROVED"
    REVISE = "REVISE"
    ESCALATE = "ESCALATE"


class BloomLevel(int, Enum):
    """Bloom's Revised Taxonomy Cognitive Levels."""

    REMEMBER = 1
    UNDERSTAND = 2
    APPLY = 3
    ANALYZE = 4
    EVALUATE = 5


@dataclass
class AgentTelemetry:
    """Individual agent execution telemetry trace."""

    agent_id: str
    role: AgentRole
    step_name: str
    start_time: float = field(default_factory=time.perf_counter)
    end_time: float = 0.0
    duration_ms: float = 0.0
    confidence: float = 1.0
    model_used: str = "hybrid-local-ncert"
    rationale: str = ""
    input_summary: str = ""
    artifacts: dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def finish(self, confidence: float = 1.0, rationale: str = "", artifacts: dict[str, Any] | None = None) -> None:
        """Marks agent execution complete and records duration."""
        self.end_time = time.perf_counter()
        self.duration_ms = round((self.end_time - self.start_time) * 1000, 2)
        self.confidence = round(confidence, 4)
        if rationale:
            self.rationale = rationale
        if artifacts:
            self.artifacts = artifacts

    def to_dict(self) -> dict[str, Any]:
        """Serializes telemetry record to a clean dictionary."""
        return {
            "agent_id": self.agent_id,
            "role": self.role.value,
            "step_name": self.step_name,
            "duration_ms": self.duration_ms,
            "confidence": self.confidence,
            "model_used": self.model_used,
            "rationale": self.rationale,
            "input_summary": self.input_summary,
            "artifacts": self.artifacts,
            "timestamp": self.timestamp,
        }


class SpecializedAgent(Protocol):
    """Protocol for autonomous specialized agents in the network."""

    name: str
    role: AgentRole

    async def execute(
        self,
        query: str,
        shared_state: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> tuple[dict[str, Any], AgentTelemetry]:
        """Executes agent domain logic and returns output artifacts + telemetry."""
        ...
