"""Human-in-the-Loop review endpoints for teachers.

Every high-risk AI artifact (exams, orientation reports, IEP reports) lands
in `pending_actions` before it becomes visible to students or parents. This
router is the teacher's review queue.
"""

import json
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from routers.teacher import get_current_teacher
from shared.database import get_pool
from shared.models import PendingActionStatus, PendingModifyRequest, PendingReviewRequest
from shared.pending import serialize_pending_row
from shared.guardrails import (
    run_output_guardrails,
    validate_exam_output,
    check_content_safety,
    log_guardrail_event,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/teacher/pending", tags=["HITL"])


async def _load_pending_for_teacher(pending_id: UUID, teacher_id):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM pending_actions WHERE id = $1 AND teacher_id = $2",
        pending_id,
        teacher_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Pending action not found")
    return row


@router.get("")
async def list_pending_actions(
    status: Optional[PendingActionStatus] = Query(default=None),
    action_type: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    current_teacher=Depends(get_current_teacher),
):
    """List pending actions for the current teacher, newest first."""
    pool = await get_pool()

    clauses = ["pa.teacher_id = $1"]
    params = [current_teacher["id"]]

    if status is not None:
        params.append(status.value)
        clauses.append(f"pa.status = ${len(params)}")

    if action_type:
        params.append(action_type)
        clauses.append(f"pa.action_type = ${len(params)}")

    params.append(limit)
    query = f"""
        SELECT pa.*, u.name AS student_name, u.email AS student_email,
               ci.title AS content_title
        FROM pending_actions pa
        LEFT JOIN users u ON pa.student_id = u.id
        LEFT JOIN content_items ci ON pa.content_id = ci.id
        WHERE {' AND '.join(clauses)}
        ORDER BY pa.created_at DESC
        LIMIT ${len(params)}
    """
    rows = await pool.fetch(query, *params)

    result = []
    for r in rows:
        item = serialize_pending_row(r)
        item["student_name"] = r["student_name"]
        item["student_email"] = r["student_email"]
        item["content_title"] = r["content_title"]
        result.append(item)
    return result


@router.get("/count")
async def pending_count(current_teacher=Depends(get_current_teacher)):
    """Returns how many actions are waiting for review (for dashboard badges)."""
    pool = await get_pool()
    n = await pool.fetchval(
        "SELECT COUNT(*) FROM pending_actions WHERE teacher_id = $1 AND status = 'pending'",
        current_teacher["id"],
    )
    return {"pending": n or 0}


@router.get("/{pending_id}")
async def get_pending_action(pending_id: UUID, current_teacher=Depends(get_current_teacher)):
    row = await _load_pending_for_teacher(pending_id, current_teacher["id"])
    return serialize_pending_row(row)


@router.post("/{pending_id}/approve")
async def approve_pending_action(
    pending_id: UUID,
    request: Optional[PendingReviewRequest] = None,
    current_teacher=Depends(get_current_teacher),
):
    row = await _load_pending_for_teacher(pending_id, current_teacher["id"])
    if row["status"] not in ("pending", "modified"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot approve action in status '{row['status']}'",
        )

    notes = request.reviewer_notes if request else None
    pool = await get_pool()
    updated = await pool.fetchrow(
        """
        UPDATE pending_actions
        SET status = 'approved',
            reviewer_notes = COALESCE($1, reviewer_notes),
            reviewed_at = NOW()
        WHERE id = $2
        RETURNING *
        """,
        notes,
        pending_id,
    )

    # ── Side-effects: deliver the approved artifact downstream ──
    await _deliver_approved_action(updated)

    return serialize_pending_row(updated)


@router.post("/{pending_id}/reject")
async def reject_pending_action(
    pending_id: UUID,
    request: PendingReviewRequest,
    current_teacher=Depends(get_current_teacher),
):
    row = await _load_pending_for_teacher(pending_id, current_teacher["id"])
    if row["status"] != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot reject action in status '{row['status']}'",
        )

    pool = await get_pool()
    updated = await pool.fetchrow(
        """
        UPDATE pending_actions
        SET status = 'rejected',
            reviewer_notes = $1,
            reviewed_at = NOW()
        WHERE id = $2
        RETURNING *
        """,
        request.reviewer_notes,
        pending_id,
    )
    return serialize_pending_row(updated)


@router.post("/{pending_id}/modify")
async def modify_pending_action(
    pending_id: UUID,
    request: PendingModifyRequest,
    current_teacher=Depends(get_current_teacher),
):
    """Teacher edits the AI output; original payload is preserved for audit."""
    row = await _load_pending_for_teacher(pending_id, current_teacher["id"])
    if row["status"] not in ("pending", "modified"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot modify action in status '{row['status']}'",
        )

    # ── Guardrail: validate the teacher's edits ──
    guardrail_warnings = []
    action_type = row["action_type"]
    new_payload = request.payload

    # 1. Content safety check on the full serialized payload
    payload_text = json.dumps(new_payload)
    output_check = await run_output_guardrails(
        payload_text,
        endpoint=f"/teacher/pending/{pending_id}/modify",
    )
    if not output_check["safe"]:
        # Critical content issues → block the edit
        await log_guardrail_event(
            event_type="content_safety",
            severity="critical",
            action_taken="blocked",
            user_id=current_teacher["id"],
            endpoint=f"/teacher/pending/{pending_id}/modify",
            output_snippet=payload_text[:500],
            details={"issues": output_check["issues"]},
        )
        raise HTTPException(
            status_code=400,
            detail="Your edits were flagged by content safety guardrails. "
                   "Please review and remove any inappropriate content.",
        )
    if output_check["issues"]:
        guardrail_warnings.extend(
            [f"{i['type']}: {i.get('severity', '')}" for i in output_check["issues"]]
        )

    # 2. Domain-specific validation for exam payloads
    if action_type == "exam_generation" and "exam" in new_payload:
        exam_validation = validate_exam_output(new_payload["exam"])
        if not exam_validation["valid"]:
            raise HTTPException(
                status_code=400,
                detail=f"Exam validation failed: {'; '.join(exam_validation['errors'])}",
            )
        if exam_validation.get("warnings"):
            guardrail_warnings.extend(exam_validation["warnings"])

    if guardrail_warnings:
        logger.info(
            "Modify guardrail warnings for %s: %s", pending_id, guardrail_warnings
        )

    # Keep the very first original payload so repeated edits don't overwrite it.
    original = row["original_payload"]
    if original is None:
        original = row["payload"]
    if isinstance(original, str):
        original_json = original
    else:
        original_json = json.dumps(original)

    pool = await get_pool()
    updated = await pool.fetchrow(
        """
        UPDATE pending_actions
        SET payload = $1::jsonb,
            original_payload = $2::jsonb,
            status = 'modified',
            reviewer_notes = $3,
            reviewed_at = NOW()
        WHERE id = $4
        RETURNING *
        """,
        json.dumps(request.payload),
        original_json,
        request.reviewer_notes,
        pending_id,
    )
    result = serialize_pending_row(updated)
    if guardrail_warnings:
        result["guardrail_warnings"] = guardrail_warnings
    return result


# ─── Delivery side-effects ────────────────────────────────────────────────────

async def _deliver_approved_action(row) -> None:
    """When a teacher approves a pending action, deliver it downstream.

    - exam_generation → insert into student_exams
    - orientation_report → (placeholder: could email parents)
    - iep_report → (placeholder: archive in student records)
    """
    pool = await get_pool()
    action_type = row["action_type"]
    student_id = row["student_id"]
    teacher_id = row["teacher_id"]
    payload = row["payload"]
    if isinstance(payload, str):
        payload = json.loads(payload)

    try:
        if action_type == "exam_generation":
            content_id = row["content_id"]
            await pool.execute(
                """
                INSERT INTO student_exams
                    (student_id, teacher_id, content_id, pending_action_id, exam_data)
                VALUES ($1, $2, $3, $4, $5)
                """,
                student_id,
                teacher_id,
                content_id,
                row["id"],
                json.dumps(payload.get("exam", payload)),
            )
            logger.info("Exam delivered to student %s from pending %s", student_id, row["id"])

        elif action_type == "orientation_report":
            logger.info(
                "Orientation report approved for student %s — ready for parent delivery.",
                student_id,
            )

        elif action_type == "iep_report":
            logger.info(
                "IEP report approved for student %s — archived.",
                student_id,
            )

    except Exception as e:
        logger.error("Failed to deliver approved action %s: %s", row["id"], e)
