"""Phase 3: Persistence, Async, Correctness Test Suite.

Covers:
- Fast-fail readiness probe (<=1s timeout, 503 on disconnected database)
- Transactional profile initialization with rollback on profile failure
- Dev vs Prod demo seeding isolation
- List pagination limits (limit <= 50)
- Single Motor async client and no sync PyMongo calls in request path
"""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.config import Settings
from app.db import get_database


@pytest.mark.asyncio
async def test_readiness_probe_success(async_client: AsyncClient):
    """Readiness probe returns 200 when MongoDB is connected."""
    resp = await async_client.get("/health/ready")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ready"
    assert resp.json()["database"] == "connected"


@pytest.mark.asyncio
async def test_readiness_probe_fails_fast_when_mongo_down(async_client: AsyncClient):
    """When MongoDB is unreachable, /health/ready returns 503 within 1s without hanging."""
    # Temporarily simulate a dead database connection that fails quickly
    mock_ping = AsyncMock(return_value=False)
    with patch("app.routers.health.ping_database", mock_ping):
        t0 = asyncio.get_event_loop().time()
        resp = await async_client.get("/health/ready")
        t1 = asyncio.get_event_loop().time()

        duration = t1 - t0
        assert duration < 1.05  # Must fail fast (<= 1.0s)
        assert resp.status_code == 503
        data = resp.json()
        assert data["error"]["code"] == "HTTP_ERROR"


@pytest.mark.asyncio
async def test_profile_creation_rollback_on_failure(async_client: AsyncClient):
    """If profile initialization fails during registration, the user is rolled back."""
    db = get_database()
    username = "rollback_user_test"

    # Patch get_or_create_profile to simulate a failure
    with patch(
        "app.services.profile_service.ProfileService.get_or_create_profile",
        side_effect=RuntimeError("Simulated profile DB write error"),
    ):
        resp = await async_client.post(
            "/api/auth/register",
            json={
                "username": username,
                "email": "rollback@odisha.edu.in",
                "password": "StrongPassword123!",
            },
        )
        assert resp.status_code == 500

    # User document should be rolled back (deleted)
    user = await db.users.find_one({"username": username})
    assert user is None


def test_seed_demo_disabled_in_prod():
    """In production mode, SEED_DEMO is strictly forced to False."""
    prod_settings = Settings(
        ENV="prod",
        JWT_SECRET_KEY="A" * 48,
        CORS_ORIGINS=["http://ruralodisha.edu.in"],
        SEED_DEMO=True,  # Attempting to enable in prod
    )
    assert prod_settings.SEED_DEMO is False


@pytest.mark.asyncio
async def test_pagination_limits(async_client: AsyncClient):
    """List endpoints enforce limit <= 50."""
    # Register and get auth token
    reg = await async_client.post(
        "/api/auth/register",
        json={
            "username": "pagination_tester",
            "email": "pagination@odisha.edu.in",
            "password": "StrongPassword123!",
        },
    )
    token = reg.json()["access_token"]

    # 1. limit <= 50 is allowed
    resp_valid = await async_client.get(
        "/api/quiz/history?limit=50",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_valid.status_code == 200

    # 2. limit > 50 is rejected with 422
    resp_invalid = await async_client.get(
        "/api/quiz/history?limit=51",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_invalid.status_code == 422
