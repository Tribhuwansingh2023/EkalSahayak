"""LangGraph Agent State Definitions."""

from typing import Any, TypedDict


class AgentState(TypedDict):
    """Deterministic Pedagogical State."""

    user_id: str
    request_id: str
    query: str
    language: str
    input_type: str
    is_offline: bool

    # Routing & Knowledge Retrieval
    detected_topic: str
    topic_confidence: float
    curriculum_concept: dict[str, Any] | None

    # Pedagogical Scaffolding
    student_profile: dict[str, Any]
    prerequisite_missing: bool
    prerequisite_topic: str | None
    misconception_diagnosed: str | None

    # Content Generation
    vernacular_analogy: dict[str, Any] | None
    micro_quiz: list[dict[str, Any]] | None
    updated_mastery: dict[str, Any] | None
    final_response_odia: str
    final_audio_script: str
    next_followup_plan: str

    # Telemetry & LLM Tracking
    traces: list[dict[str, Any]]
    current_node: str
    llm_used: bool
    model_name: str | None
    is_clarification: bool
    language_served: str
    machine_translated: bool

    # NCERT Grounded RAG Fields
    rag_result: dict[str, Any] | None
    provenance: dict[str, Any] | None
    citation: str | None
    is_not_found: bool
    retrieved_chunks: list[dict[str, Any]] | None
    groundedness_score: float | None
