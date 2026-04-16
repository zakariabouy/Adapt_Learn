"""
Orientation Router — Generate, review, and retrieve orientation reports.

Endpoints:
  POST /orientation/generate/{student_id}  — Teacher triggers report generation
  GET  /orientation/report/{student_id}    — Get latest approved report (student/parent)
  GET  /orientation/report/{student_id}/latest — Get latest report regardless of status (teacher)
  POST /orientation/report/{report_id}/approve — Teacher approves report
  POST /orientation/report/{report_id}/reject  — Teacher rejects with notes
"""

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from shared.database import get_pool
from routers.auth import get_current_user
from agents.orientation.agent import generate_orientation_report

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orientation", tags=["Orientation"])


class ReviewRequest(BaseModel):
    notes: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Generate
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/generate/{student_id}")
async def trigger_orientation_report(
    student_id: UUID, current_user=Depends(get_current_user)
):
    """Teacher generates an orientation report for a student."""
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can generate orientation reports")

    pool = await get_pool()

    student = await pool.fetchrow(
        "SELECT id, name FROM users WHERE id = $1 AND role = 'student'", student_id
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    link = await pool.fetchrow(
        "SELECT 1 FROM teacher_student_link WHERE teacher_id = $1 AND student_id = $2",
        current_user["id"], student_id,
    )
    if not link:
        raise HTTPException(status_code=403, detail="Student not linked to this teacher")

    try:
        report = await generate_orientation_report(student_id)
    except Exception as e:
        import traceback
        logger.error("Orientation report generation failed: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Report generation failed: {e}")

    input_context = report.pop("_input_context", None)

    report_id = await pool.fetchval(
        """
        INSERT INTO orientation_reports (student_id, report_data, input_context, status)
        VALUES ($1, $2::jsonb, $3::jsonb, 'pending')
        RETURNING id
        """,
        student_id,
        json.dumps(report, default=str),
        json.dumps(input_context, default=str) if input_context else None,
    )

    return {
        "id": str(report_id),
        "status": "pending",
        "report": report,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Retrieve
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/report/{student_id}")
async def get_approved_report(student_id: UUID, current_user=Depends(get_current_user)):
    """
    Get the latest approved orientation report for a student.
    Accessible by: the student themselves, their parent, or their teacher.
    """
    pool = await get_pool()

    is_self = str(current_user["id"]) == str(student_id)
    is_teacher = current_user["role"] == "teacher"
    is_parent = current_user["role"] == "parent"

    if not is_self and not is_teacher and not is_parent:
        raise HTTPException(status_code=403, detail="Access denied")

    if is_parent:
        parent_link = await pool.fetchrow(
            "SELECT 1 FROM parent_child_link WHERE parent_id = $1 AND child_id = $2",
            current_user["id"], student_id,
        )
        if not parent_link:
            raise HTTPException(status_code=403, detail="Not your child")

    row = await pool.fetchrow(
        """
        SELECT id, report_data, status, teacher_notes, created_at
        FROM orientation_reports
        WHERE student_id = $1 AND status = 'approved'
        ORDER BY created_at DESC LIMIT 1
        """,
        student_id,
    )

    if not row:
        raise HTTPException(status_code=404, detail="No approved orientation report found")

    report_data = row["report_data"]
    if isinstance(report_data, str):
        report_data = json.loads(report_data)

    return {
        "id": str(row["id"]),
        "report": report_data,
        "teacher_notes": row["teacher_notes"],
        "status": row["status"],
        "created_at": row["created_at"].isoformat(),
    }


@router.get("/report/{student_id}/latest")
async def get_latest_report(student_id: UUID, current_user=Depends(get_current_user)):
    """Get the most recent report regardless of status. Teacher only."""
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")

    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, report_data, input_context, status, teacher_notes, created_at
        FROM orientation_reports
        WHERE student_id = $1
        ORDER BY created_at DESC LIMIT 1
        """,
        student_id,
    )

    if not row:
        raise HTTPException(status_code=404, detail="No orientation report found")

    report_data = row["report_data"]
    if isinstance(report_data, str):
        report_data = json.loads(report_data)

    input_context = row["input_context"]
    if isinstance(input_context, str):
        input_context = json.loads(input_context)

    return {
        "id": str(row["id"]),
        "report": report_data,
        "input_context": input_context,
        "status": row["status"],
        "teacher_notes": row["teacher_notes"],
        "created_at": row["created_at"].isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Teacher Review (HITL)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/report/{report_id}/approve")
async def approve_report(
    report_id: UUID,
    body: ReviewRequest,
    current_user=Depends(get_current_user),
):
    """Teacher approves an orientation report, making it visible to student and parent."""
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")

    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id, status FROM orientation_reports WHERE id = $1", report_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")

    await pool.execute(
        """
        UPDATE orientation_reports
        SET status = 'approved', teacher_notes = $2, reviewed_by = $3, reviewed_at = NOW()
        WHERE id = $1
        """,
        report_id, body.notes, current_user["id"],
    )

    return {"status": "approved", "id": str(report_id)}


@router.post("/report/{report_id}/reject")
async def reject_report(
    report_id: UUID,
    body: ReviewRequest,
    current_user=Depends(get_current_user),
):
    """Teacher rejects an orientation report with notes."""
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")

    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id FROM orientation_reports WHERE id = $1", report_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")

    await pool.execute(
        """
        UPDATE orientation_reports
        SET status = 'rejected', teacher_notes = $2, reviewed_by = $3, reviewed_at = NOW()
        WHERE id = $1
        """,
        report_id, body.notes, current_user["id"],
    )

    return {"status": "rejected", "id": str(report_id)}
