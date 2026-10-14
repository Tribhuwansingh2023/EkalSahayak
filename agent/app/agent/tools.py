"""LangChain & Pedagogical Tools for Lakshya AI Agent."""

from datetime import UTC, datetime
from typing import Any

from langchain_core.tools import tool

from app.services.kb_service import get_kb_service


@tool
def assess_prerequisite_tool(topic: str, student_profile: dict[str, Any]) -> dict[str, Any]:
    """Diagnoses whether foundational prerequisites are mastered for the given topic."""
    kb = get_kb_service()
    concept = kb.get_concept(topic)

    if not concept:
        return {
            "prerequisite_missing": False,
            "prerequisite_topic": None,
            "status": "topic_not_found",
            "message": "Topic not recognized.",
        }

    prereqs = concept.prerequisites
    mastery_map = student_profile.get("mastery_graph", {})

    missing_prereqs = []
    for p in prereqs:
        score = mastery_map.get(p, 0.40)
        if score < 0.50:
            missing_prereqs.append(p)

    if missing_prereqs:
        primary_gap = missing_prereqs[0]
        return {
            "prerequisite_missing": True,
            "prerequisite_topic": primary_gap,
            "all_missing": missing_prereqs,
            "status": "gap_detected",
            "message": f"Foundational prerequisite '{primary_gap}' requires scaffolding.",
        }

    return {
        "prerequisite_missing": False,
        "prerequisite_topic": None,
        "status": "prerequisites_satisfied",
        "message": "Foundational prerequisites are adequately mastered.",
    }


@tool
def pedagogical_remediation_guardrail(prerequisite_topic: str) -> dict[str, Any]:
    """Generates remediation scaffolding for a missing foundational concept."""
    kb = get_kb_service()
    concept = kb.get_concept(prerequisite_topic)

    if not concept:
        return {
            "remediation_applied": False,
            "odia_scaffold": "ପୂର୍ବ ପାଠ୍ୟକ୍ରମର ମୌଳିକ ଧାରଣା ମନେପକାନ୍ତୁ ।",
            "english_scaffold": "Review the previous chapter's foundational concepts.",
        }

    return {
        "remediation_applied": True,
        "scaffold_topic": prerequisite_topic,
        "odia_scaffold": concept.analogy_odia,
        "english_scaffold": concept.analogy_english,
        "message": f"Injected foundation scaffolding for '{prerequisite_topic}'.",
    }


@tool
def generate_vernacular_analogy_tool(topic: str, misconception_id: str | None = None) -> dict[str, Any]:
    """Generates rural Odisha cultural analogies and spoken audio scripts."""
    kb = get_kb_service()
    concept = kb.get_concept(topic)

    if not concept:
        return {
            "analogy_odia": "ଏହି ପ୍ରଶ୍ନଟି ଆପଣଙ୍କ ପାଠ୍ୟକ୍ରମରେ ଖୁବ୍ ଶୀଘ୍ର ଯୋଡ଼ାଯିବ ।",
            "analogy_english": "This topic will be added to your curriculum soon.",
            "audio_script": "ଏହାକୁ ଭଲଭାବରେ ବୁଝିବା ପାଇଁ ଶିକ୍ଷକଙ୍କ ପରାମର୍ଶ ନିଅନ୍ତୁ ।",
        }

    return {
        "topic": topic,
        "analogy_odia": concept.analogy_odia,
        "analogy_english": concept.analogy_english,
        "audio_script": concept.audio_script_odia,
        "chapter": concept.chapter,
        "misconception_addressed": misconception_id,
    }


@tool
def create_micro_quiz_tool(topic: str) -> list[dict[str, Any]]:
    """Retrieves 2 diagnostic formative assessment questions for the topic."""
    kb = get_kb_service()
    concept = kb.get_concept(topic)
    if not concept or not concept.micro_quiz:
        return []

    return [q.model_dump() for q in concept.micro_quiz[:2]]


@tool
def update_learning_graph_tool(
    user_id: str,
    topic: str,
    topic_mastery: float,
) -> dict[str, Any]:
    """Computes retention and follow-up plan for the student mastery graph."""
    now = datetime.now(UTC)
    followup_iso = (now.replace(hour=18, minute=0, second=0, microsecond=0)).isoformat()

    return {
        "user_id": user_id,
        "topic": topic,
        "current_mastery": round(topic_mastery, 4),
        "scheduled_followup": followup_iso,
        "retention_status": "tracked",
    }
