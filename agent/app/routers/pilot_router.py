"""Pilot Mode Evaluation & Live Judge Mode Router."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel, Field

from app.security import get_current_user
from app.services.pilot_service import get_pilot_service

logger = logging.getLogger("ekalsahayak.routers.pilot")

router = APIRouter(prefix="/api/pilot", tags=["Pilot Evaluation & Judge Mode"])


class PilotAnswerItem(BaseModel):
    question_id: str
    selected_index: int


class SubmitPilotTestRequest(BaseModel):
    participant_code: str = Field(..., min_length=4, max_length=64)
    answers: list[PilotAnswerItem]


@router.get("/init")
async def init_pilot_session():
    """Generates an anonymous participant token and consent details for empirical evaluation."""
    pilot_svc = get_pilot_service()
    code = pilot_svc.generate_participant_code()
    return {
        "participant_code": code,
        "study_name": "EkalSahayak NCERT Class 9 Empirical Learning Gain Study",
        "consent_notice": (
            "This study evaluates learning efficacy using randomized matched pre- and post-tests. "
            "All responses are anonymous and stored under a de-identified code for academic evaluation."
        ),
        "steps": [
            "1. Take the 5-question baseline Pre-Test",
            "2. Complete an interactive lesson with plain-language explanation and rural analogies",
            "3. Take the 5-question Post-Test to measure your retention delta",
        ],
    }


@router.get("/pre-test")
async def get_pre_test(participant_code: str = Query(...)):
    """Retrieves 5 baseline questions for the pre-test."""
    pilot_svc = get_pilot_service()
    return pilot_svc.get_pre_test(participant_code)


@router.post("/pre-test/submit")
async def submit_pre_test(req: SubmitPilotTestRequest):
    """Submits pre-test answers and records baseline score."""
    pilot_svc = get_pilot_service()
    answers = [{"question_id": a.question_id, "selected_index": a.selected_index} for a in req.answers]
    return await pilot_svc.submit_pre_test(participant_code=req.participant_code, answers=answers)


@router.get("/post-test")
async def get_post_test(participant_code: str = Query(...)):
    """Retrieves 5 matched questions for the post-test."""
    pilot_svc = get_pilot_service()
    return pilot_svc.get_post_test(participant_code)


@router.post("/post-test/submit")
async def submit_post_test(req: SubmitPilotTestRequest):
    """Submits post-test answers, records score, and computes retention delta."""
    pilot_svc = get_pilot_service()
    answers = [{"question_id": a.question_id, "selected_index": a.selected_index} for a in req.answers]
    return await pilot_svc.submit_post_test(participant_code=req.participant_code, answers=answers)


@router.get("/summary")
async def get_pilot_summary():
    """Returns real aggregate empirical gains across all completed participants."""
    pilot_svc = get_pilot_service()
    return await pilot_svc.get_pilot_summary()


@router.get("/export-csv")
async def export_pilot_csv():
    """Exports raw empirical trial data as CSV for validation by judges."""
    pilot_svc = get_pilot_service()
    csv_content = await pilot_svc.export_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ekalsahayak_pilot_eval_data.csv"},
    )


@router.get("/judge-mode")
async def get_judge_telemetry():
    """Returns live empirical system telemetry for judges (no decorative numbers)."""
    pilot_svc = get_pilot_service()
    return await pilot_svc.get_judge_telemetry()
