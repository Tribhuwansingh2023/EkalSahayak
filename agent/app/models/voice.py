"""Voice & Vernacular Audio Schemas."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class EngineEnum(StrEnum):
    INDIC_NATURAL = "indic_natural"
    STANDARD = "standard"


class TTSRequest(BaseModel):
    """Text-to-Speech synthesis request."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., min_length=1, max_length=800, description="Odia or English text to synthesize (max 800 chars)")
    slow: bool = Field(default=False)
    engine: EngineEnum = Field(default=EngineEnum.INDIC_NATURAL)


class STTResponse(BaseModel):
    """Honest Speech-to-Text transcription output."""

    transcript: str
    confidence: float
    provider: str
    engine: str
    duration_ms: float
