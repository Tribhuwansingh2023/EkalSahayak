"""Pytest test fixtures and configuration for EkalSahayak backend."""

import asyncio
from collections.abc import AsyncGenerator

import mongomock_motor
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from starlette.testclient import TestClient

from app.db import init_indexes, set_test_database
from app.main import create_app
from app.rate_limiter import get_rate_limiter
from app.services.kb_service import get_kb_service


@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Sets up a clean mongomock-motor database for every test."""
    # Reset in-memory rate limiter
    get_rate_limiter().reset()

    # Create fresh in-memory mock mongo client
    client = mongomock_motor.AsyncMongoMockClient()
    db = client["test_ekalsahayak_db"]
    set_test_database(db)

    # Initialize indexes and schema validators
    await init_indexes(db)

    # Ensure curriculum KB is loaded
    kb = get_kb_service()
    kb.load_kb()

    # Ingest questions into test db
    for q in kb.get_all_seed_questions():
        await db.questions.update_one({"id": q["id"]}, {"$set": q}, upsert=True)

    yield db

    # Teardown
    client.close()


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Provides an authenticated/unauthenticated async HTTP client."""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture
def sync_client() -> TestClient:
    """Provides a synchronous Starlette TestClient (useful for WebSocket testing)."""
    app = create_app()
    return TestClient(app)
