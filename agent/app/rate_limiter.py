"""In-memory rate limiting behind an abstract interface.

Supports:
- IP-based rate limiting for public endpoints (login, register: 5/min/IP)
- User-based rate limiting for authenticated endpoints (interact: 20/min/user, voice: 10/min/user)
- Deterministic testing and state resetting
"""

import time
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status


class AbstractRateLimiter(ABC):
    """Abstract interface for rate limiting backend."""

    @abstractmethod
    def is_allowed(self, key: str, max_requests: int, window_seconds: int = 60) -> bool:
        """Returns True if the request within the window is permitted, False otherwise."""

    @abstractmethod
    def reset(self) -> None:
        """Clears all stored rate limit history."""


class InMemoryRateLimiter(AbstractRateLimiter):
    """In-memory sliding window rate limiter."""

    def __init__(self):
        self._records: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int = 60) -> bool:
        now = time.monotonic()
        cutoff = now - window_seconds
        # Evict records older than window
        valid_records = [t for t in self._records[key] if t > cutoff]
        if len(valid_records) >= max_requests:
            self._records[key] = valid_records
            return False
        valid_records.append(now)
        self._records[key] = valid_records
        return True

    def reset(self) -> None:
        self._records.clear()


# Global rate limiter instance
rate_limiter = InMemoryRateLimiter()


def get_rate_limiter() -> AbstractRateLimiter:
    return rate_limiter


def get_client_ip(request: Request) -> str:
    """Extracts client IP address considering proxy headers."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"


def rate_limit_ip(max_requests: int, window_seconds: int = 60, action: str = "default") -> Callable:
    """FastAPI dependency for per-IP rate limiting."""

    async def dependency(request: Request) -> None:
        ip = get_client_ip(request)
        key = f"ip:{ip}:{action}"
        if not rate_limiter.is_allowed(key, max_requests, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: {max_requests} requests per {window_seconds}s limit reached.",
                headers={"Retry-After": str(window_seconds)},
            )

    return dependency


def rate_limit_user(max_requests: int, window_seconds: int = 60, action: str = "default") -> Callable:
    """FastAPI dependency for per-user rate limiting (requires authentication)."""
    from app.security import get_current_user

    async def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        user_id = current_user.get("id", "unknown")
        key = f"user:{user_id}:{action}"
        if not rate_limiter.is_allowed(key, max_requests, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: {max_requests} requests per {window_seconds}s limit reached.",
                headers={"Retry-After": str(window_seconds)},
            )
        return current_user

    return dependency
