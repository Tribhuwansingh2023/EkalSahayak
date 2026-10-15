"""API Routers Package."""

from app.routers.agent import router as agent_router
from app.routers.auth import router as auth_router
from app.routers.health import router as health_router
from app.routers.kb import router as kb_router
from app.routers.multiagent_router import router as multiagent_router
from app.routers.offline_quiz_router import router as offline_quiz_router
from app.routers.pilot_router import router as pilot_router
from app.routers.quiz import router as quiz_router
from app.routers.study_router import router as study_router
from app.routers.sync import router as sync_router
from app.routers.teacher_router import router as teacher_router
from app.routers.voice import router as voice_router
from app.routers.ws_quiz import router as ws_quiz_router

__all__ = [
    "agent_router",
    "auth_router",
    "health_router",
    "kb_router",
    "multiagent_router",
    "offline_quiz_router",
    "pilot_router",
    "quiz_router",
    "study_router",
    "sync_router",
    "teacher_router",
    "voice_router",
    "ws_quiz_router",
]
