"""Authentication & User Schemas."""

import re
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

COMMON_PASSWORDS = {
    "password123",
    "password1234",
    "1234567890",
    "123456789",
    "qwertyuiop",
    "qwerty1234",
    "letmein1234",
    "admin12345",
    "lakshya1234",
    "ekalsahayak123",
}

USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_\-\.]{3,32}$")


class UserRole(StrEnum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class SupportedLanguage(StrEnum):
    EN = "en"
    HI = "hi"
    OR = "or"
    BN = "bn"
    MR = "mr"
    GU = "gu"
    TA = "ta"
    TE = "te"
    KN = "kn"
    ML = "ml"
    PA = "pa"
    UR = "ur"
    AS = "as"
    BRX = "brx"
    DOI = "doi"
    KS = "ks"
    KOK = "kok"
    MAI = "mai"
    MNI = "mni"
    NE = "ne"
    SA = "sa"
    SAT = "sat"
    SD = "sd"
    BHO = "bho"
    TCY = "tcy"
    KXU = "kxu"
    RAJ = "raj"
    HNE = "hne"
    MAG = "mag"
    HI_LATN = "hi-Latn"


class NumeralSystem(StrEnum):
    LATIN = "latin"
    LOCAL = "local"


class UserPreferences(BaseModel):
    """User UI & Interaction preferences."""

    model_config = ConfigDict(extra="forbid")

    language: SupportedLanguage = Field(default=SupportedLanguage.EN, description="Selected app language")
    numerals: NumeralSystem = Field(default=NumeralSystem.LATIN, description="Numeral digit system (0-9 vs local digits)")
    ai_same_language: bool = Field(default=True, description="Whether AI answers in same language as the app")
    keep_english_terms: bool = Field(default=True, description="Whether to preserve English terms in brackets")


class UserPreferencesUpdate(BaseModel):
    """Payload to patch user preferences."""

    model_config = ConfigDict(extra="forbid")

    language: SupportedLanguage | None = None
    numerals: NumeralSystem | None = None
    ai_same_language: bool | None = None
    keep_english_terms: bool | None = None


class UserRegisterRequest(BaseModel):
    """Schema for student/user registration."""

    model_config = ConfigDict(extra="ignore")

    username: str = Field(..., min_length=3, max_length=32, description="Unique username")
    email: EmailStr = Field(..., description="Valid user email address")
    password: str = Field(..., min_length=6, max_length=128, description="Password (min 6 characters)")
    grade: Any = Field(default="Class 9")
    language: str = Field(default="odia", max_length=16)
    role: UserRole = Field(default=UserRole.STUDENT)
    name: str | None = Field(default=None, max_length=64)
    medium: str | None = Field(default=None, max_length=32)
    home_dialect: str | None = Field(default=None, max_length=64)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        clean = v.strip().lower()
        if not USERNAME_REGEX.match(clean):
            raise ValueError("Username must be 3-32 characters and contain only letters, numbers, _, -, .")
        return clean

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if v.lower() in COMMON_PASSWORDS:
            raise ValueError("Password is too common and easily guessable. Please choose a stronger password.")
        if len(v.strip()) < 6:
            raise ValueError("Password must be at least 6 characters long.")
        return v

    @field_validator("grade", mode="before")
    @classmethod
    def normalize_grade(cls, v: Any) -> str:
        if isinstance(v, int):
            return f"Grade {v}"
        return str(v) if v else "Class 9"


class UserLoginRequest(BaseModel):
    """Schema for user authentication."""

    model_config = ConfigDict(extra="ignore")

    username_or_email: str = Field(..., min_length=3, max_length=128)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("username_or_email")
    @classmethod
    def normalize_login_id(cls, v: str) -> str:
        return v.strip().lower()


class RefreshTokenRequest(BaseModel):
    """Schema for rotating access tokens."""

    model_config = ConfigDict(extra="ignore")

    refresh_token: str = Field(..., min_length=16, description="Cryptographic refresh token")


class UserPublic(BaseModel):
    """Public user identity returned to clients."""

    id: str
    username: str
    email: str
    role: UserRole
    grade: str
    language: str
    name: str | None = None
    preferences: UserPreferences = Field(default_factory=UserPreferences)
    created_at: datetime


class AuthResponse(BaseModel):
    """Successful authentication response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserPublic
