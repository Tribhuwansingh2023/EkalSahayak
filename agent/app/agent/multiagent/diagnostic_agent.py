"""Agent 2: Pedagogical Diagnostic Agent (Bloom's Taxonomy & Prerequisite Gap Analyzer).

Analyzes student cognitive level, verifies foundational concept readiness,
and diagnoses underlying scientific misconceptions.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.agent.multiagent.base_agent import AgentRole, AgentTelemetry, BloomLevel

logger = logging.getLogger("ekalsahayak.multiagent.diagnostic")

# Prerequisite Dependency Hierarchy for Class 9 Science
PREREQUISITE_DEPENDENCIES: dict[str, dict[str, str]] = {
    "inertia": {
        "prereq": "motion_and_speed",
        "description": "Understanding uniform motion and speed before state change resistance.",
    },
    "momentum": {
        "prereq": "velocity_and_mass",
        "description": "Distinguishing velocity (vector) and mass (scalar) before quantity of motion.",
    },
    "evaporation": {
        "prereq": "kinetic_theory_matter",
        "description": "Particle kinetic motion and state changes before surface cooling absorption.",
    },
    "gravitation": {
        "prereq": "free_fall_acceleration",
        "description": "Acceleration due to gravity before universal gravitational attraction.",
    },
    "work_energy": {
        "prereq": "force_and_displacement",
        "description": "Applied force acting along displacement before energy transfer.",
    },
    "tissues": {
        "prereq": "cell_organelles",
        "description": "Cellular structure and division before cellular specialization in tissues.",
    },
    "isotopes": {
        "prereq": "atomic_particles",
        "description": "Protons, neutrons, and electrons before atomic number vs mass number.",
    },
    "sound_propagation": {
        "prereq": "mechanical_vibration",
        "description": "Particle vibration in elastic media before longitudinal wave propagation.",
    },
}

# Known Common Pedagogical Misconceptions
KNOWN_MISCONCEPTIONS: list[dict[str, Any]] = [
    {
        "keywords": ["cancel", "equal opposite", "balance each other"],
        "topic": "force",
        "diagnosis": "Student believes Newton's 3rd law action-reaction pairs cancel each other out.",
        "remediation": "Clarify that action and reaction act on TWO DIFFERENT bodies, so they never cancel out.",
    },
    {
        "keywords": ["heavy fall faster", "more weight falls quicker", "feather vs stone"],
        "topic": "gravitation",
        "diagnosis": "Student believes heavier objects accelerate faster under gravity.",
        "remediation": "Demonstrate that acceleration due to gravity (g = GM/R^2) is independent of the object's mass.",
    },
    {
        "keywords": ["boiling same", "boil evaporate same", "boiling point"],
        "topic": "evaporation",
        "diagnosis": "Student equates surface evaporation with bulk boiling.",
        "remediation": "Show that evaporation occurs at any temperature from the surface, while boiling is a bulk phenomenon at fixed boiling point.",
    },
    {
        "keywords": ["cold enters", "cold comes in", "cooling adds cold"],
        "topic": "evaporation",
        "diagnosis": "Caloric/Cold fluid misconception: believing cooling is adding cold rather than removing heat energy.",
        "remediation": "Explain that high-energy particles escape, lowering the average kinetic energy (heat extraction).",
    },
    {
        "keywords": ["stop moving without force", "needs continuous force to keep moving", "slows down naturally"],
        "topic": "inertia",
        "diagnosis": "Aristotelian misconception: believing constant force is required to sustain steady motion.",
        "remediation": "Explain Galileo's inclined plane experiment: motion continues indefinitely unless friction or air resistance opposes it.",
    },
]


class PedagogicalDiagnosticAgent:
    """Specialized Agent for student cognitive diagnosis and prerequisite scaffolding."""

    def __init__(self, name: str = "Pedagogical-Diagnostic-Agent") -> None:
        self.name = name
        self.role = AgentRole.PEDAGOGICAL_DIAGNOSTIC

    def _diagnose_bloom_level(self, query: str) -> tuple[BloomLevel, str]:
        """Classifies student inquiry into Bloom's Revised Taxonomy cognitive level."""
        q = query.lower()

        # Level 5: Evaluate (justifies, tests assumptions, critiques)
        if any(w in q for w in ["is it true that", "prove that", "justify", "evaluate", "valid", "correct to say", "do you agree"]):
            return BloomLevel.EVALUATE, "Evaluate: Testing validity, hypotheses, or critical reasoning."

        # Level 4: Analyze (compares, differences, relationships)
        if any(w in q for w in ["difference between", "distinguish", "compare", "why does", "relationship between", "cause", "analyze"]):
            return BloomLevel.ANALYZE, "Analyze: Examining cause-and-effect or distinguishing related concepts."

        # Level 3: Apply (real-world situation, scenario prediction)
        if any(w in q for w in ["what happens if", "in real life", "when i", "if a bus", "suppose", "example of", "calculate", "solve"]):
            return BloomLevel.APPLY, "Apply: Applying scientific laws to practical or rural situational problems."

        # Level 2: Understand (explanation in own words, how it works)
        if any(w in q for w in ["explain", "how does", "what does it mean", "meaning of", "describe"]):
            return BloomLevel.UNDERSTAND, "Understand: Conceptual comprehension and translation of mechanisms."

        # Level 1: Remember (default: definitions, recall, names)
        return BloomLevel.REMEMBER, "Remember: Direct definition, formula, or factual statement recall."

    def _diagnose_misconception(self, query: str, topic: str) -> dict[str, str] | None:
        """Identifies specific student misconceptions from inquiry phraseology."""
        q = query.lower()
        for item in KNOWN_MISCONCEPTIONS:
            if any(k in q for k in item["keywords"]):
                return {
                    "diagnosis": item["diagnosis"],
                    "remediation": item["remediation"],
                }
        return None

    def _check_prerequisites(
        self,
        topic: str,
        student_profile: dict[str, Any],
    ) -> tuple[bool, str | None, str | None]:
        """Checks student mastery history against prerequisite hierarchy."""
        topic_clean = topic.lower().replace(" ", "_")
        dep = None
        for key, val in PREREQUISITE_DEPENDENCIES.items():
            if key in topic_clean or topic_clean in key:
                dep = val
                break

        if not dep:
            return False, None, None

        prereq_key = dep["prereq"]
        mastery_map = student_profile.get("concept_mastery", {})
        prereq_score = mastery_map.get(prereq_key, 0.70)  # default reasonable baseline

        if prereq_score < 0.45:
            return True, prereq_key, dep["description"]

        return False, None, None

    async def execute(
        self,
        query: str,
        shared_state: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> tuple[dict[str, Any], AgentTelemetry]:
        """Performs student cognitive analysis, prerequisite check, and misconception scan."""
        telemetry = AgentTelemetry(
            agent_id=self.name,
            role=self.role,
            step_name="DIAGNOSE_STUDENT_COGNITIVE_STATE",
            input_summary=query[:100],
            model_used="bloom-taxonomy-prerequisite-classifier-v2",
        )

        try:
            detected_topic = shared_state.get("detected_topic", "general_science")
            student_profile = shared_state.get("student_profile", {})

            # 1. Bloom Level Classification
            bloom_lvl, bloom_desc = self._diagnose_bloom_level(query)

            # 2. Misconception Scanning
            misconception = self._diagnose_misconception(query, detected_topic)

            # 3. Prerequisite Gap Analysis
            prereq_missing, prereq_topic, prereq_desc = self._check_prerequisites(detected_topic, student_profile)

            # 4. Scaffolding Strategy Formulation
            if prereq_missing:
                scaffolding_plan = f"Prioritize remediation of prerequisite '{prereq_topic}' before advanced depth."
            elif misconception:
                scaffolding_plan = f"Directly address cognitive trap: {misconception['diagnosis']}"
            elif bloom_lvl >= BloomLevel.APPLY:
                scaffolding_plan = f"Provide rigorous rural application scenarios at Bloom level {bloom_lvl.value}."
            else:
                scaffolding_plan = "Establish core textbook definition with visual vernacular analogy."

            artifact = {
                "bloom_level": bloom_lvl.value,
                "bloom_name": bloom_lvl.name,
                "bloom_description": bloom_desc,
                "prerequisite_missing": prereq_missing,
                "prerequisite_topic": prereq_topic,
                "prerequisite_description": prereq_desc,
                "misconception_diagnosed": misconception["diagnosis"] if misconception else None,
                "misconception_remediation": misconception["remediation"] if misconception else None,
                "scaffolding_plan": scaffolding_plan,
                "confidence": 0.94 if misconception else 0.88,
            }

            telemetry.finish(
                confidence=artifact["confidence"],
                rationale=f"Diagnosed Bloom Level {bloom_lvl.value} ({bloom_lvl.name}). Misconception: {'Yes' if misconception else 'None'}. Prereq Gap: {'Yes' if prereq_missing else 'No'}.",
                artifacts=artifact,
            )
            return artifact, telemetry

        except Exception as exc:
            logger.exception("PedagogicalDiagnosticAgent error: %s", exc)
            fallback_artifact = {
                "bloom_level": 2,
                "bloom_name": "UNDERSTAND",
                "bloom_description": "Understand: Conceptual comprehension and translation.",
                "prerequisite_missing": False,
                "prerequisite_topic": None,
                "prerequisite_description": None,
                "misconception_diagnosed": None,
                "misconception_remediation": None,
                "scaffolding_plan": "Deliver structured explanation with foundational grounding.",
                "confidence": 0.70,
            }
            telemetry.finish(
                confidence=0.70,
                rationale=f"Fallback diagnostic triggered: {exc}",
                artifacts=fallback_artifact,
            )
            return fallback_artifact, telemetry
