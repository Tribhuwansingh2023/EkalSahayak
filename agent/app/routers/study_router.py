"""Diagnostic Assessment, Personalized Study Plan, and Lesson Player Router."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.security import get_current_user
from app.services.diagnostic_service import get_diagnostic_service
from app.services.lesson_service import get_lesson_service
from app.services.planner_service import get_planner_service

logger = logging.getLogger("ekalsahayak.routers.study")

router = APIRouter(prefix="/api", tags=["Diagnostic, Study Plan & Lesson Player"])


class DiagnosticAnswerItem(BaseModel):
    question_id: str
    selected_index: int


class DiagnosticSubmissionRequest(BaseModel):
    answers: list[DiagnosticAnswerItem]
    lang: str = "en"


class SimplifyRequest(BaseModel):
    concept_id: str
    attempt: int = 1
    lang: str = "en"


class SessionCompleteRequest(BaseModel):
    concept_id: str
    session_type: str = Field(..., pattern="^(learn|check|review|practice)$")
    time_spent_seconds: int = Field(default=300, ge=0)
    quiz_score: float | None = None


@router.get("/assessment/diagnostic")
async def get_diagnostic_questions(
    lang: str = Query(default="en"),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Retrieves 5-8 question baseline diagnostic grounded in NCERT Class 9."""
    diag_svc = get_diagnostic_service()
    questions = diag_svc.get_diagnostic_questions(lang=lang)
    return {
        "questions": questions,
        "count": len(questions),
        "target": "NCERT Class 9 Science Baseline Diagnostic",
        "description": "5-minute diagnostic to map student mastery across core concepts.",
    }


@router.post("/assessment/diagnostic/submit")
async def submit_diagnostic(
    req: DiagnosticSubmissionRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Evaluates student baseline diagnostic, seeds real mastery & maps misconceptions."""
    diag_svc = get_diagnostic_service()
    submissions = [{"question_id": a.question_id, "selected_index": a.selected_index} for a in req.answers]
    return await diag_svc.evaluate_diagnostic(
        user_id=current_user["id"],
        submissions=submissions,
        lang=req.lang,
    )


@router.get("/studyplan")
async def get_study_plan(
    time_budget: int = Query(default=45, ge=15, le=120),
    lang: str = Query(default="en"),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Generates today's personalized study plan from real mastery + prerequisite DAG."""
    planner = get_planner_service()
    return await planner.get_study_plan(
        user_id=current_user["id"],
        time_budget_minutes=time_budget,
        lang=lang,
    )


@router.get("/lesson/{concept_id}")
async def get_lesson(
    concept_id: str,
    lang: str = Query(default="en"),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Retrieves full-screen structured lesson with hook, explanation, rural example, and citations."""
    lesson_svc = get_lesson_service()
    return await lesson_svc.get_lesson_for_concept(concept_id=concept_id, lang=lang)


@router.post("/lesson/simplify")
async def simplify_lesson_explanation(
    req: SimplifyRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Tutor agent 'Samajh nahi aaya' handler: simpler analogy (1st) or prerequisite recommendation (2nd)."""
    lesson_svc = get_lesson_service()
    return await lesson_svc.simplify_explanation(
        concept_id=req.concept_id,
        attempt=req.attempt,
        lang=req.lang,
    )


@router.post("/lesson/complete")
async def complete_lesson_session(
    req: SessionCompleteRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Atomically records completed session, updates real mastery, and advances plan."""
    lesson_svc = get_lesson_service()
    return await lesson_svc.complete_session(
        user_id=current_user["id"],
        concept_id=req.concept_id,
        session_type=req.session_type,
        time_spent_seconds=req.time_spent_seconds,
        quiz_score=req.quiz_score,
    )
