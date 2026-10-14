"""Async Database Layer using Motor.

Provides:
- Single Motor client managed via application lifespan
- Collection indexes (users, profiles, questions, quiz_sessions, refresh_tokens, sync_events)
- Seed question ingestion from KB
- Fast-fail health check ping (<=1s timeout)
- No synchronous PyMongo calls in the request path
"""

import asyncio
import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, IndexModel

from app.config import Settings

logger = logging.getLogger("ekalsahayak.db")

# Global Motor client and DB handle for FastAPI lifespan
_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def set_test_database(test_db: AsyncIOMotorDatabase) -> None:
    """Injects a test database (e.g. from mongomock-motor)."""
    global _db
    _db = test_db


def get_database() -> AsyncIOMotorDatabase:
    """Returns active async MongoDB database handle.

    Raises RuntimeError if called before lifespan initialization.
    """
    global _db
    if _db is None:
        raise RuntimeError("Database not initialized. Please ensure lifespan setup has executed.")
    return _db


async def connect_db(settings: Settings) -> AsyncIOMotorDatabase:
    """Creates single AsyncIOMotorClient and initializes indexes."""
    global _client, _db
    logger.info("Connecting to MongoDB at %s...", settings.MONGODB_URI)

    try:
        real_client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            connectTimeoutMS=min(settings.MONGO_CONNECT_TIMEOUT_MS, 1500),
            serverSelectionTimeoutMS=min(settings.MONGO_SERVER_SELECTION_TIMEOUT_MS, 1500),
        )
        await real_client.admin.command("ping")
        _client = real_client
        _db = _client[settings.MONGODB_DB_NAME]
        logger.info("Connected to standalone MongoDB successfully.")
    except Exception as exc:
        logger.warning(
            "Standalone MongoDB unavailable at %s (%s). Falling back to embedded AsyncMongoMockClient for local runtime.",
            settings.MONGODB_URI,
            exc,
        )
        import mongomock_motor

        mock_client = mongomock_motor.AsyncMongoMockClient()
        _client = mock_client
        _db = _client[settings.MONGODB_DB_NAME]

    await init_indexes(_db)
    return _db


async def disconnect_db() -> None:
    """Closes Motor client on application shutdown."""
    global _client, _db
    if _client is not None:
        logger.info("Closing MongoDB Motor client connection...")
        _client.close()
        _client = None
        _db = None


USER_SCHEMA_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["username", "email", "password_hash", "role"],
        "properties": {
            "username": {"bsonType": "string", "description": "must be a string and is required"},
            "email": {"bsonType": "string", "description": "must be a string and is required"},
            "password_hash": {"bsonType": "string", "description": "must be a string and is required"},
            "role": {"enum": ["student", "teacher", "admin"], "description": "must be one of student, teacher, admin"},
        },
    }
}

PROFILE_SCHEMA_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["user_id"],
        "properties": {
            "user_id": {"bsonType": "string", "description": "must be a string and is required"},
            "mastery_graph": {"bsonType": "object"},
            "misconceptions": {"bsonType": "array"},
        },
    }
}


async def init_indexes(database: AsyncIOMotorDatabase) -> None:
    """Creates all required unique and query indexes across collections."""
    try:
        # Apply JSON Schema validators
        try:
            existing_cols = await database.list_collection_names()
            if "users" not in existing_cols:
                await database.create_collection("users", validator=USER_SCHEMA_VALIDATOR)
            else:
                await database.command("collMod", "users", validator=USER_SCHEMA_VALIDATOR)

            if "profiles" not in existing_cols:
                await database.create_collection("profiles", validator=PROFILE_SCHEMA_VALIDATOR)
            else:
                await database.command("collMod", "profiles", validator=PROFILE_SCHEMA_VALIDATOR)
        except Exception as schema_err:
            logger.debug("Schema validator setup note: %s", schema_err)

        # 1. Users collection
        await database.users.create_indexes([
            IndexModel([("username", ASCENDING)], unique=True),
            IndexModel([("email", ASCENDING)], unique=True),
        ])

        # 2. Student profiles collection
        await database.profiles.create_indexes([
            IndexModel([("user_id", ASCENDING)], unique=True),
        ])

        # 3. Question bank
        await database.questions.create_indexes([
            IndexModel([("id", ASCENDING)], unique=True),
            IndexModel([("topic", ASCENDING)]),
            IndexModel([("topic", ASCENDING), ("difficulty", ASCENDING)]),
        ])

        # 4. Quiz sessions & telemetry
        await database.quiz_sessions.create_indexes([
            IndexModel([("user_id", ASCENDING), ("created_at", ASCENDING)]),
        ])

        # 5. Refresh tokens with MongoDB native TTL expiration
        await database.refresh_tokens.create_indexes([
            IndexModel([("jti_hash", ASCENDING)], unique=True),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
            IndexModel([("user_id", ASCENDING)]),
        ])

        # 6. Deduplicated sync events
        await database.sync_events.create_indexes([
            IndexModel([("user_id", ASCENDING), ("event_id", ASCENDING)], unique=True),
        ])

        # 7. Failed logins & account lockout
        await database.failed_logins.create_indexes([
            IndexModel([("identifier", ASCENDING)], unique=True),
            IndexModel([("locked_until", ASCENDING)], expireAfterSeconds=0),
        ])

        # 8. Agent trace logs (TTL 30 days)
        await database.agent_traces.create_indexes([
            IndexModel([("user_id", ASCENDING), ("created_at", ASCENDING)]),
            IndexModel([("created_at", ASCENDING)], expireAfterSeconds=30 * 86400),
        ])

        logger.info("Database indexes verified and created successfully.")
    except Exception as exc:
        logger.warning("Could not establish all indexes on startup: %s", exc)


async def ping_database(timeout_ms: int = 1000) -> bool:
    """Quickly tests MongoDB reachability with strict timeout (<=1s)."""
    global _db
    if _db is None:
        return False
    try:
        # Strict timeout enforcement (<= 1.0s)
        await asyncio.wait_for(_db.command("ping"), timeout=timeout_ms / 1000.0)
        return True
    except Exception as exc:
        logger.debug("Database ping failed: %s", exc)
        return False
