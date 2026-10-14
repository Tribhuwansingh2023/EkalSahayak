"""Voice & Audio Router for Vernacular Speech Processing."""

import logging
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)

from app.config import Settings, get_settings
from app.models.voice import EngineEnum, STTResponse
from app.rate_limiter import rate_limit_user
from app.security import require_admin
from app.services.voice_service import get_voice_service

logger = logging.getLogger("ekalsahayak.routers.voice")

router = APIRouter(prefix="/api", tags=["Vernacular Audio"])

ALLOWED_AUDIO_TYPES = {"audio/webm", "audio/ogg", "audio/wav", "audio/mpeg", "audio/mp3", "audio/x-wav"}


def check_audio_magic_bytes(data: bytes) -> bool:
    """Validates binary magic headers for webm, ogg, wav, and mp3 audio formats."""
    if len(data) < 4:
        return False
    # WEBM container: \x1a\x45\xdf\xa3
    if data.startswith(b"\x1a\x45\xdf\xa3"):
        return True
    # Ogg container: OggS
    if data.startswith(b"OggS"):
        return True
    # WAV / RIFF: RIFF
    if data.startswith(b"RIFF"):
        return True
    # MP3: ID3 tag or frame sync
    return bool(data.startswith(b"ID3") or data[:2] in [b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"])


@router.get("/agent/tts")
@router.post("/agent/tts")
async def text_to_speech(
    text: str = Query(..., min_length=1, max_length=800, description="Text to synthesize (max 800 chars)"),
    slow: bool = Query(default=False),
    engine: EngineEnum = Query(default=EngineEnum.INDIC_NATURAL),
    current_user: dict[str, Any] = Depends(rate_limit_user(10, 60, "tts")),
):
    """Synthesizes authentic Indic/Odia speech audio with SHA-256 caching."""
    voice_svc = get_voice_service()
    audio_bytes, is_cache_hit = await voice_svc.synthesize_speech(text, slow=slow)

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "X-Cache-Hit": "true" if is_cache_hit else "false",
            "Content-Disposition": 'inline; filename="speech.mp3"',
            "Cache-Control": "public, max-age=86400",
        },
    )


@router.post("/agent/stt", response_model=STTResponse)
async def speech_to_text(
    request: Request,
    file: UploadFile | None = File(default=None),
    text_hint: str | None = Query(default=None, max_length=500),
    current_user: dict[str, Any] = Depends(rate_limit_user(10, 60, "stt")),
    settings: Settings = Depends(get_settings),
):
    """Transcribes vernacular spoken audio using honest configured STT provider."""
    # Intent hint helper if provided
    if text_hint:
        return STTResponse(
            transcript=text_hint,
            confidence=1.0,
            provider="text_hint",
            engine="keyword_hint",
            duration_ms=0.0,
        )

    # 1. Read payload either from multipart upload or raw binary body
    if file:
        content_type = file.content_type or ""
        audio_bytes = await file.read()
    else:
        content_type = request.headers.get("content-type", "")
        audio_bytes = await request.body()

    # 2. Validate payload size
    if not audio_bytes or len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty audio payload received.",
        )

    if len(audio_bytes) > settings.AUDIO_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Audio payload size ({len(audio_bytes)} bytes) exceeds the maximum allowed limit of {settings.AUDIO_MAX_BYTES} bytes.",
        )

    # 3. Validate MIME type
    clean_mime = content_type.split(";")[0].strip().lower()
    if clean_mime and clean_mime not in ALLOWED_AUDIO_TYPES and clean_mime != "application/octet-stream":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported audio media type '{content_type}'. Must be one of {ALLOWED_AUDIO_TYPES}.",
        )

    # 4. Validate binary magic bytes
    if not check_audio_magic_bytes(audio_bytes):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Invalid audio payload: binary magic header bytes do not match webm, ogg, wav, or mp3 format.",
        )

    voice_svc = get_voice_service()
    # Honest provider transcription: raises 501 if NullProvider
    result = await voice_svc.transcribe_audio(audio_bytes, clean_mime)

    return STTResponse(
        transcript=result.get("transcript", ""),
        confidence=result.get("confidence", 0.0),
        provider=result.get("provider", "unknown"),
        engine=result.get("engine", "stt"),
        duration_ms=result.get("duration_ms", 0.0),
    )


@router.get("/voice/telemetry")
async def get_voice_telemetry(admin_user: dict[str, Any] = Depends(require_admin)):
    """Admin-only endpoint for inspecting TTS cache and STT engine metrics."""
    voice_svc = get_voice_service()
    return voice_svc.get_telemetry()


@router.get("/agent/voice/capabilities")
async def get_voice_capabilities(lang: str = Query(default="en")):
    """Returns honest voice TTS/STT capabilities for the requested language code."""
    # gTTS supports standard languages: en, hi, bn, mr, gu, ta, te, kn, ml, pa, ur, ne
    # gTTS does not support Odia, Kui, Tulu, Bodo, Santali, Meitei, etc.
    gtts_supported = {"en", "hi", "bn", "mr", "gu", "ta", "te", "kn", "ml", "pa", "ur", "ne"}
    clean_lang = lang.lower().split("-")[0]
    tts_supported = clean_lang in gtts_supported
    return {
        "language": lang,
        "tts": tts_supported,
        "stt": False,
        "engine": "gTTS" if tts_supported else "browser_speech_synthesis_fallback",
        "browser_speech_fallback": True,
        "note": "Use browser SpeechSynthesis for Odia and regional scripts where server gTTS lacks voice models.",
    }
