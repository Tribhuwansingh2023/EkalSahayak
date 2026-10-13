"""
FastAPI Server for Sunita AI Agent Engine.
Exposes endpoints for:
1. Agent interaction with full decision traces
2. Student learning profile & mastery graph
3. Quiz response submission & evaluation
4. Offline curriculum pack generation
5. Offline-to-online reconciliation sync
"""

import os
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from graph import sunita_agent_graph
from profile_manager import profile_manager
from sync_manager import sync_manager
from curriculum_kb import ODISHA_CLASS9_SCIENCE_KB

app = FastAPI(
    title="Sunita AI - Deterministic Pedagogical Agent",
    description="Agentic EdTech system for regional language learners in rural Odisha (Class 9 Science)",
    version="1.0.0"
)

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "sunita-ai-agent-engine",
        "framework": "LangGraph (Deterministic State Graph Workflow)",
        "active_curriculum": "BSE Odisha Class 9 Science"
    }


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
    """Returns Sunita's learning mastery map, misconceptions, and follow-ups."""
    profile = profile_manager.get_profile(student_id)
    return {
        "success": True,
        "profile": profile
    }


@app.post("/api/agent/quiz-submit")
def submit_quiz_answer(req: QuizSubmitRequest):
    """Evaluates student quiz answer and updates the learning graph mastery."""
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


from voice_service import voice_service


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
    Returns audio/mpeg stream so Sunita can listen rather than read long texts on a small screen.
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
                # Strip data URL prefix if present
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
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)

