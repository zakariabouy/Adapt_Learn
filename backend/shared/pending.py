"""Helpers for the Human-in-the-Loop pending_actions queue.

Agents and routers enqueue artifacts here instead of shipping them straight
to downstream consumers. A teacher reviews each entry and either approves,
rejects, or edits it before it becomes usable.
"""

from typing import Any, Dict, Optional
from uuid import UUID
import json

from shared.database import get_pool


async def enqueue_pending_action(
    action_type: str,
    teacher_id: UUID,
    payload: Dict[str, Any],
    student_id: Optional[UUID] = None,
    content_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """Inserts a pending action and returns the stored row."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO pending_actions
            (action_type, student_id, teacher_id, content_id, payload, status)
        VALUES ($1, $2, $3, $4, $5::jsonb, 'pending')
        RETURNING id, action_type, student_id, teacher_id, content_id,
                  payload, status, created_at
        """,
        action_type,
        student_id,
        teacher_id,
        content_id,
        json.dumps(payload),
    )
    return {
        "id": str(row["id"]),
        "action_type": row["action_type"],
        "student_id": str(row["student_id"]) if row["student_id"] else None,
        "teacher_id": str(row["teacher_id"]),
        "content_id": str(row["content_id"]) if row["content_id"] else None,
        "status": row["status"],
        "created_at": row["created_at"].isoformat(),
    }


def serialize_pending_row(row) -> Dict[str, Any]:
    """Convert an asyncpg row to a JSON-safe dict."""
    payload = row["payload"]
    if isinstance(payload, str):
        payload = json.loads(payload)

    original = row["original_payload"]
    if isinstance(original, str):
        original = json.loads(original) if original else None

    return {
        "id": str(row["id"]),
        "action_type": row["action_type"],
        "student_id": str(row["student_id"]) if row["student_id"] else None,
        "teacher_id": str(row["teacher_id"]),
        "content_id": str(row["content_id"]) if row["content_id"] else None,
        "payload": payload,
        "original_payload": original,
        "status": row["status"],
        "reviewer_notes": row["reviewer_notes"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "reviewed_at": row["reviewed_at"].isoformat() if row["reviewed_at"] else None,
    }
