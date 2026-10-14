"""Agent Interaction Router.

Handles:
- Full LangGraph deterministic execution with token-derived student identity
- Student mastery profile and spaced repetition follow-up retrieval
- Downloadable offline curriculum bundle
- Admin-only trace audit telemetry
"""

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.agent.graph import lakshya_agent_graph
from app.db import get_database
from app.models.agent import AgentTraceItem, InteractRequest, InteractResponse, ReflectFailureRequest
from app.rate_limiter import rate_limit_user
from app.security import get_current_user, require_admin
from app.services.kb_service import get_kb_service
from app.services.profile_service import get_profile_service

logger = logging.getLogger("ekalsahayak.routers.agent")

router = APIRouter(prefix="/api/agent", tags=["Agent Workflow"])


@router.post("/interact", response_model=InteractResponse)
async def interact(
    req: InteractRequest,
    current_user: dict[str, Any] = Depends(rate_limit_user(20, 60, "interact")),
):
    """Executes the deterministic LangGraph pedagogical loop for authenticated student."""
    user_id = current_user["id"]
    request_id = str(uuid.uuid4())

    initial_state = {
        "user_id": user_id,
        "request_id": request_id,
        "query": req.query,
        "language": req.language.value,
        "input_type": req.input_type.value,
        "is_offline": req.is_offline,
        "detected_topic": "",
        "topic_confidence": 0.0,
        "curriculum_concept": None,
        "student_profile": {},
        "prerequisite_missing": False,
        "prerequisite_topic": None,
        "misconception_diagnosed": None,
        "vernacular_analogy": None,
        "micro_quiz": None,
        "updated_mastery": None,
        "final_response_odia": "",
        "final_audio_script": "",
        "next_followup_plan": "",
        "traces": [],
        "current_node": "",
        "llm_used": False,
        "model_name": None,
        "is_clarification": False,
        "rag_result": None,
        "provenance": None,
        "citation": None,
        "is_not_found": False,
        "retrieved_chunks": None,
        "groundedness_score": None,
    }

    # Execute LangGraph asynchronously
    try:
        result = await lakshya_agent_graph.ainvoke(initial_state)
    except Exception as exc:
        logger.error("Error executing agent graph for user %s: %s", user_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Pedagogical engine encountered an internal execution error.",
        ) from exc

    raw_traces = result.get("traces", [])
    parsed_traces: list[AgentTraceItem] = []
    for t in raw_traces:
        parsed_traces.append(
            AgentTraceItem(
                step_name=t.get("step_name", ""),
                node=t.get("node", ""),
                agent=t.get("agent", "Orchestrator"),
                tool_called=t.get("tool_called", ""),
                tool_args=t.get("tool_args", {}),
                tool_output=t.get("tool_output"),
                pedagogical_intent=t.get("pedagogical_intent", ""),
                duration_ms=t.get("duration_ms"),
                critic_verdict=t.get("critic_verdict"),
                retrieved_chunk_ids=t.get("retrieved_chunk_ids"),
            )
        )

    return InteractResponse(
        detected_topic=result.get("detected_topic", "unknown"),
        misconception_diagnosed=result.get("misconception_diagnosed"),
        prerequisite_missing=result.get("prerequisite_missing", False),
        prerequisite_topic=result.get("prerequisite_topic"),
        vernacular_analogy=result.get("vernacular_analogy"),
        micro_quiz=result.get("micro_quiz"),
        updated_mastery=result.get("updated_mastery"),
        final_response_odia=result.get("final_response_odia", ""),
        final_audio_script=result.get("final_audio_script", ""),
        next_followup_plan=result.get("next_followup_plan", ""),
        traces=parsed_traces,
        llm_used=result.get("llm_used", False),
        model_name=result.get("model_name"),
        request_id=request_id,
        language_served=result.get("language_served", "or"),
        machine_translated=result.get("machine_translated", False),
        provenance=result.get("provenance"),
        citation=result.get("citation"),
        is_not_found=result.get("is_not_found", False),
        retrieved_chunks=result.get("retrieved_chunks"),
        groundedness_score=result.get("groundedness_score"),
    )


@router.get("/profile")
async def get_profile(current_user: dict[str, Any] = Depends(get_current_user)):
    """Returns the authenticated student's persistent learning profile & mastery map."""
    profile_svc = get_profile_service()
    profile = await profile_svc.get_or_create_profile(current_user["id"])
    return {
        "student_id": current_user["id"],
        "username": current_user["username"],
        "grade": profile.get("grade", "Class 9"),
        "language": profile.get("language", "odia"),
        "mastery_graph": profile.get("mastery_graph", {}),
        "retention_scores": profile.get("retention_scores", {}),
        "misconceptions": profile.get("misconceptions", []),
        "scheduled_followups": profile.get("scheduled_followups", []),
    }


@router.get("/followups")
async def get_followups(current_user: dict[str, Any] = Depends(get_current_user)):
    """Returns spaced repetition review items due as of the current timestamp."""
    profile_svc = get_profile_service()
    due_items = await profile_svc.get_due_followups(current_user["id"])
    return {"due_followups": due_items}


@router.get("/offline-pack")
async def get_offline_pack(current_user: dict[str, Any] = Depends(get_current_user)):
    """Downloads compact (<80 KB) serialized curriculum bundle for offline edge execution."""
    kb = get_kb_service()
    concepts = kb.get_all_concepts()

    pack = {
        "manifest_version": "2.1.0",
        "curriculum": "BSE Odisha Class 9 Science",
        "language": "odia",
        "generated_for": current_user["username"],
        "units": {k: v.model_dump() for k, v in concepts.items()},
    }
    return pack


@router.get("/traces")
async def get_trace_audit_logs(
    limit: int = Query(default=20, ge=1, le=50),
    admin_user: dict[str, Any] = Depends(require_admin),
):
    """Admin-only endpoint for inspecting historical LangGraph execution telemetry."""
    db = get_database()
    cursor = db.agent_traces.find({}).sort("created_at", -1).limit(limit)
    traces = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        traces.append(doc)
    return {"total": len(traces), "traces": traces}


@router.post("/quiz-submit")
async def submit_quiz_alias(
    req: dict[str, Any],
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Server-authoritative quiz answer submission alias. Strictly ignores/forbids client answers."""
    from app.models.quiz import QuizAnswerRequest
    from app.services.quiz_service import get_quiz_service

    # Ensure forbidden fields like correct_option_index or client student_id are not accepted
    valid_req = QuizAnswerRequest(
        question_id=req.get("question_id", ""),
        selected_index=int(req.get("selected_index", req.get("selected_option_index", 0))),
        attempt_id=req.get("attempt_id") or str(uuid.uuid4()),
        time_taken_ms=int(req.get("time_taken_ms", 0)),
    )
    quiz_svc = get_quiz_service()
    res = await quiz_svc.evaluate_answer(current_user["id"], valid_req)
    return {
        "is_correct": res.correct,
        "correct_index": res.correct_index,
        "new_mastery": res.new_mastery,
        "feedback_odia": res.explanation_odia,
        "score_awarded": res.score_awarded,
    }


@router.post("/reflect-failure")
async def reflect_failure(
    req: ReflectFailureRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Antigravity Failure Recovery Loop: Diagnoses misconception/gap and produces remedial fix."""
    from app.ml.pedagogical_model import get_class9_agentic_model

    model = get_class9_agentic_model()
    return model.reflect_and_fix(
        concept_key=req.topic,
        student_answer_index=req.selected_index,
        question_id=req.question_id,
        student_confusion_query=req.student_query,
    )


