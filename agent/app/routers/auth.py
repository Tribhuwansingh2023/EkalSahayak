"""Authentication Router with Rate Limiting, Account Lockout, and Token Rotation."""

import logging
from datetime import UTC, datetime, timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import Settings, get_settings
from app.db import get_database
from app.models.auth import (
    AuthResponse,
    NumeralSystem,
    RefreshTokenRequest,
    SupportedLanguage,
    UserLoginRequest,
    UserPreferences,
    UserPreferencesUpdate,
    UserPublic,
    UserRegisterRequest,
    UserRole,
)
from app.rate_limiter import rate_limit_ip
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    hash_token_jti,
    verify_dummy_password,
    verify_password,
)
from app.services.profile_service import get_profile_service

logger = logging.getLogger("ekalsahayak.auth")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


async def check_account_lockout(identifier: str, db, settings: Settings) -> None:
    """Verifies whether identifier (email/username) is currently locked out."""
    rec = await db.failed_logins.find_one({"identifier": identifier})
    if rec and rec.get("locked_until"):
        locked_until = rec["locked_until"]
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=UTC)
        now = datetime.now(UTC)
        if now < locked_until:
            wait_minutes = max(1, int((locked_until - now).total_seconds() / 60))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account temporarily locked due to multiple failed login attempts. Try again in {wait_minutes} minutes.",
            )


async def register_failed_login(identifier: str, db, settings: Settings) -> None:
    """Records a failed login attempt and locks account if threshold exceeded."""
    now = datetime.now(UTC)
    rec = await db.failed_logins.find_one({"identifier": identifier})
    count = (rec.get("count", 0) + 1) if rec else 1

    locked_until = None
    if count >= settings.MAX_FAILED_LOGINS:
        locked_until = now + timedelta(minutes=settings.LOCKOUT_MINUTES)
        logger.warning("Account %s locked out until %s after %d failed attempts", identifier, locked_until, count)

    await db.failed_logins.update_one(
        {"identifier": identifier},
        {"$set": {"count": count, "last_attempt": now, "locked_until": locked_until}},
        upsert=True,
    )


async def clear_failed_logins(identifier: str, db) -> None:
    """Clears failed login counter upon successful authentication."""
    await db.failed_logins.delete_one({"identifier": identifier})


def build_user_public(user: dict) -> UserPublic:
    """Constructs UserPublic response with validated preferences."""
    raw_pref = user.get("preferences", {})
    if not isinstance(raw_pref, dict) or not raw_pref:
        lang_str = str(user.get("language", "en")).strip()
        try:
            lang_enum = SupportedLanguage(lang_str)
        except ValueError:
            lang_enum = SupportedLanguage.OR if lang_str.lower() in ("odia", "or") else SupportedLanguage.EN
        raw_pref = {
            "language": lang_enum.value,
            "numerals": NumeralSystem.LATIN.value,
            "ai_same_language": True,
            "keep_english_terms": True,
        }

    return UserPublic(
        id=str(user.get("id") or user.get("_id")),
        username=user["username"],
        email=user["email"],
        name=user.get("name") or user.get("username"),
        role=UserRole(user.get("role", "student")),
        grade=f"Class {user.get('grade')}" if isinstance(user.get("grade"), int) else str(user.get("grade", "Class 9")),
        language=user.get("language", "odia"),
        preferences=UserPreferences(**raw_pref),
        created_at=user.get("created_at", datetime.now(UTC)),
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    req: UserRegisterRequest,
    settings: Settings = Depends(get_settings),
    _rl: None = Depends(rate_limit_ip(5, 60, "register")),
):
    """Registers a new user account and creates persistent student profile."""
    db = get_database()

    # Check unique username and email
    existing_user = await db.users.find_one({
        "$or": [{"username": req.username}, {"email": req.email}],
    })
    if existing_user:
        if existing_user.get("username") == req.username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this username already exists.",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    now = datetime.now(UTC)
    pwd_hash = hash_password(req.password)

    pref_lang = SupportedLanguage.OR if req.language.lower() in ("odia", "or") else SupportedLanguage.EN
    user_doc = {
        "username": req.username,
        "email": req.email,
        "name": req.name or req.username,
        "password_hash": pwd_hash,
        "grade": req.grade,
        "language": req.language,
        "role": req.role.value,
        "preferences": {
            "language": pref_lang.value,
            "numerals": NumeralSystem.LATIN.value,
            "ai_same_language": True,
            "keep_english_terms": True,
        },
        "created_at": now,
        "updated_at": now,
    }

    insert_result = await db.users.insert_one(user_doc)
    user_id = str(insert_result.inserted_id)

    # Initialize persistent profile
    try:
        profile_svc = get_profile_service()
        await profile_svc.get_or_create_profile(user_id=user_id, default_grade=req.grade)
    except Exception as exc:
        # Roll back user if profile creation fails
        await db.users.delete_one({"_id": insert_result.inserted_id})
        logger.error("Failed creating profile for %s, rolled back user: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed initializing student profile. Registration was aborted.",
        ) from exc

    # Generate tokens
    access_token = create_access_token(user_id, req.role.value, settings)
    refresh_token = create_refresh_token(user_id, settings)

    # Store hashed refresh token JTI in Mongo
    rf_payload = decode_token(refresh_token, expected_type="refresh", settings=settings)
    jti_hash = hash_token_jti(rf_payload["jti"])
    exp_dt = datetime.fromtimestamp(rf_payload["exp"], tz=UTC)

    await db.refresh_tokens.insert_one({
        "user_id": user_id,
        "jti_hash": jti_hash,
        "expires_at": exp_dt,
        "revoked": False,
        "created_at": now,
    })

    user_doc["_id"] = insert_result.inserted_id
    user_public = build_user_public(user_doc)

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_public,
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    req: UserLoginRequest,
    settings: Settings = Depends(get_settings),
    _rl: None = Depends(rate_limit_ip(5, 60, "login")),
):
    """Authenticates user with username or email, issuing access and refresh tokens.

    Implements timing-attack equalization and account lockout.
    """
    db = get_database()
    identifier = req.username_or_email

    # Check lockout
    await check_account_lockout(identifier, db, settings)

    # Query by username or email (case-insensitive safe)
    user = await db.users.find_one({
        "$or": [{"username": identifier}, {"email": identifier}],
    })

    if not user:
        # Timing defense: run dummy bcrypt compare so timing is identical
        verify_dummy_password()
        await register_failed_login(identifier, db, settings)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(req.password, user.get("password_hash", "")):
        await register_failed_login(identifier, db, settings)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Authentication succeeded: clear failed logins
    await clear_failed_logins(identifier, db)

    user_id = str(user["_id"])
    role_str = user.get("role", "student")

    access_token = create_access_token(user_id, role_str, settings)
    refresh_token = create_refresh_token(user_id, settings)

    # Record refresh token
    rf_payload = decode_token(refresh_token, expected_type="refresh", settings=settings)
    jti_hash = hash_token_jti(rf_payload["jti"])
    exp_dt = datetime.fromtimestamp(rf_payload["exp"], tz=UTC)

    await db.refresh_tokens.insert_one({
        "user_id": user_id,
        "jti_hash": jti_hash,
        "expires_at": exp_dt,
        "revoked": False,
        "created_at": datetime.now(UTC),
    })

    user_public = build_user_public(user)

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_public,
    )


@router.post("/refresh", response_model=AuthResponse)
async def refresh_tokens(req: RefreshTokenRequest, settings: Settings = Depends(get_settings)):
    """Rotates refresh token and issues fresh access token."""
    db = get_database()
    payload = decode_token(req.refresh_token, expected_type="refresh", settings=settings)

    raw_user_id = payload.get("sub")
    raw_jti = payload.get("jti")
    if not isinstance(raw_user_id, str) or not isinstance(raw_jti, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token claims.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id: str = raw_user_id
    jti: str = raw_jti
    jti_hash = hash_token_jti(jti)

    # Check token in database
    token_record = await db.refresh_tokens.find_one({"jti_hash": jti_hash})
    if not token_record or token_record.get("revoked"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked or is invalid.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Revoke old refresh token (Token Rotation)
    await db.refresh_tokens.update_one({"jti_hash": jti_hash}, {"$set": {"revoked": True}})

    user_oid = ObjectId(user_id)
    user = await db.users.find_one({"_id": user_oid})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
        )

    role_str = user.get("role", "student")
    new_access = create_access_token(user_id, role_str, settings)
    new_refresh = create_refresh_token(user_id, settings)

    # Save new refresh token
    new_rf_payload = decode_token(new_refresh, expected_type="refresh", settings=settings)
    new_jti_hash = hash_token_jti(new_rf_payload["jti"])
    exp_dt = datetime.fromtimestamp(new_rf_payload["exp"], tz=UTC)

    await db.refresh_tokens.insert_one({
        "user_id": user_id,
        "jti_hash": new_jti_hash,
        "expires_at": exp_dt,
        "revoked": False,
        "created_at": datetime.now(UTC),
    })

    user_public = build_user_public(user)

    return AuthResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        user=user_public,
    )


@router.post("/logout")
async def logout(req: RefreshTokenRequest, settings: Settings = Depends(get_settings)):
    """Revokes the refresh token upon user logout."""
    db = get_database()
    try:
        payload = decode_token(req.refresh_token, expected_type="refresh", settings=settings)
        jti_hash = hash_token_jti(payload.get("jti", ""))
        await db.refresh_tokens.update_one({"jti_hash": jti_hash}, {"$set": {"revoked": True}})
    except Exception:
        pass
    return {"message": "Successfully logged out and session revoked."}


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Returns the authenticated user's profile identity including preferences."""
    return build_user_public(current_user)


@router.patch("/me/preferences", response_model=UserPreferences)
async def update_preferences(
    req: UserPreferencesUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Updates the user's interface, numerals, and AI language preferences."""
    db = get_database()
    updates: dict = {}

    if req.language is not None:
        updates["preferences.language"] = req.language.value
        updates["language"] = req.language.value
    if req.numerals is not None:
        updates["preferences.numerals"] = req.numerals.value
    if req.ai_same_language is not None:
        updates["preferences.ai_same_language"] = req.ai_same_language
    if req.keep_english_terms is not None:
        updates["preferences.keep_english_terms"] = req.keep_english_terms

    if updates:
        updates["updated_at"] = datetime.now(UTC)
        await db.users.update_one({"_id": ObjectId(current_user["id"])}, {"$set": updates})

    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    pref_data = (user or {}).get("preferences", {})
    return UserPreferences(**pref_data)


@router.post("/guest", response_model=AuthResponse)
async def guest_login(settings: Settings = Depends(get_settings)):
    """Provides an instant, friction-free session for students & learners."""
    db = get_database()
    guest_username = "ekalsahay_learner"
    user = await db.users.find_one({"username": guest_username})
    if not user:
        doc = {
            "username": guest_username,
            "email": "learner@ekalsahay.org",
            "password_hash": hash_password("EkalSahay2025!"),
            "role": "student",
            "name": "EkalSahay Learner",
            "grade": "Class 9",
            "medium": "English",
            "home_dialect": "English / Vernacular",
            "preferences": {
                "language": "en",
                "numerals": "latin",
                "ai_same_language": True,
                "keep_english_terms": True,
            },
            "created_at": datetime.now(UTC),
        }
        res = await db.users.insert_one(doc)
        user = await db.users.find_one({"_id": res.inserted_id})
        profile_svc = get_profile_service()
        await profile_svc.get_or_create_profile(user_id=str(user["_id"]), default_grade="Class 9")

    user_id = str(user["_id"])
    access_token = create_access_token(user_id=user_id, role=user["role"], settings=settings)
    refresh_token = create_refresh_token(user_id=user_id, settings=settings)

    # Store hashed refresh token
    try:
        ref_payload = decode_token(refresh_token, expected_type="refresh", settings=settings)
        jti_hash = hash_token_jti(ref_payload.get("jti", ""))
        await db.refresh_tokens.insert_one({
            "jti_hash": jti_hash,
            "user_id": user_id,
            "revoked": False,
            "created_at": datetime.now(UTC),
        })
    except Exception as e:
        logger.warning("Could not persist guest refresh token jti: %s", e)

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=build_user_public(user),
    )

