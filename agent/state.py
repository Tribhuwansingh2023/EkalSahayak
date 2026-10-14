"""
AgentState definitions for Sunita AI - Deterministic Pedagogical Workflow
Built with LangGraph and LangChain.
"""

from typing import List, Dict, Any, Optional, TypedDict
from pydantic import BaseModel, Field


class ToolTrace(BaseModel):
    tool_name: str
    tool_args: Dict[str, Any]
    tool_output: Dict[str, Any]
    thought: str
    decision_rationale: str
    timestamp: str


class StudentProfile(BaseModel):
    user_id: Optional[str] = None
    student_id: str = "sunita_class9"
    name: str = "Sunita"
    grade: int = 9
    medium: str = "Odia"
    home_dialect: str = "Kui / Desia"
    curriculum: str = "Odisha Board (BSE Odisha)"
    daily_device_window_minutes: int = 60
    network_profile: str = "2G / Intermittent Rural"
    mastery_map: Dict[str, float] = Field(default_factory=lambda: {
        "matter_states": 0.70,
        "temperature_heat": 0.45,
        "evaporation_concept": 0.30,
        "latent_heat": 0.15,
        "cell_structure": 0.60,
        "force_and_motion": 0.40
    })
    identified_misconceptions: List[str] = Field(default_factory=lambda: [
        "Confuses evaporation with boiling (thinks 100°C is required for evaporation)",
        "Thinks cooling by perspiration is magic, not latent heat loss"
    ])
    streak_days: int = 4
    pending_followups: List[Dict[str, Any]] = Field(default_factory=list)


class QuizQuestion(BaseModel):
    id: str
    question_odia: str
    question_english: Optional[str] = None
    options_odia: List[str]
    correct_index: int
    explanation_odia: str
    context_concept: str


class AgentState(TypedDict):
    # Input data
    student_id: str
    query: str
    language: str  # "odia", "kui_odia", "english"
    input_type: str  # "voice", "text"
    is_offline: bool
    
    # Pedagogical context
    detected_topic: str
    student_profile: Dict[str, Any]
    
    # Agent graph transitions & decisions
    prerequisite_missing: bool
    prerequisite_topic: Optional[str]
    misconception_diagnosed: Optional[str]
    
    # Tool outputs
    vernacular_analogy: Optional[Dict[str, Any]]
    micro_quiz: Optional[List[Dict[str, Any]]]
    updated_mastery: Optional[Dict[str, Any]]
    
    # Final student-facing response
    final_response_odia: str
    final_audio_script: str
    next_followup_plan: str
    
    # Audit & Inspection
    traces: List[Dict[str, Any]]
    current_node: str
