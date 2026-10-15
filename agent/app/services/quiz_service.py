"""Quiz Evaluation & Question Bank Service.

Provides:
- Safe question serving without correct answers
- Server-authoritative answer evaluation
- Integration with MasteryService and ProfileService
"""

import logging
from typing import Any

from fastapi import HTTPException, status

from app.db import get_database
from app.models.quiz import QuizAnswerRequest, QuizAnswerResponse, QuizQuestionPublic
from app.services.kb_service import get_kb_service
from app.services.mastery_service import get_mastery_service
from app.services.profile_service import get_profile_service

logger = logging.getLogger("ekalsahayak.quiz")


class QuizService:
    """Manages question retrieval and server-authoritative scoring."""

    async def get_question(self, question_id: str) -> dict[str, Any] | None:
        """Fetches question by ID from MongoDB, falling back to KB."""
        db = get_database()
        q = await db.questions.find_one({"id": question_id})
        if q:
            return q

        # Fallback to in-memory KB
        kb = get_kb_service()
        for item in kb.get_all_seed_questions():
            if item.get("id") == question_id:
                return item
        return None

    async def get_questions_for_topic(self, topic: str, limit: int = 10, lang: str = "en") -> list[QuizQuestionPublic]:
        """Returns questions for a topic stripped of correct answers, preserving option order invariant."""
        db = get_database()
        clean_topic = (topic or "").strip().lower()
        if clean_topic == "cell_structure":
            clean_topic = "cell_biology"

        query = {} if (not clean_topic or clean_topic == "all") else {"topic": clean_topic}
        cursor = db.questions.find(query).limit(limit)
        raw_items: list[dict[str, Any]] = []

        async for q in cursor:
            raw_items.append(q)

        # If Mongo had none, check KB
        if not raw_items:
            kb = get_kb_service()
            for q in kb.get_all_seed_questions():
                q_topic = q.get("topic", "")
                if (not clean_topic or clean_topic == "all" or q_topic == clean_topic) and len(raw_items) < limit:
                    raw_items.append(q)

        # Final fallback if still none: fetch any available questions
        if not raw_items:
            cursor_all = db.questions.find({}).limit(limit)
            async for q in cursor_all:
                raw_items.append(q)

        results: list[QuizQuestionPublic] = []
        clean_lang = lang.strip().lower()

        for q in raw_items:
            if clean_lang in ("or", "odia"):
                p_loc = q.get("prompt_odia", "")
                o_loc = list(q.get("options_odia", []))
            elif clean_lang in ("en", "english"):
                p_loc = q.get("prompt_english", "")
                o_loc = list(q.get("options_english", []))
            elif clean_lang == "hi-latn":
                p_loc = f"{q.get('prompt_english', '')} (Sawaal: {q.get('prompt_odia', '')[:40]})"
                o_loc = list(q.get("options_english", []))
            else:
                p_loc = q.get("prompt_english") or q.get("prompt_odia", "")
                o_loc = list(q.get("options_english") or q.get("options_odia", []))

            # Guarantee options order and length parity
            assert len(o_loc) == len(q.get("options_odia", [])) == len(q.get("options_english", []))

            results.append(
                QuizQuestionPublic(
                    id=q["id"],
                    topic=q["topic"],
                    difficulty=q["difficulty"],
                    prompt_odia=q["prompt_odia"],
                    prompt_english=q["prompt_english"],
                    options_odia=q["options_odia"],
                    options_english=q["options_english"],
                    prompt_localized=p_loc,
                    options_localized=o_loc,
                    prerequisite=q.get("prerequisite"),
                )
            )

        return results

    def localize_quiz_pack(self, pack_data: dict[str, Any], lang: str = "en") -> dict[str, Any]:
        """Localizes an entire quiz pack for offline or online serving, strictly preserving correct_index and option order."""
        clean_lang = lang.strip().lower()
        localized_questions = []

        for q in pack_data.get("questions", []):
            opts = list(q.get("options", []))
            loc_opts = list(opts)  # Preserves 1:1 order invariant
            loc_q = dict(q)
            loc_q["options"] = opts
            loc_q["options_localized"] = loc_opts
            # correct_index remains strictly untouched
            loc_q["correct_index"] = q["correct_index"]
            loc_q["prompt_localized"] = q.get("question_text", "")
            localized_questions.append(loc_q)

        return {
            **pack_data,
            "language": lang,
            "questions": localized_questions,
        }

    async def evaluate_answer(self, user_id: str, req: QuizAnswerRequest) -> QuizAnswerResponse:
        """Evaluates an answer server-side, updates mastery, and resolves misconceptions."""
        q = await self.get_question(req.question_id)
        if not q:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Question with ID '{req.question_id}' not found in question bank.",
            )

        options_count = len(q.get("options_odia", []))
        if req.selected_index < 0 or req.selected_index >= options_count:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Selected index {req.selected_index} is out of bounds for options (0 to {options_count - 1}).",
            )

        correct_idx = q.get("correct_index", 0)
        is_correct = req.selected_index == correct_idx
        topic = q.get("topic", "evaporation")

        # Apply mastery changes with idempotency and daily capping
        mastery_svc = get_mastery_service()
        new_mastery, is_capped = await mastery_svc.apply_quiz_result(
            user_id=user_id,
            topic=topic,
            question_id=req.question_id,
            attempt_id=req.attempt_id,
            is_correct=is_correct,
        )

        # Update misconception tracking
        profile_svc = get_profile_service()
        await profile_svc.register_quiz_outcome(user_id, topic, is_correct)

        score_awarded = 10 if is_correct else 0
        streak = 1 if is_correct else 0

        return QuizAnswerResponse(
            question_id=req.question_id,
            selected_index=req.selected_index,
            correct=is_correct,
            correct_index=correct_idx,
            score_awarded=score_awarded,
            explanation_odia=q.get("explanation_odia", ""),
            explanation_english=q.get("explanation_english", ""),
            new_mastery=new_mastery,
            streak=streak,
            daily_gain_capped=is_capped,
        )


# Global singleton instance
quiz_service = QuizService()


def get_quiz_service() -> QuizService:
    return quiz_service
