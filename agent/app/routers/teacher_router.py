"""Teacher Class Orchestrator Router for Multi-Grade Classrooms."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from app.security import get_current_user
from app.services.teacher_service import get_teacher_service

logger = logging.getLogger("ekalsahayak.routers.teacher")

router = APIRouter(prefix="/api/teacher", tags=["Teacher Multi-Grade Orchestrator"])


class CreateClassroomRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    grades: list[str] = Field(default_factory=lambda: ["Class 9", "Class 8"])


class EnrollStudentRequest(BaseModel):
    invite_code: str = Field(..., min_length=4, max_length=20)


class PlanPeriodRequest(BaseModel):
    classroom_id: str
    duration_minutes: int = Field(default=40, ge=20, le=90)
    subject: str = Field(default="Science")


@router.post("/classroom", status_code=status.HTTP_201_CREATED)
async def create_classroom(
    req: CreateClassroomRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Creates a new classroom with a unique enrollment invite code."""
    teacher_svc = get_teacher_service()
    return await teacher_svc.create_classroom(
        teacher_id=current_user["id"],
        name=req.name,
        grades=req.grades,
    )


@router.get("/classrooms")
async def list_classrooms(current_user: dict[str, Any] = Depends(get_current_user)):
    """Lists all classrooms created by the authenticated teacher."""
    teacher_svc = get_teacher_service()
    return await teacher_svc.list_teacher_classrooms(teacher_id=current_user["id"])


@router.post("/enroll")
async def enroll_student(
    req: EnrollStudentRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Enrolls current student into classroom using invite code."""
    teacher_svc = get_teacher_service()
    return await teacher_svc.enroll_student_by_code(
        invite_code=req.invite_code,
        student_id=current_user["id"],
    )


@router.get("/dashboard/{classroom_id}")
async def get_classroom_dashboard(
    classroom_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Returns real aggregate stats (mastery, time-on-task, stuck concepts, misconceptions)."""
    teacher_svc = get_teacher_service()
    return await teacher_svc.get_classroom_dashboard(
        classroom_id=classroom_id,
        teacher_id=current_user["id"],
    )


@router.post("/plan-period")
async def plan_period(
    req: PlanPeriodRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Orchestrates simultaneous parallel tasks for multi-grade composite classrooms."""
    teacher_svc = get_teacher_service()
    return await teacher_svc.plan_period(
        classroom_id=req.classroom_id,
        teacher_id=current_user["id"],
        duration_minutes=req.duration_minutes,
        target_subject=req.subject,
    )


@router.get("/period-plan/print", response_class=HTMLResponse)
async def print_period_plan(
    classroom_id: str = Query(...),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Renders printable one-page lesson plan for offline multi-grade teaching."""
    teacher_svc = get_teacher_service()
    plan = await teacher_svc.plan_period(
        classroom_id=classroom_id,
        teacher_id=current_user["id"],
    )

    group_a = plan["group_a"]
    group_b = plan["group_b"]
    teacher_phase = plan["teacher_orchestration"]

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>One-Page Period Plan - {plan['classroom_name']}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; }}
    h1 {{ margin: 0 0 4px; color: #155c53; font-size: 22px; }}
    .meta {{ font-size: 13px; color: #64748b; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }}
    .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 20px; }}
    .box {{ border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; background: #f8fafc; }}
    .box h2 {{ margin: 0 0 8px; font-size: 15px; color: #0f766e; }}
    .citation {{ font-size: 11px; color: #94a3b8; font-style: italic; margin-bottom: 8px; }}
    ul {{ margin: 0; padding-left: 20px; font-size: 13px; }}
    li {{ margin-bottom: 4px; }}
    .teacher-box {{ border: 2px solid #0f766e; border-radius: 10px; padding: 14px; background: #f0fdfa; }}
    .teacher-box h2 {{ margin: 0 0 6px; font-size: 16px; color: #115e59; }}
    @media print {{ body {{ padding: 0; }} }}
  </style>
</head>
<body>
  <h1>EkalSahayak • Multi-Grade Period Orchestration Plan</h1>
  <div class="meta">
    <b>Classroom:</b> {plan['classroom_name']} &nbsp;|&nbsp;
    <b>Duration:</b> {plan['period_duration_minutes']} Minutes &nbsp;|&nbsp;
    <b>Subject:</b> {plan['subject']} &nbsp;|&nbsp;
    <b>Generated:</b> {plan['generated_at'][:10]}
  </div>

  <div class="grid">
    <div class="box">
      <h2>{group_a['grade_group']}</h2>
      <div class="citation">Citation: {group_a['citation']}</div>
      <p style="font-size: 13px; margin: 4px 0 8px;"><b>Activity:</b> {group_a['activity_type']} — <i>{group_a['concept']}</i></p>
      <ul>
        {"".join(f"<li>{item}</li>" for item in group_a['instructions'])}
      </ul>
      <p style="font-size: 12px; margin-top: 10px; color: #047857;"><b>Deliverable:</b> {group_a['expected_output']}</p>
    </div>

    <div class="box">
      <h2>{group_b['grade_group']}</h2>
      <div class="citation">Citation: {group_b['citation']}</div>
      <p style="font-size: 13px; margin: 4px 0 8px;"><b>Activity:</b> {group_b['activity_type']} — <i>{group_b['concept']}</i></p>
      <ul>
        {"".join(f"<li>{item}</li>" for item in group_b['instructions'])}
      </ul>
      <p style="font-size: 12px; margin-top: 10px; color: #047857;"><b>Deliverable:</b> {group_b['expected_output']}</p>
    </div>
  </div>

  <div class="teacher-box">
    <h2>{teacher_phase['phase_name']} ({teacher_phase['time_allocation_minutes']} Min)</h2>
    <div class="citation">Citation: {teacher_phase['citation']}</div>
    <p style="font-size: 13px; margin: 4px 0 8px;"><b>Addressing Misconception:</b> {teacher_phase['focus_misconception']}</p>
    <ul>
      {"".join(f"<li>{step}</li>" for step in teacher_phase['teacher_script'])}
    </ul>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html)
