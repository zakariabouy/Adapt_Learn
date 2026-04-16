"""
Feedback Router — Student ratings on courses/teachers, parent issue reporting.
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from shared.database import get_pool
from shared.models import StudentFeedbackRequest, ParentIssueRequest
from routers.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/feedback", tags=["Feedback"])


# ─────────────────────────────────────────────────────────────────────────────
# Student Feedback (after sessions)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/student")
async def submit_student_feedback(
    request: StudentFeedbackRequest,
    current_user=Depends(get_current_user),
):
    """Student rates course content and/or teacher after a session."""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can submit feedback")

    pool = await get_pool()

    # Resolve teacher_id from content if available
    teacher_id = None
    if request.content_id:
        content_row = await pool.fetchrow(
            "SELECT teacher_id FROM content_items WHERE id = $1", UUID(request.content_id)
        )
        if content_row:
            teacher_id = content_row["teacher_id"]

    session_id = UUID(request.session_id) if request.session_id else None
    content_id = UUID(request.content_id) if request.content_id else None

    row = await pool.fetchrow(
        """INSERT INTO student_feedback
               (student_id, session_id, content_id, teacher_id,
                content_rating, teacher_rating, difficulty_feedback, comment)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id""",
        current_user["id"], session_id, content_id, teacher_id,
        request.content_rating, request.teacher_rating,
        request.difficulty_feedback, request.comment,
    )

    # Notify teacher if they were rated
    if teacher_id and request.teacher_rating:
        await pool.execute(
            """INSERT INTO notifications (user_id, notification_type, title, body, data)
               VALUES ($1, 'feedback_received', 'New Student Feedback',
                       $2, $3)""",
            teacher_id,
            f"A student rated your content {request.content_rating or '-'}/5",
            f'{{"feedback_id": "{row["id"]}"}}',
        )

    return {"id": str(row["id"]), "status": "feedback_submitted"}


@router.get("/student/history")
async def get_student_feedback_history(current_user=Depends(get_current_user)):
    """Student views their own feedback history."""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Students only")

    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT sf.*, ci.title as content_title
           FROM student_feedback sf
           LEFT JOIN content_items ci ON sf.content_id = ci.id
           WHERE sf.student_id = $1
           ORDER BY sf.created_at DESC LIMIT 20""",
        current_user["id"],
    )
    return [
        {
            "id": str(r["id"]),
            "content_title": r["content_title"],
            "content_rating": r["content_rating"],
            "teacher_rating": r["teacher_rating"],
            "difficulty_feedback": r["difficulty_feedback"],
            "comment": r["comment"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Teacher View of Feedback
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/teacher/received")
async def get_teacher_feedback(
    content_id: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    """Teacher views feedback they've received."""
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only")

    pool = await get_pool()
    query = """
        SELECT sf.*, ci.title as content_title, u.name as student_name
        FROM student_feedback sf
        LEFT JOIN content_items ci ON sf.content_id = ci.id
        LEFT JOIN users u ON sf.student_id = u.id
        WHERE sf.teacher_id = $1
    """
    params = [current_user["id"]]

    if content_id:
        query += " AND sf.content_id = $2"
        params.append(UUID(content_id))

    query += " ORDER BY sf.created_at DESC LIMIT 50"

    rows = await pool.fetch(query, *params)

    # Compute aggregates
    total = len(rows)
    avg_content = sum(r["content_rating"] for r in rows if r["content_rating"]) / max(sum(1 for r in rows if r["content_rating"]), 1)
    avg_teacher = sum(r["teacher_rating"] for r in rows if r["teacher_rating"]) / max(sum(1 for r in rows if r["teacher_rating"]), 1)

    return {
        "total_feedback": total,
        "avg_content_rating": round(avg_content, 1),
        "avg_teacher_rating": round(avg_teacher, 1),
        "feedback": [
            {
                "id": str(r["id"]),
                "student_name": r["student_name"],
                "content_title": r["content_title"],
                "content_rating": r["content_rating"],
                "teacher_rating": r["teacher_rating"],
                "difficulty_feedback": r["difficulty_feedback"],
                "comment": r["comment"],
                "created_at": r["created_at"].isoformat(),
            }
            for r in rows
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Parent Issues (visible to teacher/admin)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/issues")
async def list_issues_for_teacher(
    status: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    """Teacher/admin views parent issues about their students."""
    if current_user["role"] not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teacher or admin access required")

    pool = await get_pool()

    if current_user["role"] == "admin":
        query = "SELECT pi.*, u.name as child_name, pu.name as parent_name FROM parent_issues pi JOIN users u ON pi.child_id = u.id JOIN users pu ON pi.parent_id = pu.id"
        params = []
    else:
        query = """
            SELECT pi.*, u.name as child_name, pu.name as parent_name
            FROM parent_issues pi
            JOIN users u ON pi.child_id = u.id
            JOIN users pu ON pi.parent_id = pu.id
            JOIN teacher_student_link tsl ON pi.child_id = tsl.student_id
            WHERE tsl.teacher_id = $1
        """
        params = [current_user["id"]]

    if status:
        idx = len(params) + 1
        query += f" {'AND' if params else 'WHERE'} pi.status = ${idx}"
        params.append(status)

    query += " ORDER BY pi.created_at DESC LIMIT 50"

    rows = await pool.fetch(query, *params)
    return [
        {
            "id": str(r["id"]),
            "parent_name": r["parent_name"],
            "child_name": r["child_name"],
            "issue_type": r["issue_type"],
            "title": r["title"],
            "description": r["description"],
            "status": r["status"],
            "response": r["response"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@router.post("/issues/{issue_id}/respond")
async def respond_to_issue(
    issue_id: UUID,
    response_text: str = Query(..., min_length=5),
    current_user=Depends(get_current_user),
):
    """Teacher/admin responds to a parent issue."""
    if current_user["role"] not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teacher or admin access required")

    pool = await get_pool()
    row = await pool.fetchrow(
        """UPDATE parent_issues
           SET response = $1, responded_by = $2, status = 'resolved', resolved_at = NOW()
           WHERE id = $3
           RETURNING parent_id""",
        response_text, current_user["id"], issue_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Notify parent
    await pool.execute(
        """INSERT INTO notifications (user_id, notification_type, title, body, data)
           VALUES ($1, 'feedback_received', 'Your issue has been resolved', $2, $3)""",
        row["parent_id"],
        response_text[:200],
        f'{{"issue_id": "{issue_id}"}}',
    )

    return {"status": "resolved"}
