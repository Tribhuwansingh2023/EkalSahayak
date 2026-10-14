"""Domain Services Package."""

from app.services.kb_service import get_kb_service, kb_service
from app.services.mastery_service import get_mastery_service, mastery_service
from app.services.profile_service import get_profile_service, profile_service
from app.services.quiz_service import get_quiz_service, quiz_service
from app.services.sync_service import get_sync_service, sync_service
from app.services.voice_service import get_voice_service, voice_service

__all__ = [
    "get_kb_service",
    "get_mastery_service",
    "get_profile_service",
    "get_quiz_service",
    "get_sync_service",
    "get_voice_service",
    "kb_service",
    "mastery_service",
    "profile_service",
    "quiz_service",
    "sync_service",
    "voice_service",
]
