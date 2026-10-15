"""WebSocket Questionnaire Engine (/ws/quiz).

Secured and hardened with:
- Mandatory JWT authentication (?token= or first AUTH message) with 4401 rejection
- Max 1 active WebSocket session per user (4409 conflict rejection)
- Max message size limit (16 KB)
- Per-connection message rate limiting and idle timeouts
- Server-authoritative question delivery and answer scoring
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.security import decode_token
from app.services.mastery_service import get_mastery_service
from app.services.profile_service import get_profile_service
from app.services.quiz_service import get_quiz_service

logger = logging.getLogger("ekalsahayak.ws_quiz")

router = APIRouter(tags=["WebSocket Quiz"])

# Active connections per user_id to enforce max 1 session per user
_ACTIVE_USER_SESSIONS: set[str] = set()

MAX_MESSAGE_BYTES = 16 * 1024  # 16 KB
IDLE_TIMEOUT_SECONDS = 120.0
MIN_MESSAGE_INTERVAL_SEC = 0.2  # Anti-flood rate limit


@router.websocket("/ws/quiz")
async def quiz_websocket_endpoint(websocket: WebSocket):
    """Real-time interactive quiz session over WebSockets."""
    await websocket.accept()

    settings = get_settings()
    user_id: str | None = None

    # 1. Authentication Stage: Check query param or first message
    token = websocket.query_params.get("token")
    if not token:
        try:
            # Wait up to 5s for the initial auth frame
            first_msg_raw = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
            if len(first_msg_raw) > MAX_MESSAGE_BYTES:
                await websocket.close(code=4400, reason="Message exceeds size limit.")
                return
            first_msg = json.loads(first_msg_raw)
            if first_msg.get("type") == "AUTH":
                token = first_msg.get("token")
        except (TimeoutError, json.JSONDecodeError):
            pass

    if not token:
        logger.warning("WebSocket quiz connection rejected: missing authentication token.")
        await websocket.close(code=4401, reason="Authentication token required.")
        return

    try:
        payload = decode_token(token, expected_type="access", settings=settings)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4401, reason="Invalid token claims.")
            return
    except Exception as exc:
        logger.warning("WebSocket quiz auth failure: %s", exc)
        await websocket.close(code=4401, reason="Invalid authentication token.")
        return

    # 2. Enforce Single Active Session per User
    if user_id in _ACTIVE_USER_SESSIONS:
        logger.warning("Rejected second concurrent WebSocket session for user %s", user_id)
        await websocket.close(code=4409, reason="Concurrent session conflict: user already has an active quiz session.")
        return

    _ACTIVE_USER_SESSIONS.add(user_id)
    logger.info("WebSocket quiz session established for user %s", user_id)

    # 3. Session State
    session_id = str(uuid.uuid4())
    topic = websocket.query_params.get("topic", "evaporation")
    quiz_svc = get_quiz_service()
    mastery_svc = get_mastery_service()
    profile_svc = get_profile_service()

    questions = await quiz_svc.get_questions_for_topic(topic, limit=5)
    current_idx = 0
    streak = 0
    answered_questions: set[str] = set()
    last_msg_time = 0.0

    # Send Welcome Frame
    await websocket.send_json({
        "type": "SESSION_INIT",
        "session_id": session_id,
        "user_id": user_id,
        "topic": topic,
        "total_questions": len(questions),
        "message": "Connected to real-time questionnaire engine.",
    })

    # Helper to send current question stripped of answers
    async def send_current_question():
        if current_idx < len(questions):
            q = questions[current_idx]
            await websocket.send_json({
                "type": "QUESTION",
                "session_id": session_id,
                "question_number": current_idx + 1,
                "question_index": current_idx,
                "total_questions": len(questions),
                "question_id": q.id,
                "topic": getattr(q, "topic", topic),
                "difficulty": getattr(q, "difficulty", "medium"),
                "prompt_odia": q.prompt_odia,
                "prompt_english": q.prompt_english,
                "options_odia": q.options_odia,
                "options_english": q.options_english,
                "time_limit_sec": 30,
                "current_score": streak * 10,
                "current_streak": streak,
            })

    if questions:
        await send_current_question()
    else:
        # Fallback to any questions instead of abruptly closing
        questions = await quiz_svc.get_questions_for_topic("all", limit=5)
        if questions:
            await send_current_question()
        else:
            await websocket.send_json({"type": "ERROR", "message": f"No questions available for topic '{topic}'."})
            await websocket.close(code=1000)
            _ACTIVE_USER_SESSIONS.discard(user_id)
            return

    try:
        while True:
            # Idle timeout wait
            try:
                raw_text = await asyncio.wait_for(websocket.receive_text(), timeout=IDLE_TIMEOUT_SECONDS)
            except TimeoutError:
                await websocket.send_json({"type": "TIMEOUT", "message": "Session idle timeout reached."})
                await websocket.close(code=1000, reason="Idle timeout.")
                break

            # Message size limit
            if len(raw_text) > MAX_MESSAGE_BYTES:
                await websocket.send_json({"type": "ERROR", "message": "Message exceeds maximum allowed size (16KB)."})
                continue

            # Per-connection rate limit
            now_time = time.perf_counter()
            if now_time - last_msg_time < MIN_MESSAGE_INTERVAL_SEC:
                await websocket.send_json({"type": "THROTTLED", "message": "Rapid messages throttled. Please slow down."})
                continue
            last_msg_time = now_time

            try:
                data = json.loads(raw_text)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "ERROR", "message": "Invalid JSON frame."})
                continue

            msg_type = data.get("type")

            if msg_type == "PING":
                await websocket.send_json({"type": "PONG", "ts": datetime.now(UTC).isoformat()})
                continue

            if msg_type == "START_QUIZ":
                req_topic = data.get("topic") or topic
                if req_topic == "cell_structure":
                    req_topic = "cell_biology"
                topic = req_topic
                questions = await quiz_svc.get_questions_for_topic(topic, limit=5)
                current_idx = 0
                streak = 0
                answered_questions.clear()
                session_id = str(uuid.uuid4())
                await websocket.send_json({
                    "type": "QUIZ_STARTED",
                    "session_id": session_id,
                    "topic": topic,
                    "total_questions": len(questions),
                })
                if questions:
                    await send_current_question()
                continue

            if msg_type == "REQUEST_HINT":
                q_id = data.get("question_id")
                full_q = await quiz_svc.get_question(q_id) if q_id else None
                hint_text = ""
                if full_q:
                    hint_text = full_q.get("explanation_odia") or full_q.get("explanation_english") or "ଧ୍ୟାନ ଦିଅନ୍ତୁ: ପ୍ରଶ୍ନର ମୂଳ ତଥ୍ୟକୁ ସ୍ମରଣ କରନ୍ତୁ।"
                else:
                    hint_text = "ଧ୍ୟାନ ଦିଅନ୍ତୁ: ବିକଳ୍ପଗୁଡ଼ିକୁ ଭଲଭାବେ ପଢ଼ି ଉତ୍ତର ବାଛନ୍ତୁ।"
                await websocket.send_json({
                    "type": "HINT",
                    "question_id": q_id,
                    "hint_odia": hint_text,
                })
                continue

            if msg_type == "SUBMIT_ANSWER":
                q_id = data.get("question_id")
                selected_idx = data.get("selected_index")
                time_taken_ms = max(0, min(60000, int(data.get("time_taken_ms", 5000))))

                # Prevent Replay
                if q_id in answered_questions:
                    await websocket.send_json({"type": "ERROR", "message": "Question already answered in this session."})
                    continue

                if current_idx >= len(questions) or questions[current_idx].id != q_id:
                    await websocket.send_json({"type": "ERROR", "message": "Out-of-order question answer submitted."})
                    continue

                # Server-authoritative lookup
                full_q = await quiz_svc.get_question(q_id)
                if not full_q:
                    await websocket.send_json({"type": "ERROR", "message": "Question not found."})
                    continue

                options_count = len(full_q.get("options_odia", []))
                if selected_idx is None or selected_idx < 0 or selected_idx >= options_count:
                    await websocket.send_json({"type": "ERROR", "message": "Option index out of bounds."})
                    continue

                answered_questions.add(q_id)
                correct_idx = full_q.get("correct_index", 0)
                is_correct = selected_idx == correct_idx

                if is_correct:
                    streak += 1
                else:
                    streak = 0

                # Idempotent mastery update
                attempt_id = f"ws_{session_id}_{q_id}"
                new_mastery, is_capped = await mastery_svc.apply_quiz_result(
                    user_id=user_id,
                    topic=topic,
                    question_id=q_id,
                    attempt_id=attempt_id,
                    is_correct=is_correct,
                )
                await profile_svc.register_quiz_outcome(user_id, topic, is_correct)

                # Send Evaluation
                await websocket.send_json({
                    "type": "ANSWER_EVALUATION",
                    "question_id": q_id,
                    "is_correct": is_correct,
                    "selected_index": selected_idx,
                    "correct_index": correct_idx,
                    "points_earned": 10 if is_correct else 0,
                    "current_score": streak * 10,
                    "current_streak": streak,
                    "mastery_delta": 0.05 if is_correct else -0.02,
                    "new_mastery": round(new_mastery, 4),
                    "topic": topic,
                    "explanation_odia": full_q.get("explanation_odia", ""),
                    "explanation_english": full_q.get("explanation_english", ""),
                    "feedback_odia": "ସଠିକ୍ ଉତ୍ତର!" if is_correct else "ଭୁଲ୍ ଉତ୍ତର। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ!",
                    "streak": streak,
                    "streak_multiplier": 1.25 if streak >= 3 else 1.0,
                    "is_capped": is_capped,
                    "time_taken_ms": time_taken_ms,
                })

                # Move to next question or end
                current_idx += 1
                if current_idx < len(questions):
                    await asyncio.sleep(1.0)  # Brief pedagogical pause
                    await send_current_question()
                else:
                    accuracy = round((len(answered_questions) / max(1, len(questions))) * 100)
                    summary_payload = {
                        "session_id": session_id,
                        "student_id": user_id,
                        "topic": topic,
                        "total_questions": len(questions),
                        "total_correct": len([q for q in answered_questions]),
                        "accuracy_percentage": accuracy,
                        "final_score": streak * 10,
                        "badges": ["Super Student", "Quick Thinker"] if streak >= 2 else ["Quiz Participant"],
                        "recommendation_odia": "ଖୁବ୍ ଭଲ ପ୍ରଦର୍ଶନ! ଆଗାମୀ ଅଧ୍ୟାୟ ଅଭ୍ୟାସ କରନ୍ତୁ।",
                    }
                    await websocket.send_json({
                        "type": "SESSION_COMPLETE",
                        "session_id": session_id,
                        "topic": topic,
                        "final_mastery": round(new_mastery, 4),
                        "total_answered": len(answered_questions),
                        "message": "Quiz session complete!",
                        "summary": summary_payload,
                    })
                    break

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected for user %s", user_id)
    finally:
        if user_id:
            _ACTIVE_USER_SESSIONS.discard(user_id)
