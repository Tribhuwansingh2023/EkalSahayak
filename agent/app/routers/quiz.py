"""Quiz Assessment & History Router."""

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.db import get_database
from app.models.quiz import (
    QuizAnswerRequest,
    QuizAnswerResponse,
    QuizQuestionPublic,
    TopicEnum,
)
from app.security import get_current_user
from app.services.kb_service import get_kb_service
from app.services.quiz_service import get_quiz_service

router = APIRouter(prefix="/api/quiz", tags=["Quiz & Mastery"])


@router.post("/answer", response_model=QuizAnswerResponse)
@router.post("/quiz-submit", response_model=QuizAnswerResponse)
async def submit_answer(
    req: QuizAnswerRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Submits an answer for server-authoritative scoring & mastery graph update."""
    quiz_svc = get_quiz_service()
    return await quiz_svc.evaluate_answer(current_user["id"], req)


@router.get("/topics")
async def get_quiz_topics(current_user: dict[str, Any] = Depends(get_current_user)):
    """Returns available syllabus topics for quizzing."""
    kb = get_kb_service()
    concepts = kb.get_all_concepts()
    topics = []
    for cid, concept in concepts.items():
        topics.append({
            "id": cid,
            "name_odia": concept.title_odia,
            "name_en": concept.title_english,
            "count": len(concept.micro_quiz),
        })
    return {"topics": topics}


@router.get("/questions", response_model=list[QuizQuestionPublic])
async def get_questions(
    topic: TopicEnum = Query(..., description="Curriculum topic to retrieve questions for"),
    limit: int = Query(default=5, ge=1, le=20),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Retrieves questions stripped of correct answers."""
    quiz_svc = get_quiz_service()
    return await quiz_svc.get_questions_for_topic(topic.value, limit=limit)


@router.get("/history")
async def get_quiz_history(
    limit: int = Query(default=20, ge=1, le=50),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Returns the authenticated student's previous quiz attempts."""
    db = get_database()
    cursor = db.quiz_attempts.find({"user_id": current_user["id"]}).sort("created_at", -1).limit(limit)

    history = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        history.append(doc)

    return {"history": history}
