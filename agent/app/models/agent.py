"""Agent Interaction Schemas."""

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class LanguageEnum(StrEnum):
    # Tier A
    EN = "en"
    HI = "hi"
    OR = "or"
    BN = "bn"
    MR = "mr"
    GU = "gu"
    TA = "ta"
    TE = "te"
    KN = "kn"
    ML = "ml"
    PA = "pa"
    UR = "ur"
    AS = "as"
    # Tier B
    BRX = "brx"
    DOI = "doi"
    KS = "ks"
    KOK = "kok"
    MAI = "mai"
    MNI = "mni"
    NE = "ne"
    SA = "sa"
    SAT = "sat"
    SD = "sd"
    BHO = "bho"
    TCY = "tcy"
    KXU = "kxu"
    RAJ = "raj"
    HNE = "hne"
    MAG = "mag"
    # Special
    HI_LATN = "hi-Latn"
    # Backward compatibility
    ODIA = "odia"
    ENGLISH = "english"


class InputTypeEnum(StrEnum):
    TEXT = "text"
    VOICE = "voice"


class InteractRequest(BaseModel):
    """Student query payload for LangGraph pedagogical engine.

    NOTE: student_id is derived strictly from the authenticated JWT token!
    """

    model_config = ConfigDict(extra="forbid")

    query: str = Field(..., min_length=1, max_length=500, description="Student question (max 500 characters)")
    language: LanguageEnum = Field(default=LanguageEnum.ODIA)
    input_type: InputTypeEnum = Field(default=InputTypeEnum.TEXT)
    is_offline: bool = Field(default=False)


class AgentTraceItem(BaseModel):
    step_name: str
    node: str
    tool_called: str
    tool_args: dict[str, Any]
    tool_output: Any
    pedagogical_intent: str
    duration_ms: float | None = None


class InteractResponse(BaseModel):
    """Full pedagogical execution result with auditable traces."""

    detected_topic: str
    misconception_diagnosed: str | None = None
    prerequisite_missing: bool = False
    prerequisite_topic: str | None = None
    vernacular_analogy: dict[str, Any] | None = None
    micro_quiz: list[dict[str, Any]] | None = None
    updated_mastery: dict[str, Any] | None = None
    final_response_odia: str
    final_audio_script: str
    next_followup_plan: str
    traces: list[AgentTraceItem]
    llm_used: bool = False
    model_name: str | None = None
    request_id: str
    language_served: str = "or"
    machine_translated: bool = False
    provenance: dict[str, Any] | None = None
    citation: str | None = None
    is_not_found: bool = False
    retrieved_chunks: list[dict[str, Any]] | None = None
    groundedness_score: float | None = None


class ReflectFailureRequest(BaseModel):
    """Payload for Antigravity failure reflection & pedagogical recovery."""

    model_config = ConfigDict(extra="forbid")

    topic: str = Field(default="evaporation", max_length=64)
    question_id: str = Field(..., min_length=1, max_length=64)
    selected_index: int = Field(..., ge=0, le=10)
    student_query: str | None = Field(default=None, max_length=500)

