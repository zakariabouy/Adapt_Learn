"""
Guardrails Router — Admin visibility into security events.

Provides endpoints for teachers/admins to:
  - View recent guardrail events (audit log)
  - Get aggregate guardrail statistics
  - Test input against guardrails (for debugging)
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from shared.database import get_pool
from shared.guardrails import (
    detect_prompt_injection,
    check_content_safety,
    check_agent_autonomy,
    RATE_LIMITS,
)
from routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/guardrails", tags=["Guardrails"])


@router.get("/events")
async def list_guardrail_events(
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    current_user=Depends(get_current_user),
):
    """Lists recent guardrail events. Teacher/admin only."""
    if current_user["role"] not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teacher or admin access required")

    pool = await get_pool()

    query = "SELECT * FROM guardrail_events WHERE 1=1"
    params = []
    idx = 1

    if event_type:
        query += f" AND event_type = ${idx}"
        params.append(event_type)
        idx += 1

    if severity:
        query += f" AND severity = ${idx}"
        params.append(severity)
        idx += 1

    query += f" ORDER BY created_at DESC LIMIT ${idx}"
    params.append(limit)

    rows = await pool.fetch(query, *params)
    return [
        {
            "id": str(r["id"]),
            "event_type": r["event_type"],
            "severity": r["severity"],
            "user_id": str(r["user_id"]) if r["user_id"] else None,
            "endpoint": r["endpoint"],
            "input_snippet": r["input_snippet"],
            "output_snippet": r["output_snippet"],
            "details": r["details"],
            "action_taken": r["action_taken"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@router.get("/stats")
async def guardrail_stats(current_user=Depends(get_current_user)):
    """Aggregate guardrail statistics for the dashboard."""
    if current_user["role"] not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teacher or admin access required")

    pool = await get_pool()

    # Counts by type (last 7 days)
    type_counts = await pool.fetch(
        """SELECT event_type, COUNT(*) as count
           FROM guardrail_events
           WHERE created_at > NOW() - INTERVAL '7 days'
           GROUP BY event_type
           ORDER BY count DESC"""
    )

    # Counts by severity
    severity_counts = await pool.fetch(
        """SELECT severity, COUNT(*) as count
           FROM guardrail_events
           WHERE created_at > NOW() - INTERVAL '7 days'
           GROUP BY severity"""
    )

    # Total events
    total = await pool.fetchval(
        "SELECT COUNT(*) FROM guardrail_events WHERE created_at > NOW() - INTERVAL '7 days'"
    )

    # Blocked count
    blocked = await pool.fetchval(
        "SELECT COUNT(*) FROM guardrail_events WHERE action_taken = 'blocked' AND created_at > NOW() - INTERVAL '7 days'"
    )

    return {
        "period": "last_7_days",
        "total_events": total or 0,
        "blocked_requests": blocked or 0,
        "by_type": {r["event_type"]: r["count"] for r in type_counts},
        "by_severity": {r["severity"]: r["count"] for r in severity_counts},
        "rate_limits": {k: {"max_requests": v.max_requests, "window_seconds": v.window_seconds} for k, v in RATE_LIMITS.items()},
    }


class GuardrailTestRequest(BaseModel):
    text: str


@router.post("/test")
async def test_guardrails(
    request: GuardrailTestRequest,
    current_user=Depends(get_current_user),
):
    """
    Test input text against guardrails without triggering any action.
    Useful for teachers to understand what the guardrails catch.
    """
    if current_user["role"] not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teacher or admin access required")

    injection = detect_prompt_injection(request.text)
    safety = check_content_safety(request.text)

    return {
        "prompt_injection": injection,
        "content_safety": safety,
        "overall_safe": not injection["is_injection"] and safety["is_safe"],
    }


@router.get("/autonomy")
async def list_autonomy_rules(current_user=Depends(get_current_user)):
    """Lists all agent actions and their autonomy classification."""
    if current_user["role"] not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teacher or admin access required")

    actions = [
        "adapt_content", "chunk_content", "generate_visual", "summarize_text",
        "quiz_question", "semantic_search", "tts_convert", "game_profiler",
        "generate_exam", "orientation_report", "iep_report",
        "modify_grade_level", "delete_content",
    ]

    return [check_agent_autonomy(action) | {"action": action} for action in actions]
