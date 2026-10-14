"""Quiz Domain & Request/Response Schemas."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class TopicEnum(StrEnum):
    EVAPORATION = "evaporation"
    LATENT_HEAT = "latent_heat"
    CELL_BIOLOGY = "cell_biology"
    MITOCHONDRIA = "mitochondria"
    MOTION = "motion"
    FORCE = "force"


class DifficultyEnum(StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class QuizAnswerRequest(BaseModel):
    """Client request to submit a question answer.

    Server-Authoritative Anti-Cheat:
    - correct_option_index is NOT accepted from client!
    - Server looks up the official correct index from the question bank.
    """

    model_config = ConfigDict(extra="forbid")

    question_id: str = Field(..., min_length=1, max_length=64)
    selected_index: int = Field(..., ge=0, le=10, description="Selected option index (0-based)")
    attempt_id: str = Field(..., min_length=4, max_length=128, description="Unique client attempt UUID for idempotency")
    time_taken_ms: int = Field(default=0, ge=0, le=60000, description="Response time clamped to 0-60000ms")


class QuizAnswerResponse(BaseModel):
    """Server-authoritative evaluation result."""

    question_id: str
    selected_index: int
    correct: bool
    correct_index: int
    score_awarded: int
    explanation_odia: str
    explanation_english: str
    new_mastery: float
    streak: int
    daily_gain_capped: bool = False


class QuizQuestionPublic(BaseModel):
    """Public question item without revealing the answer."""

    id: str
    topic: TopicEnum
    difficulty: DifficultyEnum
    prompt_odia: str
    prompt_english: str
    options_odia: list[str]
    options_english: list[str]
    prompt_localized: str | None = None
    options_localized: list[str] | None = None
    prerequisite: str | None = None
    # NOTE: correct_index is strictly omitted!
