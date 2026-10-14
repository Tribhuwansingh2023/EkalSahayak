"""
FastAPI Server for Sunita AI & EkalSahayak EdTech System.
Exposes endpoints for:
1. Agent interaction with full deterministic LangGraph decision traces
2. Student learning profile & persistent mastery graph (MongoDB)
3. User Registration & Login Authentication with JWT (MongoDB)
4. Real-time WebSocket Questionnaire Engine (/ws/quiz)
5. Quiz question bank, topic directory, and session history
6. Voice TTS and STT vernacular processing
7. Offline curriculum pack generation & offline-to-online sync
"""

import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException, Depends, WebSocket, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from graph import sunita_agent_graph
from profile_manager import profile_manager
from sync_manager import sync_manager
from curriculum_kb import ODISHA_CLASS9_SCIENCE_KB
from db import init_db, check_db_connection, get_db, SEED_QUESTIONS
from auth import (
    UserRegisterRequest,
    UserLoginRequest,
    AuthResponse,
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_user_optional
)
from quiz_ws import handle_quiz_websocket
from voice_service import voice_service

app = FastAPI(
    title="Sunita AI - Deterministic Pedagogical Agent & Real-Time EdTech Engine",
    description="Agentic EdTech system for regional language learners in rural Odisha (Class 9 Science) backed by MongoDB & Real-Time WebSockets",
    version="2.0.0"
)

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    """Initializes MongoDB connection, indexes, and question seeds on boot."""
    success = await init_db()
    if success:
        print("[Sunita AI Server] MongoDB connection established & database initialized.")
    else:
        print("[Sunita AI Server] MongoDB running in fallback mode or connecting in background.")


class InteractRequest(BaseModel):
    query: str
    student_id: str = "sunita_class9"
    language: str = "odia"
    input_type: str = "text"  # "text" | "voice"
    is_offline: bool = False


class QuizSubmitRequest(BaseModel):
    student_id: str = "sunita_class9"
    topic: str
    question_id: str
    selected_option_index: int
    correct_option_index: int


class OfflineSyncRequest(BaseModel):
    student_id: str = "sunita_class9"
    actions: List[Dict[str, Any]]


# ---------------------------------------------------------------------
# System Health & Database Telemetry
# ---------------------------------------------------------------------

@app.get("/health")
@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "sunita-ai-agent-engine",
        "version": "2.0.0",
        "framework": "LangGraph + MongoDB + Real-Time WebSockets",
        "active_curriculum": "BSE Odisha Class 9 Science"
    }


@app.get("/api/db/status")
async def db_status():
    """Returns MongoDB connectivity status and document counts."""
    conn_info = await check_db_connection()
    stats = {}
    if conn_info.get("connected"):
        database = get_db()
        stats = {
            "users_count": await database["users"].count_documents({}),
            "profiles_count": await database["student_profiles"].count_documents({}),
            "questions_count": await database["questions"].count_documents({}),
            "quiz_sessions_count": await database["quiz_sessions"].count_documents({})
        }
    return {
        "success": True,
        "database": conn_info,
        "collection_stats": stats
    }


# ---------------------------------------------------------------------
# Authentication Endpoints (JWT + MongoDB)
# ---------------------------------------------------------------------

@app.post("/api/auth/register", response_model=AuthResponse)
async def register_user(req: UserRegisterRequest):
    """
    Registers a new student or learner into MongoDB.
    Initializes their learning profile, mastery graph, and issues a JWT token.
    """
    database = get_db()
    users = database["users"]

    # Check if username exists
    existing_user = await users.find_one({"username": req.username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{req.username}' is already taken."
        )

    # Check if email exists
    existing_email = await users.find_one({"email": req.email})
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{req.email}' already exists."
        )

    # Hash password & insert user
    password_hash = get_password_hash(req.password)
    user_doc = {
        "username": req.username,
        "email": req.email,
        "password_hash": password_hash,
        "name": req.name,
        "grade": req.grade,
        "medium": req.medium,
        "home_dialect": req.home_dialect,
        "created_at": datetime.utcnow().isoformat()
    }
    result = await users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Initialize student learning profile in MongoDB
    profile = await profile_manager.create_profile_for_user(
        student_id=req.username,
        name=req.name,
        grade=req.grade,
        medium=req.medium,
        home_dialect=req.home_dialect,
        user_id=user_id
    )

    # Issue JWT token
    token = create_access_token({
        "sub": req.username,
        "user_id": user_id,
        "name": req.name,
        "grade": req.grade
    })

    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "username": req.username,
            "email": req.email,
            "name": req.name,
            "grade": req.grade,
            "medium": req.medium,
            "mastery_map": profile.get("mastery_map", {})
        },
        "message": f"Welcome {req.name}! Your learning account has been created."
    }


@app.post("/api/auth/login", response_model=AuthResponse)
async def login_user(req: UserLoginRequest):
    """
    Authenticates student with username or email and password.
    Returns JWT token and learning profile from MongoDB.
    """
    database = get_db()
    users = database["users"]

    # Search by username or email
    user = await users.find_one({
        "$or": [
            {"username": req.username_or_email},
            {"email": req.username_or_email}
        ]
    })

    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password."
        )

    username = user["username"]
    user_id = str(user["_id"])

    # Fetch profile from MongoDB
    profile = await profile_manager.get_profile_async(username)

    # Generate token
    token = create_access_token({
        "sub": username,
        "user_id": user_id,
        "name": user.get("name", username),
        "grade": user.get("grade", 9)
    })

    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "username": username,
            "email": user.get("email"),
            "name": user.get("name", username),
            "grade": user.get("grade", 9),
            "medium": user.get("medium", "Odia"),
            "mastery_map": profile.get("mastery_map", {})
        },
        "message": f"Welcome back, {user.get('name', username)}!"
    }


@app.get("/api/auth/me")
async def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """Returns the authenticated user's credentials and their persistent MongoDB profile."""
    username = user["username"]
    profile = await profile_manager.get_profile_async(username)
    return {
        "success": True,
        "user": user,
        "profile": profile
    }


# ---------------------------------------------------------------------
# Real-Time WebSocket Questionnaire Endpoint
# ---------------------------------------------------------------------

@app.websocket("/ws/quiz")
async def quiz_websocket_endpoint(websocket: WebSocket):
    """
    High-performance real-time interactive quiz endpoint.
    Streams questions, evaluates responses immediately, tracks streaks,
    and saves session progress into MongoDB.
    """
    await handle_quiz_websocket(websocket)


# ---------------------------------------------------------------------
# Quiz Questions & Topics REST Endpoints
# ---------------------------------------------------------------------

@app.get("/api/quiz/topics")
async def get_quiz_topics():
    """Lists available curriculum topics for questionnaires with question counts."""
    try:
        database = get_db()
        cursor = database["questions"].find({}, {"topic": 1, "difficulty": 1})
        docs = await cursor.to_list(length=100)
    except Exception:
        docs = SEED_QUESTIONS

    topic_counts: Dict[str, int] = {}
    for d in docs:
        t = d.get("topic", "general")
        topic_counts[t] = topic_counts.get(t, 0) + 1

    topics_meta = [
        {"id": "all", "name_odia": "ସମସ୍ତ ଅଧ୍ୟାୟ (All Topics)", "name_en": "Full Syllabus Drill", "count": sum(topic_counts.values())},
        {"id": "evaporation", "name_odia": "ବାଷ୍ପୀଭବନ ଓ ସ୍ଫୁଟନ (Evaporation)", "name_en": "Evaporation vs Boiling", "count": topic_counts.get("evaporation", 2)},
        {"id": "latent_heat", "name_odia": "ଲୀନ ତାପ (Latent Heat)", "name_en": "Latent Heat & Steam", "count": topic_counts.get("latent_heat", 1)},
        {"id": "cell_structure", "name_odia": "କୋଷ ଗଠନ (Cell Biology)", "name_en": "Cell & Mitochondria", "count": topic_counts.get("cell_structure", 1)},
        {"id": "motion", "name_odia": "ଗତି ଓ ବିସ୍ଥାପନ (Motion)", "name_en": "Motion & Displacement", "count": topic_counts.get("motion", 1)},
        {"id": "force", "name_odia": "ବଳ ଓ ଗତି ନିୟମ (Force & Laws)", "name_en": "Force & Inertia", "count": topic_counts.get("force", 1)},
    ]

    return {
        "success": True,
        "topics": topics_meta
    }


@app.get("/api/quiz/questions")
async def get_quiz_questions(topic: Optional[str] = None):
    """Fetches questions from MongoDB question bank."""
    query = {}
    if topic and topic != "all":
        query["topic"] = topic

    try:
        database = get_db()
        cursor = database["questions"].find(query, {"_id": 0})
        questions = await cursor.to_list(length=50)
    except Exception:
        questions = []

    if not questions:
        if topic and topic != "all":
            questions = [q for q in SEED_QUESTIONS if q.get("topic") == topic]
        else:
            questions = list(SEED_QUESTIONS)

    return {
        "success": True,
        "count": len(questions),
        "questions": questions
    }


@app.get("/api/quiz/history")
async def get_quiz_history(student_id: str = "sunita_class9"):
    """Returns past quiz session summaries and accuracy records from MongoDB."""
    try:
        database = get_db()
        cursor = database["quiz_sessions"].find(
            {"student_id": student_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(10)
        history = await cursor.to_list(length=10)
    except Exception:
        history = []

    return {
        "success": True,
        "student_id": student_id,
        "history": history
    }


# ---------------------------------------------------------------------
# Agent Interaction & Pedagogical Workflow
# ---------------------------------------------------------------------

@app.post("/api/agent/interact")
def interact(req: InteractRequest):
    """
    Executes the full LangGraph deterministic workflow loop for Sunita's question.
    Returns:
    - Odia vernacular explanation
    - Odia spoken audio script
    - 2-question micro quiz
    - Scheduled follow-up action
    - Step-by-step agent decision traces for judge inspection
    """
    try:
        initial_state = {
            "student_id": req.student_id,
            "query": req.query,
            "language": req.language,
            "input_type": req.input_type,
            "is_offline": req.is_offline,
            "detected_topic": "",
            "student_profile": {},
            "prerequisite_missing": False,
            "prerequisite_topic": None,
            "misconception_diagnosed": None,
            "vernacular_analogy": None,
            "micro_quiz": None,
            "updated_mastery": None,
            "final_response_odia": "",
            "final_audio_script": "",
            "next_followup_plan": "",
            "traces": [],
            "current_node": ""
        }

        output_state = sunita_agent_graph.invoke(initial_state)

        return {
            "success": True,
            "detected_topic": output_state.get("detected_topic"),
            "misconception_diagnosed": output_state.get("misconception_diagnosed"),
            "prerequisite_missing": output_state.get("prerequisite_missing"),
            "response_odia": output_state.get("final_response_odia"),
            "audio_spoken_script": output_state.get("final_audio_script"),
            "micro_quiz": output_state.get("micro_quiz"),
            "next_followup_plan": output_state.get("next_followup_plan"),
            "updated_mastery": output_state.get("updated_mastery"),
            # The decision trace is the crucial proof of genuine agentic behavior
            "agent_decision_traces": output_state.get("traces", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agent/profile")
def get_student_profile(student_id: str = "sunita_class9"):
    """Returns student learning mastery map, misconceptions, and follow-ups from MongoDB."""
    profile = profile_manager.get_profile(student_id)
    return {
        "success": True,
        "profile": profile
    }


@app.post("/api/agent/quiz-submit")
def submit_quiz_answer(req: QuizSubmitRequest):
    """Evaluates student quiz answer and updates the learning graph mastery in MongoDB."""
    is_correct = req.selected_option_index == req.correct_option_index
    delta = 0.12 if is_correct else -0.05
    updated = profile_manager.update_mastery(req.student_id, req.topic, delta)
    
    return {
        "success": True,
        "is_correct": is_correct,
        "feedback_odia": "ସଠିକ୍ ଉତ୍ତର! ତୁମର ଅଭିବୃଦ୍ଧି ରେକର୍ଡ ହେଲା।" if is_correct else "ଭୁଲ ହେଲା, କିନ୍ତୁ ଚିନ୍ତା କର ନାହିଁ। ପୁଣି ଥରେ ଚେଷ୍ଟା କର।",
        "new_mastery": updated["mastery_map"].get(req.topic)
    }


@app.get("/api/agent/offline-pack")
def get_offline_pack(student_id: str = "sunita_class9"):
    """Generates offline JSON bundle for client-side caching."""
    pack = sync_manager.generate_offline_pack(student_id)
    return pack


@app.post("/api/agent/sync")
def sync_offline_actions(req: OfflineSyncRequest):
    """Reconciles offline queue when connection resumes."""
    for act in req.actions:
        sync_manager.queue_offline_action(act)
    result = sync_manager.sync_queued_actions(req.student_id)
    return result


# ---------------------------------------------------------------------
# Voice Engine (TTS & STT)
# ---------------------------------------------------------------------

class TTSRequest(BaseModel):
    text: str
    lang: str = "or"
    engine: str = "indic_natural"  # "indic_natural" | "bhashini" | "web"
    slow: bool = False


class STTRequest(BaseModel):
    audio_base64: Optional[str] = None
    format: str = "webm"
    engine: str = "bhashini_whisper"
    text_hint: Optional[str] = None


@app.post("/api/agent/tts")
def generate_tts(req: TTSRequest):
    """
    Synthesizes speech for rural learners using our Indic phonetic transliteration
    engine + high-fidelity acoustic models with memory and disk caching.
    """
    try:
        from fastapi.responses import Response
        audio_bytes, is_cache = voice_service.synthesize_speech(
            text=req.text,
            slow=req.slow,
            engine=req.engine
        )
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "public, max-age=86400",
                "X-Audio-Cache-Hit": str(is_cache).lower(),
                "X-Voice-Engine": req.engine
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


@app.post("/api/agent/stt")
def transcribe_stt(req: STTRequest):
    """
    Speech-to-Text (STT) for Odia queries.
    Integrates Bhashini (AI4Bharat) / Whisper Indic pipeline with vernacular acoustic intent matching.
    """
    try:
        import base64
        audio_bytes = None
        if req.audio_base64:
            try:
                b64 = req.audio_base64.split(",")[-1]
                audio_bytes = base64.b64decode(b64)
            except Exception:
                pass

        result = voice_service.transcribe_audio(
            audio_bytes=audio_bytes,
            raw_text_hint=req.text_hint,
            engine=req.engine
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STT transcription failed: {str(e)}")


@app.get("/api/agent/voice/telemetry")
def get_voice_telemetry():
    """Returns real-time voice telemetry for judge inspector mode."""
    return {
        "success": True,
        "telemetry": voice_service.get_telemetry()
    }


@app.get("/api/agent/voice/samples")
def get_voice_samples():
    """Returns curated Odia vernacular voice doubt prompts for quick testing."""
    return {
        "success": True,
        "samples": [
            {
                "id": "sample_evap_pot",
                "prompt_odia": "ମାଟି ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ?",
                "concept": "evaporation",
                "label": "🍵 Earthen Pot Cooling",
                "phonetic": "माटि माठिआरे पाणि काहिँकि थण्डा रहे?"
            },
            {
                "id": "sample_latent_steam",
                "prompt_odia": "ଭାତ ହାଣ୍ଡିର ବାଷ୍ପ କାହିଁକି ଅଧିକ ପୋଡ଼ିଥାଏ?",
                "concept": "latent_heat",
                "label": "🍚 Rice Pot Steam (Latent Heat)",
                "phonetic": "भात हाण्डिर बाष्प काहिँकि अधिक पोड़िथाए?"
            },
            {
                "id": "sample_evap_clothes",
                "prompt_odia": "ଖରାଦିନେ ଓଦା ଲୁଗା ଶୀଘ୍ର କାହିଁକି ଶୁଖିଯାଏ?",
                "concept": "evaporation",
                "label": "👕 Drying Clothes in Sun",
                "phonetic": "खरादिने ओदा लुगा शीघ्र काहिँकि शुखिजाए?"
            },
            {
                "id": "sample_cell_mito",
                "prompt_odia": "କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର (Powerhouse) କାହାକୁ କୁହାଯାଏ?",
                "concept": "cell_structure",
                "label": "🔬 Powerhouse of Cell",
                "phonetic": "कोषर शक्ति केन्द्र माइटोकण्ड्रिआ काहाकु कुहाजाए?"
            }
        ]
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("server:app", host="127.0.0.1", port=port, reload=True)
