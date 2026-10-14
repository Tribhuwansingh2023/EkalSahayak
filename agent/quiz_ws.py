"""
Real-Time WebSocket Interactive Questionnaire Engine.
Provides low-latency live streaming question rounds with:
- Live question delivery from MongoDB question bank
- Instant evaluation with streak multipliers and live scoring
- Spoken Odia cultural explanations
- Real-time learning mastery graph updates
- Full session persistence to MongoDB
"""

import json
import uuid
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import WebSocket, WebSocketDisconnect

from db import get_db, SEED_QUESTIONS
from profile_manager import profile_manager
from auth import decode_access_token


class QuizSessionState:
    def __init__(self, session_id: str, student_id: str, topic: str, questions: List[Dict[str, Any]]):
        self.session_id = session_id
        self.student_id = student_id
        self.topic = topic
        self.questions = questions
        self.current_index = 0
        self.score = 0
        self.streak = 0
        self.correct_count = 0
        self.answers_log: List[Dict[str, Any]] = []
        self.started_at = datetime.utcnow()


class QuizConnectionManager:
    def __init__(self):
        # Maps WebSocket to QuizSessionState
        self.active_sessions: Dict[WebSocket, QuizSessionState] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        await websocket.send_json({
            "type": "CONNECTED",
            "message": "Connected to Sunita AI Real-Time WebSocket Quiz Engine",
            "active_curriculum": "BSE Odisha Class 9 Science",
            "server_time": datetime.utcnow().isoformat()
        })

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_sessions:
            del self.active_sessions[websocket]

    async def handle_start_quiz(self, websocket: WebSocket, data: Dict[str, Any]):
        topic = data.get("topic", "all")
        student_id = data.get("student_id", "sunita_class9")
        token = data.get("token")
        
        # Validate JWT token if provided
        if token:
            payload = decode_access_token(token)
            if payload and payload.get("sub"):
                student_id = payload.get("sub")

        # Fetch questions from MongoDB (or seed list)
        database = get_db()
        query = {}
        if topic and topic != "all":
            query["topic"] = topic

        try:
            cursor = database["questions"].find(query)
            questions = await cursor.to_list(length=20)
        except Exception:
            questions = []

        if not questions:
            # Fallback to seed questions filtered by topic
            if topic and topic != "all":
                questions = [q for q in SEED_QUESTIONS if q.get("topic") == topic]
            else:
                questions = list(SEED_QUESTIONS)

        if not questions:
            questions = list(SEED_QUESTIONS)

        session_id = f"qs_{uuid.uuid4().hex[:8]}"
        session = QuizSessionState(session_id, student_id, topic, questions)
        self.active_sessions[websocket] = session

        await websocket.send_json({
            "type": "QUIZ_STARTED",
            "session_id": session_id,
            "topic": topic,
            "student_id": student_id,
            "total_questions": len(questions),
            "message": f"Real-time quiz started! {len(questions)} questions queued."
        })

        # Send first question
        await self.send_current_question(websocket)

    async def send_current_question(self, websocket: WebSocket):
        session = self.active_sessions.get(websocket)
        if not session or session.current_index >= len(session.questions):
            await self.finish_quiz(websocket)
            return

        q = session.questions[session.current_index]
        await websocket.send_json({
            "type": "QUESTION",
            "session_id": session.session_id,
            "question_index": session.current_index,
            "total_questions": len(session.questions),
            "question_id": q.get("id"),
            "topic": q.get("topic"),
            "difficulty": q.get("difficulty", "medium"),
            "prompt_odia": q.get("prompt_odia"),
            "prompt_english": q.get("prompt_english"),
            "options_odia": q.get("options_odia"),
            "options_english": q.get("options_english", []),
            "time_limit_sec": 30,
            "current_score": session.score,
            "current_streak": session.streak
        })

    async def handle_submit_answer(self, websocket: WebSocket, data: Dict[str, Any]):
        session = self.active_sessions.get(websocket)
        if not session:
            await websocket.send_json({"type": "ERROR", "message": "No active quiz session found."})
            return

        if session.current_index >= len(session.questions):
            await self.finish_quiz(websocket)
            return

        q = session.questions[session.current_index]
        selected_index = data.get("selected_index")
        time_taken_ms = data.get("time_taken_ms", 5000)

        correct_index = q.get("correct_index", 0)
        is_correct = (selected_index == correct_index)

        # Score calculation with speed and streak multipliers
        base_points = 100
        speed_bonus = max(0, int((30000 - time_taken_ms) / 1000) * 2) if is_correct else 0
        streak_multiplier = 1.0 + (min(session.streak, 5) * 0.2)

        if is_correct:
            points = int((base_points + speed_bonus) * streak_multiplier)
            session.streak += 1
            session.correct_count += 1
            session.score += points
            mastery_delta = 0.12
        else:
            points = 0
            session.streak = 0
            mastery_delta = -0.04

        # Update mastery in MongoDB
        topic = q.get("topic", "evaporation")
        updated_profile = await profile_manager.update_mastery_async(session.student_id, topic, mastery_delta)
        new_mastery = updated_profile.get("mastery_map", {}).get(topic, 0.5)

        session.answers_log.append({
            "question_id": q.get("id"),
            "selected_index": selected_index,
            "correct_index": correct_index,
            "is_correct": is_correct,
            "points": points,
            "time_taken_ms": time_taken_ms
        })

        # Send evaluation
        await websocket.send_json({
            "type": "EVALUATION",
            "is_correct": is_correct,
            "selected_index": selected_index,
            "correct_index": correct_index,
            "points_earned": points,
            "current_score": session.score,
            "current_streak": session.streak,
            "mastery_delta": mastery_delta,
            "new_mastery": new_mastery,
            "topic": topic,
            "explanation_odia": q.get("explanation_odia"),
            "explanation_english": q.get("explanation_english"),
            "feedback_odia": "ଅତି ଉତ୍ତମ! ସଠିକ୍ ଉତ୍ତର!" if is_correct else "ଭୁଲ ହୋଇଗଲା, ତଥାପି ବ୍ୟସ୍ତ ହୁଅନ୍ତୁ ନାହିଁ। ବୁଝିବାକୁ ଚେଷ୍ଟା କରନ୍ତୁ।"
        })

        # Advance question index
        session.current_index += 1

        # Small pause before sending next question or ending
        await asyncio.sleep(0.5)
        if session.current_index < len(session.questions):
            await self.send_current_question(websocket)
        else:
            await self.finish_quiz(websocket)

    async def handle_hint_request(self, websocket: WebSocket, data: Dict[str, Any]):
        session = self.active_sessions.get(websocket)
        if not session or session.current_index >= len(session.questions):
            return

        q = session.questions[session.current_index]
        topic = q.get("topic", "")
        
        hints = {
            "evaporation": "💡 ସୂଚନା: ମାଟି ମାଠିଆର ପାଣି ଫୁଟେ ନାହିଁ, ବରଂ ଛିଦ୍ର ଦେଇ ଧୀରେ ଧୀରେ ବାଷ୍ପୀଭୂତ ହୋଇ ଥଣ୍ଡା କରେ।",
            "latent_heat": "💡 ସୂଚନା: ଭାତ ହାଣ୍ଡିରୁ ବାହାରୁଥିବା ବାଷ୍ପରେ ଅତିରିକ୍ତ ଗୁପ୍ତ ଉତ୍ତାପ ଥାଏ।",
            "cell_structure": "💡 ସୂଚନା: ଯେପରି ବିଦ୍ୟୁତ୍ ଘରୁ ଶକ୍ତି ମିଳେ, କୋଷ ପାଇଁ ସେହିପରି ଶକ୍ତି କେନ୍ଦ୍ର କିଏ?",
            "motion": "💡 ସୂଚନା: ପ୍ରାରମ୍ଭିକ ବିନ୍ଦୁରୁ ଅନ୍ତିମ ବିନ୍ଦୁ ପର୍ଯ୍ୟନ୍ତ ସର୍ବନିମ୍ନ ଦୂରତା ମନେପକାନ୍ତୁ।",
            "force": "💡 ସୂଚନା: ବସ୍ତୁଟି ନିଜ ଗତି ବଦଳାଇବାକୁ ପ୍ରତିରୋଧ କରୁଛି।"
        }
        hint_odia = hints.get(topic, "💡 ଧ୍ୟାନ ଦେଇ ବିକଳ୍ପଗୁଡ଼ିକ ପଢ଼ନ୍ତୁ ଏବଂ ସଠିକ୍ ସଂଜ୍ଞା ମନେପକାନ୍ତୁ।")

        await websocket.send_json({
            "type": "HINT",
            "question_id": q.get("id"),
            "hint_odia": hint_odia
        })

    async def finish_quiz(self, websocket: WebSocket):
        session = self.active_sessions.get(websocket)
        if not session:
            return

        total_questions = len(session.questions)
        accuracy = round((session.correct_count / max(1, total_questions)) * 100, 1)

        # Badges calculation
        badges = []
        if accuracy == 100:
            badges.append("🌟 ପରଫେକ୍ଟ୍ ମାଷ୍ଟର (Perfect Master)")
        if session.streak >= 3:
            badges.append("🔥 ସ୍ପୀଡ୍ ଷ୍ଟ୍ରାଇକର (3x Streak)")
        if session.score >= 400:
            badges.append("🏆 ବିଜ୍ଞାନ ବିଶେଷଜ୍ଞ (Science Champion)")

        summary = {
            "session_id": session.session_id,
            "student_id": session.student_id,
            "topic": session.topic,
            "total_questions": total_questions,
            "total_correct": session.correct_count,
            "accuracy_percentage": accuracy,
            "final_score": session.score,
            "badges": badges,
            "completed_at": datetime.utcnow().isoformat(),
            "recommendation_odia": (
                "ବହୁତ ଭଲ ପ୍ରଦର୍ଶନ! ଆପଣ ଏହି ବିଷୟରେ ଦୃଢ଼ ଧାରଣା ହାସଲ କରିଛନ୍ତି।"
                if accuracy >= 70 else
                "ଭଲ ପ୍ରୟାସ! ଲୀନ ତାପ ଏବଂ ବାଷ୍ପୀଭବନ ଭିଡ଼ିଓ ପୁନର୍ବାର ଦେଖି ଧାରଣା ଦୃଢ଼ କରନ୍ତୁ।"
            )
        }

        # Save session history to MongoDB
        try:
            database = get_db()
            await database["quiz_sessions"].insert_one({
                **summary,
                "answers_log": session.answers_log,
                "created_at": datetime.utcnow()
            })
        except Exception as e:
            print(f"[WebSocket Quiz] Save history error: {e}")

        await websocket.send_json({
            "type": "QUIZ_SUMMARY",
            "summary": summary
        })


quiz_manager = QuizConnectionManager()


async def handle_quiz_websocket(websocket: WebSocket):
    await quiz_manager.connect(websocket)
    try:
        while True:
            text = await websocket.receive_text()
            try:
                data = json.loads(text)
            except Exception:
                continue

            msg_type = data.get("type", "").upper()
            if msg_type in ["START_QUIZ", "JOIN_QUIZ"]:
                await quiz_manager.handle_start_quiz(websocket, data)
            elif msg_type == "SUBMIT_ANSWER":
                await quiz_manager.handle_submit_answer(websocket, data)
            elif msg_type in ["HINT", "REQUEST_HINT"]:
                await quiz_manager.handle_hint_request(websocket, data)
            elif msg_type == "PING":
                await websocket.send_json({"type": "PONG"})
    except WebSocketDisconnect:
        quiz_manager.disconnect(websocket)
    except Exception as e:
        quiz_manager.disconnect(websocket)
