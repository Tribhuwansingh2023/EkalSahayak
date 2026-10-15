"""Diagnostic Assessment, Personalized Study Plan, and Lesson Player Router."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.security import get_current_user, get_current_user_optional
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
    current_user: dict[str, Any] | None = Depends(get_current_user_optional),
):
    """Retrieves 5-8 question baseline diagnostic grounded in NCERT Class 9."""
    diag_svc = get_diagnostic_service()
    questions = diag_svc.get_diagnostic_questions(lang=lang)
    user_id = current_user["id"] if current_user else "guest_student"
    previous_res = await diag_svc.get_diagnostic_results(user_id)
    return {
        "questions": questions,
        "count": len(questions),
        "target": "NCERT Class 9 Science Baseline Diagnostic",
        "description": "5-minute diagnostic to map student mastery across core concepts.",
        "previous_result": previous_res.get("result") if previous_res.get("has_results") else None,
        "has_previous_result": previous_res.get("has_results", False),
    }


@router.get("/assessment/diagnostic/results")
async def get_diagnostic_results(
    current_user: dict[str, Any] | None = Depends(get_current_user_optional),
):
    """Retrieves authenticated learner's last completed diagnostic assessment results."""
    diag_svc = get_diagnostic_service()
    user_id = current_user["id"] if current_user else "guest_student"
    return await diag_svc.get_diagnostic_results(user_id=user_id)


@router.post("/assessment/diagnostic/submit")
async def submit_diagnostic(
    req: DiagnosticSubmissionRequest,
    current_user: dict[str, Any] | None = Depends(get_current_user_optional),
):
    """Evaluates student baseline diagnostic, seeds real mastery & maps misconceptions."""
    diag_svc = get_diagnostic_service()
    user_id = current_user["id"] if current_user else "guest_student"
    submissions = [{"question_id": a.question_id, "selected_index": a.selected_index} for a in req.answers]
    return await diag_svc.evaluate_diagnostic(
        user_id=user_id,
        submissions=submissions,
        lang=req.lang,
    )



@router.get("/studyplan")
async def get_study_plan(
    time_budget: int = Query(default=45, ge=15, le=120),
    lang: str = Query(default="en"),
    current_user: dict[str, Any] | None = Depends(get_current_user_optional),
):
    """Generates today's personalized study plan from real mastery + prerequisite DAG."""
    planner = get_planner_service()
    user_id = current_user["id"] if current_user else "guest_student"
    return await planner.get_study_plan(
        user_id=user_id,
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


class RetakeQuizRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=50)
    question_id: str = Field(..., min_length=2, max_length=100)
    selected_index: int = Field(..., ge=0, le=10)
    attempt_id: str | None = None


@router.get("/learning-gaps")
async def get_learning_gaps(
    lang: str = Query(default="en"),
    current_user: dict[str, Any] | None = Depends(get_current_user_optional),
):
    """Detects student learning gaps from assessment evidence, recommending targeted revision and quiz retakes."""
    from app.services.learning_gap_service import get_learning_gap_service

    user_id = current_user["id"] if current_user else "guest_student"
    gap_svc = get_learning_gap_service()
    return await gap_svc.get_learning_gaps(user_id=user_id, lang=lang)


@router.get("/learning-gaps/question")
async def get_retake_question(
    topic: str = Query(..., min_length=2, max_length=50),
    lang: str = Query(default="en"),
    current_user: dict[str, Any] | None = Depends(get_current_user_optional),
):
    """Fetches a specific quiz question for retaking a concept quiz."""
    from app.services.learning_gap_service import get_learning_gap_service

    gap_svc = get_learning_gap_service()
    return gap_svc.get_question_for_topic(topic=topic, lang=lang)


@router.post("/learning-gaps/retake")
async def retake_quiz(
    req: RetakeQuizRequest,
    current_user: dict[str, Any] | None = Depends(get_current_user_optional),
):
    """Evaluates retake quiz submission, updates mastery atomically, and computes evidence-based comparison."""
    from app.services.learning_gap_service import get_learning_gap_service

    user_id = current_user["id"] if current_user else "guest_student"
    gap_svc = get_learning_gap_service()
    return await gap_svc.retake_concept_quiz(
        user_id=user_id,
        topic=req.topic,
        question_id=req.question_id,
        selected_index=req.selected_index,
        attempt_id=req.attempt_id,
    )


