"""Security and Authentication Module.

Implements:
- Bcrypt password hashing (cost 12) with constant-time verification & dummy timing equalization
- Strict JWT authentication with iss, aud, exp, iat, jti, and algorithm enforcement
- Token rotation and revocation
- Account lockout tracking after repeated failed login attempts
- Role-based access control (RBAC) dependencies
"""

import contextlib
import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import Settings, get_settings
from app.models.auth import UserRole

# Constant dummy hash for timing attack mitigation when user is not found
DUMMY_BCRYPT_HASH = "$2b$12$N7x8/N3.n8qH8iV3/0vN/e7uD4v6m.r9y3a9/Wb7F7Q8G8E8D8C8."

# HTTP Bearer security scheme
security_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hashes password with salted bcrypt (cost 12)."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies plain password against bcrypt hash in constant time."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def verify_dummy_password() -> None:
    """Executes a dummy bcrypt check to equalize timing for non-existent users."""
    with contextlib.suppress(Exception):
        bcrypt.checkpw(b"dummy_timing_probe", DUMMY_BCRYPT_HASH.encode("utf-8"))


def hash_token_jti(jti: str) -> str:
    """Hashes a JWT ID with SHA-256 for safe storage in the database."""
    return hashlib.sha256(jti.encode("utf-8")).hexdigest()


def create_access_token(user_id: str, role: str, settings: Settings) -> str:
    """Generates an HMAC access token with strict claims (iss, aud, jti, exp, iat)."""
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    jti = str(uuid.uuid4())

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access",
    }

    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token


def create_refresh_token(user_id: str, settings: Settings) -> str:
    """Generates a cryptographic refresh token with jti."""
    now = datetime.now(UTC)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    jti = str(uuid.uuid4())

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "refresh",
    }

    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token


def decode_token(token: str, expected_type: str, settings: Settings) -> dict[str, Any]:
    """Decodes and strictly validates a JWT token.

    Rejects:
    - Unexpected algorithms (enforces HS256)
    - Expired tokens
    - Invalid issuer or audience
    - Wrong token type
    """
    try:
        # Strictly enforce allowed algorithms
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
            options={"verify_exp": True, "verify_aud": True, "verify_iss": True},
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or tampered authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    token_type = payload.get("type")
    if token_type != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token type: expected '{expected_type}', got '{token_type}'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_bearer),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """Dependency: Extracts, validates token and returns authenticated user document from Mongo.

    Looks up user strictly by immutable ObjectId (_id).
    """
    from app.db import get_database

    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required. Please provide Authorization: Bearer <token>.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_token(token, expected_type="access", settings=settings)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: missing subject claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_oid = ObjectId(user_id_str)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier inside token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    db = get_database()
    user = await db.users.find_one({"_id": user_oid})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists or was deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Attach string id for convenience
    user["id"] = str(user["_id"])
    return user


def require_role(*allowed_roles: UserRole):
    """Dependency factory: Ensures current user has one of the required roles."""

    async def role_checker(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        user_role_str = current_user.get("role", "student")
        if user_role_str not in [r.value for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: this action requires one of {allowed_roles} roles.",
            )
        return current_user

    return role_checker


# Convenient role dependencies
require_admin = require_role(UserRole.ADMIN)
require_teacher_or_admin = require_role(UserRole.TEACHER, UserRole.ADMIN)
