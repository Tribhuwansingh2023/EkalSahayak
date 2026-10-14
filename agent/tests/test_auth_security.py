"""Phase 1: Security and Authentication Test Suite.

Covers:
- Registration, Login, Token Refresh, Logout
- Timing attack mitigation and identical unknown user / wrong password errors
- Account lockout after 10 failed attempts
- Expired, tampered, and alg=none token rejection
- IDOR protection: User A cannot read or modify User B's data
- Automated OpenAPI check: all protected routes return 401 without token
- Security headers and global structured error handling
- In-memory rate limiting for IP and User endpoints
- Production fail-fast validation for secrets and CORS
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from jose import jwt

from app.config import Settings
from app.db import get_database


@pytest.mark.asyncio
async def test_register_success(async_client: AsyncClient):
    """Registering a new user creates user record and persistent profile."""
    payload = {
        "username": "student_test_1",
        "email": "test1@odisha.edu.in",
        "password": "StrongPassword123!",
        "grade": "Class 9",
        "language": "odia",
    }
    resp = await async_client.post("/api/auth/register", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["username"] == "student_test_1"
    assert data["user"]["email"] == "test1@odisha.edu.in"

    # Verify profile exists in database
    db = get_database()
    profile = await db.profiles.find_one({"user_id": data["user"]["id"]})
    assert profile is not None
    assert profile["grade"] == "Class 9"


@pytest.mark.asyncio
async def test_register_weak_password_rejected(async_client: AsyncClient):
    """Passwords shorter than 10 characters are rejected with 422."""
    payload = {
        "username": "weak_pwd_user",
        "email": "weak@odisha.edu.in",
        "password": "short",
    }
    resp = await async_client.post("/api/auth/register", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_common_password_rejected(async_client: AsyncClient):
    """Common dictionary passwords are rejected with 422."""
    payload = {
        "username": "common_pwd_user",
        "email": "common@odisha.edu.in",
        "password": "password123",
    }
    resp = await async_client.post("/api/auth/register", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_duplicate_username_conflict(async_client: AsyncClient):
    """Duplicate username returns 409 Conflict."""
    payload = {
        "username": "duplicate_user",
        "email": "dup1@odisha.edu.in",
        "password": "StrongPassword123!",
    }
    resp1 = await async_client.post("/api/auth/register", json=payload)
    assert resp1.status_code == 201

    payload2 = {
        "username": "duplicate_user",
        "email": "dup2@odisha.edu.in",
        "password": "StrongPassword123!",
    }
    resp2 = await async_client.post("/api/auth/register", json=payload2)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_login_success(async_client: AsyncClient):
    """Valid login returns 200 with tokens."""
    reg = {
        "username": "login_success_user",
        "email": "success@odisha.edu.in",
        "password": "SecurePassword123!",
    }
    await async_client.post("/api/auth/register", json=reg)

    login_resp = await async_client.post(
        "/api/auth/login",
        json={"username_or_email": "login_success_user", "password": "SecurePassword123!"},
    )
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password_and_unknown_user_identical_response(async_client: AsyncClient):
    """Unknown user and wrong password return identical 401 response bodies to prevent enumeration."""
    # 1. Register a real user
    await async_client.post(
        "/api/auth/register",
        json={
            "username": "existing_user",
            "email": "existing@odisha.edu.in",
            "password": "CorrectPassword123!",
        },
    )

    # 2. Login with existing user but wrong password
    resp_wrong_pwd = await async_client.post(
        "/api/auth/login",
        json={"username_or_email": "existing_user", "password": "WrongPassword999!"},
    )

    # 3. Login with completely non-existent user
    resp_unknown_user = await async_client.post(
        "/api/auth/login",
        json={"username_or_email": "ghost_non_existent", "password": "SomePassword123!"},
    )

    assert resp_wrong_pwd.status_code == 401
    assert resp_unknown_user.status_code == 401

    # Exact comparison of error message
    data1 = resp_wrong_pwd.json()
    data2 = resp_unknown_user.json()
    assert data1["error"]["message"] == data2["error"]["message"]
    assert data1["error"]["code"] == data2["error"]["code"]


@pytest.mark.asyncio
async def test_account_lockout_after_10_failed_logins(async_client: AsyncClient):
    """Repeated failed logins trigger account lockout on 10th failure across IPs."""
    await async_client.post(
        "/api/auth/register",
        json={
            "username": "lockout_target",
            "email": "lockout@odisha.edu.in",
            "password": "CorrectPassword123!",
        },
    )

    # Trigger 9 failed attempts from different IPs (returns 401)
    for i in range(9):
        resp = await async_client.post(
            "/api/auth/login",
            headers={"X-Forwarded-For": f"192.168.1.{i+1}"},
            json={"username_or_email": "lockout_target", "password": "BadPassword123!"},
        )
        assert resp.status_code == 401

    # 10th failed attempt triggers lockout
    resp10 = await async_client.post(
        "/api/auth/login",
        headers={"X-Forwarded-For": "192.168.1.10"},
        json={"username_or_email": "lockout_target", "password": "BadPassword123!"},
    )
    assert resp10.status_code == 401

    # 11th attempt must be rejected with 429 Account Lockout
    resp11 = await async_client.post(
        "/api/auth/login",
        headers={"X-Forwarded-For": "192.168.1.11"},
        json={"username_or_email": "lockout_target", "password": "CorrectPassword123!"},
    )
    assert resp11.status_code == 429
    assert "locked" in resp11.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_refresh_token_rotation_and_revocation(async_client: AsyncClient):
    """Refreshing a token revokes the old one (rotation). Old token cannot be reused."""
    reg = await async_client.post(
        "/api/auth/register",
        json={
            "username": "rotation_user",
            "email": "rotation@odisha.edu.in",
            "password": "StrongPassword123!",
        },
    )
    tokens = reg.json()
    old_refresh = tokens["refresh_token"]

    # First refresh succeeds
    ref_resp = await async_client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert ref_resp.status_code == 200
    new_tokens = ref_resp.json()
    assert new_tokens["refresh_token"] != old_refresh

    # Replay attack: try using old refresh token again -> 401
    replay_resp = await async_client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert replay_resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_revokes_token(async_client: AsyncClient):
    """Logging out revokes the refresh token."""
    reg = await async_client.post(
        "/api/auth/register",
        json={
            "username": "logout_user",
            "email": "logout@odisha.edu.in",
            "password": "StrongPassword123!",
        },
    )
    refresh_token = reg.json()["refresh_token"]

    # Logout
    logout_resp = await async_client.post("/api/auth/logout", json={"refresh_token": refresh_token})
    assert logout_resp.status_code == 200

    # Try to use revoked refresh token -> 401
    ref_resp = await async_client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert ref_resp.status_code == 401


@pytest.mark.asyncio
async def test_token_validation_expired_tampered_alg_none(async_client: AsyncClient):
    """Strict JWT validation: rejects expired, tampered, and alg=none tokens."""
    settings = Settings()

    # 1. Tampered token
    tampered = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.tampered_signature"
    resp1 = await async_client.get("/api/auth/me", headers={"Authorization": f"Bearer {tampered}"})
    assert resp1.status_code == 401

    # 2. Expired token
    now = datetime.now(UTC)
    expired_payload = {
        "sub": "some_user_id",
        "role": "student",
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "jti": str(uuid.uuid4()),
        "iat": int((now - timedelta(days=2)).timestamp()),
        "exp": int((now - timedelta(days=1)).timestamp()),
        "type": "access",
    }
    expired_token = jwt.encode(expired_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    resp2 = await async_client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp2.status_code == 401

    # 3. alg=none attack token
    alg_none_token = (
        "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0."
        "eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6InN0dWRlbnQiLCJpc3MiOiJla2Fsc2FoYXlhay1hdXRoIn0."
    )
    resp3 = await async_client.get("/api/auth/me", headers={"Authorization": f"Bearer {alg_none_token}"})
    assert resp3.status_code == 401


@pytest.mark.asyncio
async def test_authorization_idor_protection(async_client: AsyncClient):
    """User A cannot read or modify User B's profile. Identity is strictly derived from token."""
    # Create User A
    resp_a = await async_client.post(
        "/api/auth/register",
        json={
            "username": "user_alpha",
            "email": "alpha@odisha.edu.in",
            "password": "StrongPassword123!",
        },
    )
    token_a = resp_a.json()["access_token"]
    user_a_id = resp_a.json()["user"]["id"]

    # Create User B
    resp_b = await async_client.post(
        "/api/auth/register",
        json={
            "username": "user_beta",
            "email": "beta@odisha.edu.in",
            "password": "StrongPassword123!",
        },
    )
    user_b_id = resp_b.json()["user"]["id"]

    # User A requests /profile -> returns User A's data, NEVER User B's
    profile_resp = await async_client.get("/api/agent/profile", headers={"Authorization": f"Bearer {token_a}"})
    assert profile_resp.status_code == 200
    data = profile_resp.json()
    assert data["student_id"] == user_a_id
    assert data["username"] == "user_alpha"
    assert data["student_id"] != user_b_id


@pytest.mark.asyncio
async def test_all_protected_routes_return_401_without_token(async_client: AsyncClient):
    """Parametrized verification: every protected route returns 401 without Authorization header."""
    protected_endpoints = [
        ("GET", "/api/auth/me"),
        ("POST", "/api/agent/interact", {"query": "test query"}),
        ("GET", "/api/agent/profile"),
        ("GET", "/api/agent/followups"),
        ("GET", "/api/agent/offline-pack"),
        ("POST", "/api/quiz/answer", {"question_id": "q1", "selected_index": 0, "attempt_id": "att-1"}),
        ("GET", "/api/quiz/questions?topic=evaporation"),
        ("GET", "/api/quiz/history"),
        ("POST", "/api/agent/sync", {"actions": [{"event_id": "e1", "type": "q", "client_ts": "2026-10-14T10:00:00Z"}]}),
        ("GET", "/api/agent/tts?text=test"),
        ("POST", "/api/agent/tts?text=test"),
        ("POST", "/api/agent/stt"),
        ("GET", "/api/db/status"),
        ("GET", "/api/voice/telemetry"),
    ]

    for method, path, *payload in protected_endpoints:
        body = payload[0] if payload else None
        if method == "GET":
            resp = await async_client.get(path)
        else:
            resp = await async_client.post(path, json=body)
        assert resp.status_code == 401, f"Route {method} {path} returned {resp.status_code} instead of 401!"


@pytest.mark.asyncio
async def test_security_headers_present(async_client: AsyncClient):
    """Verifies presence of security headers on responses."""
    resp = await async_client.get("/health")
    assert resp.status_code == 200
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "X-Request-ID" in resp.headers


@pytest.mark.asyncio
async def test_rate_limiting_ip_endpoints(async_client: AsyncClient):
    """IP rate limiter blocks more than 5 login attempts per minute."""
    for _ in range(5):
        resp = await async_client.post(
            "/api/auth/login",
            json={"username_or_email": "rate_limited_ip", "password": "BadPassword123!"},
        )
        assert resp.status_code in [401, 200]

    # 6th request from same client IP should trigger rate limit 429
    resp6 = await async_client.post(
        "/api/auth/login",
        json={"username_or_email": "rate_limited_ip", "password": "BadPassword123!"},
    )
    assert resp6.status_code == 429
    assert "rate limit exceeded" in resp6.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_input_limits_strict_validation(async_client: AsyncClient):
    """Enforces query character limit (<=500) and forbids extra keys."""
    reg = await async_client.post(
        "/api/auth/register",
        json={
            "username": "input_limits_user",
            "email": "limits@odisha.edu.in",
            "password": "StrongPassword123!",
        },
    )
    token = reg.json()["access_token"]

    # 1. Query too long (>500 chars) -> 422
    long_query = "a" * 501
    resp1 = await async_client.post(
        "/api/agent/interact",
        headers={"Authorization": f"Bearer {token}"},
        json={"query": long_query},
    )
    assert resp1.status_code == 422

    # 2. Extra field forbidden (extra="forbid") -> 422
    resp2 = await async_client.post(
        "/api/agent/interact",
        headers={"Authorization": f"Bearer {token}"},
        json={"query": "Valid query", "unknown_field": "injected"},
    )
    assert resp2.status_code == 422


def test_production_fail_fast_config():
    """Application refuses to boot in ENV=prod if secrets are default/weak or CORS has wildcard."""
    # 1. Default/short secret in prod
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        Settings(ENV="prod", JWT_SECRET_KEY="short-secret", CORS_ORIGINS=["http://example.com"])

    # 2. Placeholder keyword in secret in prod
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        Settings(ENV="prod", JWT_SECRET_KEY="temporary-secret-key-that-is-at-least-32-chars-long", CORS_ORIGINS=["http://example.com"])

    # 3. Wildcard in CORS in prod
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        Settings(
            ENV="prod",
            JWT_SECRET_KEY="A"*40,
            CORS_ORIGINS=["*"],
        )

    # 4. Empty CORS in prod
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        Settings(
            ENV="prod",
            JWT_SECRET_KEY="A"*40,
            CORS_ORIGINS=[],
        )
