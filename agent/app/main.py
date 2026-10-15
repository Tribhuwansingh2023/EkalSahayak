"""Main FastAPI Application Entrypoint.

Configures:
- Application factory create_app()
- Lifespan context manager for single Motor async client and KB initialization
- Security headers and Request ID middleware
- CORS with explicit origins
- Global exception handlers returning structured error envelopes (never leaking str(e))
- SlowAPI rate limiting
- Metrics instrumentation
"""

import logging
import time
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import Settings, get_settings
from app.db import connect_db, disconnect_db, get_database
from app.rag.curriculum_builder import get_all_concepts
from app.routers import (
    agent_router,
    auth_router,
    health_router,
    kb_router,
    multiagent_router,
    offline_quiz_router,
    pilot_router,
    quiz_router,
    study_router,
    sync_router,
    teacher_router,
    voice_router,
    ws_quiz_router,
)
from app.security import hash_password, require_admin
from app.services.kb_service import get_kb_service
from app.services.profile_service import get_profile_service

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
)
logger = logging.getLogger("ekalsahayak.main")

# Global Limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])


async def seed_demo_data_if_enabled(settings: Settings) -> None:
    """Seeds the question bank and optional demo student in dev mode."""
    db = get_database()
    kb = get_kb_service()

    # 1. Seed Question Bank from verified KB
    questions = kb.get_all_seed_questions()
    for q in questions:
        await db.questions.update_one({"id": q["id"]}, {"$set": q}, upsert=True)
    logger.info("Ingested %d questions from curriculum KB into MongoDB.", len(questions))

    # 2. Ingest NCERT Class 9 Curriculum Concepts
    concepts = get_all_concepts()
    for c in concepts:
        await db.curriculum.update_one({"concept_id": c.concept_id}, {"$set": c.to_dict()}, upsert=True)
    logger.info("Ingested %d NCERT curriculum concept nodes into MongoDB.", len(concepts))

    # 2. Seed Demo User in Dev if requested
    if settings.ENV == "dev" and settings.SEED_DEMO:
        demo_user = await db.users.find_one({"username": "lakshya_class9"})
        if not demo_user:
            demo_doc = {
                "username": "lakshya_class9",
                "email": "lakshya@ruralodisha.edu.in",
                "password_hash": hash_password("Lakshya@Class9!"),
                "grade": "Class 9",
                "language": "odia",
                "role": "student",
            }
            res = await db.users.insert_one(demo_doc)
            user_id = str(res.inserted_id)

            profile_svc = get_profile_service()
            await profile_svc.get_or_create_profile(user_id=user_id, default_grade="Class 9")
            logger.info("Demo user 'lakshya_class9' seeded successfully in dev mode.")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for database connection and KB validation."""
    settings = get_settings()

    # 1. Load and validate curriculum KB
    kb = get_kb_service()
    kb.load_kb()

    # 2. Connect to MongoDB and build indexes
    try:
        await connect_db(settings)
        await seed_demo_data_if_enabled(settings)
    except Exception as exc:
        logger.warning("MongoDB connect warning on startup (will retry on requests): %s", exc)

    logger.info("EkalSahayak application started successfully in %s mode.", settings.ENV)
    yield

    # Shutdown
    await disconnect_db()
    logger.info("EkalSahayak application shutdown complete.")


def create_app() -> FastAPI:
    """Application factory building FastAPI app with all routes and middleware."""
    settings = get_settings()

    app = FastAPI(
        title="EkalSahayak (Lakshya AI) - Deterministic Pedagogical Agent Engine",
        description="Production-grade, vernacular-first agentic EdTech engine for Class 9 & 10 rural learners in Odisha.",
        version="2.1.0",
        lifespan=lifespan,
    )

    # Attach Rate Limiter
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

    # 1. Request ID, Access Logging & Security Headers Middleware
    @app.middleware("http")
    async def security_and_request_id_middleware(request: Request, call_next):
        req_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = req_id
        start_time = time.perf_counter()

        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Structured Access Log (No PII / tokens / passwords logged)
        logger.info(
            '{"event":"http_access","method":"%s","path":"%s","status_code":%d,"duration_ms":%.2f,"request_id":"%s"}',
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            req_id,
        )

        # Attach X-Request-ID
        response.headers["X-Request-ID"] = req_id

        # Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=(self)"
        if settings.ENV == "prod":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response

    # 2. CORS Middleware with Explicit Origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID", "Origin"],
    )

    # 3. Trusted Host Middleware in Production
    if settings.ENV == "prod":
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

    # 4. Global Exception Handlers (Never leak str(e) on 500s)
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        detail = exc.detail
        code = "HTTP_ERROR"
        if isinstance(detail, dict):
            code = detail.get("code", code)
            detail = detail.get("message", str(detail))

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": code,
                    "message": detail,
                    "request_id": req_id,
                }
            },
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        details = []
        for err in exc.errors():
            d = dict(err)
            if "ctx" in d and isinstance(d["ctx"], dict):
                d["ctx"] = {k: str(v) for k, v in d["ctx"].items()}
            details.append(d)

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed.",
                    "details": details,
                    "request_id": req_id,
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        logger.error("Unhandled internal server exception [req_id=%s]: %s", req_id, exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An internal server error occurred. Please contact support with the request ID.",
                    "request_id": req_id,
                }
            },
        )

    # 5. Prometheus Instrumentation (Admin restricted)
    Instrumentator().instrument(app).expose(app, endpoint="/metrics", dependencies=[Depends(require_admin)])

    # 6. Register Routers
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(agent_router)
    app.include_router(kb_router)
    app.include_router(multiagent_router)
    app.include_router(offline_quiz_router)
    app.include_router(quiz_router)
    app.include_router(study_router)
    app.include_router(teacher_router)
    app.include_router(pilot_router)
    app.include_router(voice_router)
    app.include_router(sync_router)
    app.include_router(ws_quiz_router)

    # Root Route
    @app.get("/", tags=["Status"])
    async def root_index():
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "system": "EkalSahayak (Lakshya AI) Local Hub",
                "portal": "Teacher Dashboard",
                "status": "operational",
                "version": "2.1.0",
                "grade": "Multi-Grade Odia NCERT Pedagogical Curriculum",
                "frontend_app_url": "http://localhost:5173",
                "student_portal_url": "/student",
                "evaluation_history_url": "/history",
                "published_quizzes_api": "/api/quizzes",
                "results_api": "/api/results",
                "api_documentation": "/docs",
                "health_check": "/health",
                "message": "EkalSahayak Local Hub is operational.",
            },
        )

    # Student Portal Root
    @app.get("/student", tags=["Status"])
    async def student_section_index():
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "portal": "Student Section",
                "status": "active",
                "system": "EkalSahayak Student Learning Hub",
                "published_quizzes_url": "/api/quizzes",
                "results_url": "/api/results",
                "frontend_sync_url": "http://localhost:5173/sync-offline",
                "message": "Welcome to EkalSahayak Student Assessment Section.",
            },
        )

    # Evaluation History Root
    @app.get("/history", tags=["Status"])
    async def evaluation_history_index():
        from app.routers.offline_quiz_router import get_submitted_results
        results_data = await get_submitted_results()
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "portal": "Evaluation History",
                "status": "active",
                "total_records": len(results_data),
                "results": results_data,
                "message": "Retrieved evaluation history records.",
            },
        )

    return app


# Root Application Instance
app = create_app()
