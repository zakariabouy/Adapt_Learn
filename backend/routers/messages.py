"""
Communication Hub — Messaging and notifications between parents, teachers, admin.
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from shared.database import get_pool
from shared.models import SendMessageRequest
from routers.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/messages", tags=["Communication"])


# ─────────────────────────────────────────────────────────────────────────────
# Messaging
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/send")
async def send_message(request: SendMessageRequest, current_user=Depends(get_current_user)):
    pool = await get_pool()

    # Verify recipient exists
    recipient = await pool.fetchrow("SELECT id, role FROM users WHERE id = $1", UUID(request.recipient_id))
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    parent_msg_id = UUID(request.parent_message_id) if request.parent_message_id else None

    row = await pool.fetchrow(
        """INSERT INTO messages (sender_id, recipient_id, subject, body, parent_message_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at""",
        current_user["id"], UUID(request.recipient_id),
        request.subject, request.body, parent_msg_id,
    )

    # Create notification for recipient
    await pool.execute(
        """INSERT INTO notifications (user_id, notification_type, title, body, data)
           VALUES ($1, 'message', $2, $3, $4)""",
        UUID(request.recipient_id),
        f"New message from {current_user.get('name') or current_user['email']}",
        request.body[:200],
        f'{{"message_id": "{row["id"]}"}}',
    )

    return {"id": str(row["id"]), "created_at": row["created_at"].isoformat()}


@router.get("/inbox")
async def get_inbox(
    unread_only: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    current_user=Depends(get_current_user),
):
    pool = await get_pool()
    query = """
        SELECT m.*, u.name as sender_name, u.email as sender_email, u.role as sender_role
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.recipient_id = $1
    """
    params = [current_user["id"]]

    if unread_only:
        query += " AND m.is_read = FALSE"

    query += " ORDER BY m.created_at DESC LIMIT $2"
    params.append(limit)

    rows = await pool.fetch(query, *params)
    return [
        {
            "id": str(r["id"]),
            "sender_name": r["sender_name"] or r["sender_email"].split("@")[0],
            "sender_role": r["sender_role"],
            "subject": r["subject"],
            "body": r["body"],
            "is_read": r["is_read"],
            "parent_message_id": str(r["parent_message_id"]) if r["parent_message_id"] else None,
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@router.get("/sent")
async def get_sent(limit: int = Query(default=50, ge=1, le=200), current_user=Depends(get_current_user)):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT m.*, u.name as recipient_name, u.email as recipient_email
           FROM messages m
           JOIN users u ON m.recipient_id = u.id
           WHERE m.sender_id = $1
           ORDER BY m.created_at DESC LIMIT $2""",
        current_user["id"], limit,
    )
    return [
        {
            "id": str(r["id"]),
            "recipient_name": r["recipient_name"] or r["recipient_email"].split("@")[0],
            "subject": r["subject"],
            "body": r["body"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@router.get("/thread/{message_id}")
async def get_thread(message_id: UUID, current_user=Depends(get_current_user)):
    """Get a message and all its replies."""
    pool = await get_pool()
    # Get the root message
    root = await pool.fetchrow(
        "SELECT * FROM messages WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2)",
        message_id, current_user["id"],
    )
    if not root:
        raise HTTPException(status_code=404, detail="Message not found")

    # Get replies
    replies = await pool.fetch(
        """SELECT m.*, u.name as sender_name, u.role as sender_role
           FROM messages m
           JOIN users u ON m.sender_id = u.id
           WHERE m.parent_message_id = $1
           ORDER BY m.created_at ASC""",
        message_id,
    )
    return {
        "root": {
            "id": str(root["id"]),
            "body": root["body"],
            "subject": root["subject"],
            "created_at": root["created_at"].isoformat(),
        },
        "replies": [
            {
                "id": str(r["id"]),
                "sender_name": r["sender_name"],
                "sender_role": r["sender_role"],
                "body": r["body"],
                "created_at": r["created_at"].isoformat(),
            }
            for r in replies
        ],
    }


@router.post("/read/{message_id}")
async def mark_as_read(message_id: UUID, current_user=Depends(get_current_user)):
    pool = await get_pool()
    await pool.execute(
        "UPDATE messages SET is_read = TRUE WHERE id = $1 AND recipient_id = $2",
        message_id, current_user["id"],
    )
    return {"status": "read"}


@router.get("/unread-count")
async def unread_count(current_user=Depends(get_current_user)):
    pool = await get_pool()
    count = await pool.fetchval(
        "SELECT COUNT(*) FROM messages WHERE recipient_id = $1 AND is_read = FALSE",
        current_user["id"],
    )
    return {"unread": count or 0}


# ─────────────────────────────────────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/notifications")
async def list_notifications(
    unread_only: bool = False,
    limit: int = Query(default=30, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    pool = await get_pool()
    query = "SELECT * FROM notifications WHERE user_id = $1"
    params = [current_user["id"]]

    if unread_only:
        query += " AND is_read = FALSE"

    query += " ORDER BY created_at DESC LIMIT $2"
    params.append(limit)

    rows = await pool.fetch(query, *params)
    return [
        {
            "id": str(r["id"]),
            "type": r["notification_type"],
            "title": r["title"],
            "body": r["body"],
            "data": r["data"],
            "is_read": r["is_read"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@router.post("/notifications/read-all")
async def mark_all_notifications_read(current_user=Depends(get_current_user)):
    pool = await get_pool()
    await pool.execute(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
        current_user["id"],
    )
    return {"status": "all_read"}


@router.get("/notifications/unread-count")
async def notification_unread_count(current_user=Depends(get_current_user)):
    pool = await get_pool()
    count = await pool.fetchval(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE",
        current_user["id"],
    )
    return {"unread": count or 0}
