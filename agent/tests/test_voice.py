"""Phase 5: Voice and Vernacular Audio Test Suite (Honest STT & Robust TTS).

Covers:
- STT NullProvider honest 501 (code: "stt_not_configured", no fake transcripts)
- Audio payload size limit (>2 MB -> 413)
- Binary magic bytes and MIME validation (invalid format -> 415)
- Text hint intent helper labeled engine: "keyword_hint"
- TTS text character limit (>800 chars -> 422)
- TTS synthesis and SHA-256 caching (X-Cache-Hit)
- TTS provider failure returns 503 (not 500)
- Telemetry endpoint is admin-only (student -> 403, admin -> 200)
"""

import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.models.auth import UserRole


async def create_user(async_client: AsyncClient, username: str, role: UserRole = UserRole.STUDENT) -> str:
    """Helper to create user with specified role and return token."""
    resp = await async_client.post(
        "/api/auth/register",
        json={
            "username": username,
            "email": f"{username}@odisha.edu.in",
            "password": "StrongPassword123!",
            "role": role.value,
        },
    )
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_stt_null_provider_returns_honest_501(async_client: AsyncClient):
    """When STT is unconfigured, endpoint returns 501 with stt_not_configured, never fake transcripts."""
    token = await create_user(async_client, "voice_tester_null")

    # Valid WAV file header (RIFF....WAVE)
    valid_wav_header = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"

    resp = await async_client.post(
        "/api/agent/stt",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "audio/wav"},
        content=valid_wav_header,
    )
    assert resp.status_code == 501
    err = resp.json()["error"]
    assert err["code"] == "stt_not_configured"
    assert "not configured" in err["message"].lower()


@pytest.mark.asyncio
async def test_stt_oversized_audio_rejected_413(async_client: AsyncClient):
    """Audio payloads exceeding 2 MB are rejected with 413."""
    token = await create_user(async_client, "voice_tester_size")

    # Create oversized 2.1 MB payload
    oversized = b"RIFF" + (b"\x00" * (2 * 1024 * 1024 + 100))

    resp = await async_client.post(
        "/api/agent/stt",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "audio/wav"},
        content=oversized,
    )
    assert resp.status_code == 413
    assert "exceeds" in resp.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_stt_invalid_magic_bytes_rejected_415(async_client: AsyncClient):
    """Invalid payload without audio magic bytes returns 415 Unsupported Media Type."""
    token = await create_user(async_client, "voice_tester_mime")

    corrupt_audio = b"This is plain text pretending to be audio"

    resp = await async_client.post(
        "/api/agent/stt",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "audio/wav"},
        content=corrupt_audio,
    )
    assert resp.status_code == 415
    assert "magic header bytes" in resp.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_stt_text_hint_helper_intent(async_client: AsyncClient):
    """When text_hint is supplied, returns honest engine: keyword_hint."""
    token = await create_user(async_client, "voice_tester_hint")

    resp = await async_client.post(
        "/api/agent/stt?text_hint=ମାଟି%20ମାଠିଆରେ%20ପାଣି",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["transcript"] == "ମାଟି ମାଠିଆରେ ପାଣି"
    assert data["engine"] == "keyword_hint"
    assert data["confidence"] == 1.0


@pytest.mark.asyncio
async def test_tts_length_cap_exceeded_422(async_client: AsyncClient):
    """Text longer than 800 characters returns 422."""
    token = await create_user(async_client, "voice_tester_tts_len")
    long_text = "ଓଡ଼ିଆ " * 300  # > 800 chars

    resp = await async_client.get(
        f"/api/agent/tts?text={long_text}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_tts_synthesis_and_sha256_cache_hit(async_client: AsyncClient):
    """TTS synthesizes speech and second call returns cached response (X-Cache-Hit)."""
    token = await create_user(async_client, "voice_tester_cache")
    text = f"ନୂତନ ପରୀକ୍ଷଣ ପାଠ {uuid.uuid4()}"

    # Mock gTTS generation to return dummy mp3 bytes for fast reliable testing
    dummy_mp3 = b"ID3\x03\x00\x00\x00\x00\x00#TSSE\x00\x00\x00\x07\x00\x00\x01\x00\x00\x00mock_audio_bytes"
    with patch("app.services.voice_service.VoiceService._sync_gtts_generate", return_value=dummy_mp3):
        # 1. First synthesis (Cache miss)
        resp1 = await async_client.get(
            f"/api/agent/tts?text={text}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp1.status_code == 200
        assert resp1.headers["Content-Type"] == "audio/mpeg"
        assert resp1.headers.get("X-Cache-Hit") == "false"

        # 2. Second synthesis with exact same text (Cache hit)
        resp2 = await async_client.get(
            f"/api/agent/tts?text={text}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp2.status_code == 200
        assert resp2.headers.get("X-Cache-Hit") == "true"


@pytest.mark.asyncio
async def test_tts_provider_failure_returns_503(async_client: AsyncClient):
    """When gTTS network call fails, server returns 503 Service Unavailable (not 500)."""
    token = await create_user(async_client, "voice_tester_fail")
    unique_text = f"ଅସଫଳତା ପରୀକ୍ଷା {uuid.uuid4()}"

    with patch(
        "app.services.voice_service.VoiceService._sync_gtts_generate",
        side_effect=RuntimeError("gTTS upstream connection refused"),
    ):
        resp = await async_client.get(
            f"/api/agent/tts?text={unique_text}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 503
        data = resp.json()
        assert data["error"]["code"] == "HTTP_ERROR"


@pytest.mark.asyncio
async def test_voice_telemetry_admin_only(async_client: AsyncClient):
    """Students receive 403 Forbidden on /api/voice/telemetry; Admins receive 200."""
    student_token = await create_user(async_client, "voice_student_user", UserRole.STUDENT)
    admin_token = await create_user(async_client, "voice_admin_user", UserRole.ADMIN)

    # 1. Student access -> 403
    resp_student = await async_client.get(
        "/api/voice/telemetry",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert resp_student.status_code == 403

    # 2. Admin access -> 200
    resp_admin = await async_client.get(
        "/api/voice/telemetry",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_admin.status_code == 200
    data = resp_admin.json()
    assert "total_syntheses" in data
    assert "stt_provider" in data
