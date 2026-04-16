"""
Admin Reports Router — Administration role with profile access and aggregated reporting.
"""

import json
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from shared.database import get_pool
from routers.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Administration"])


async def get_current_admin(current_user=Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ─────────────────────────────────────────────────────────────────────────────
# Profile Access (read-only)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_all_users(
    role: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    admin=Depends(get_current_admin),
):
    """List all users with optional role filter."""
    pool = await get_pool()
    query = "SELECT id, email, name, role, grade_level, created_at FROM users"
    params = []

    if role:
        query += " WHERE role = $1"
        params.append(role)

    query += f" ORDER BY created_at DESC LIMIT ${len(params) + 1}"
    params.append(limit)

    rows = await pool.fetch(query, *params)
    return [
        {
            "id": str(r["id"]),
            "email": r["email"],
            "name": r["name"],
            "role": r["role"],
            "grade_level": r["grade_level"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: UUID, admin=Depends(get_current_admin)):
    """Admin views any user's profile."""
    pool = await get_pool()
    user = await pool.fetchrow(
        "SELECT id, email, name, role, grade_level, created_at FROM users WHERE id = $1", user_id
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = {
        "id": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "grade_level": user["grade_level"],
        "created_at": user["created_at"].isoformat(),
    }

    # If student, include learner profile and gamification
    if user["role"] == "student":
        profile_row = await pool.fetchrow(
            "SELECT profile_data FROM learner_profiles WHERE student_id = $1", user_id
        )
        if profile_row:
            result["learner_profile"] = json.loads(profile_row["profile_data"])

        gam = await pool.fetchrow(
            "SELECT * FROM student_gamification WHERE student_id = $1", user_id
        )
        if gam:
            result["gamification"] = {
                "xp": gam["current_xp"],
                "level": gam["current_level"],
                "streak": gam["current_streak"],
                "badges": json.loads(gam["badges_unlocked"]) if gam["badges_unlocked"] else [],
            }

    # If teacher, include student count and content count
    if user["role"] == "teacher":
        student_count = await pool.fetchval(
            "SELECT COUNT(*) FROM teacher_student_link WHERE teacher_id = $1", user_id
        )
        content_count = await pool.fetchval(
            "SELECT COUNT(*) FROM content_items WHERE teacher_id = $1", user_id
        )
        result["teacher_stats"] = {
            "student_count": student_count or 0,
            "content_count": content_count or 0,
        }

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Aggregated Reports
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/reports/overview")
async def platform_overview(admin=Depends(get_current_admin)):
    """High-level platform statistics."""
    pool = await get_pool()

    counts = await pool.fetchrow("""
        SELECT
            COUNT(*) FILTER (WHERE role = 'student') as total_students,
            COUNT(*) FILTER (WHERE role = 'teacher') as total_teachers,
            COUNT(*) FILTER (WHERE role = 'parent') as total_parents,
            COUNT(*) FILTER (WHERE role = 'admin') as total_admins,
            COUNT(*) as total_users
        FROM users
    """)

    content_count = await pool.fetchval("SELECT COUNT(*) FROM content_items")
    session_count = await pool.fetchval("SELECT COUNT(*) FROM sessions")
    assessment_count = await pool.fetchval("SELECT COUNT(*) FROM assessments")

    # Activity in last 7 days
    active_students = await pool.fetchval(
        "SELECT COUNT(DISTINCT student_id) FROM sessions WHERE started_at > NOW() - INTERVAL '7 days'"
    )

    # Guardrail events in last 7 days
    guardrail_events = await pool.fetchval(
        "SELECT COUNT(*) FROM guardrail_events WHERE created_at > NOW() - INTERVAL '7 days'"
    )

    return {
        "users": {
            "total": counts["total_users"],
            "students": counts["total_students"],
            "teachers": counts["total_teachers"],
            "parents": counts["total_parents"],
            "admins": counts["total_admins"],
        },
        "content": {
            "total_items": content_count or 0,
            "total_sessions": session_count or 0,
            "total_assessments": assessment_count or 0,
        },
        "activity": {
            "active_students_7d": active_students or 0,
            "guardrail_events_7d": guardrail_events or 0,
        },
    }


@router.get("/reports/per-teacher")
async def report_per_teacher(admin=Depends(get_current_admin)):
    """Aggregated stats per teacher."""
    pool = await get_pool()
    rows = await pool.fetch("""
        SELECT
            u.id, u.name, u.email,
            COUNT(DISTINCT tsl.student_id) as student_count,
            COUNT(DISTINCT ci.id) as content_count,
            COUNT(DISTINCT s.id) as session_count,
            ROUND(AVG((s.telemetry_summary->>'engagement_score')::float)::numeric, 2) as avg_engagement
        FROM users u
        LEFT JOIN teacher_student_link tsl ON u.id = tsl.teacher_id
        LEFT JOIN content_items ci ON u.id = ci.teacher_id
        LEFT JOIN sessions s ON s.student_id = tsl.student_id
            AND s.started_at > NOW() - INTERVAL '30 days'
        WHERE u.role = 'teacher'
        GROUP BY u.id, u.name, u.email
        ORDER BY student_count DESC
    """)
    return [
        {
            "id": str(r["id"]),
            "name": r["name"] or r["email"].split("@")[0],
            "email": r["email"],
            "student_count": r["student_count"],
            "content_count": r["content_count"],
            "session_count_30d": r["session_count"],
            "avg_engagement_30d": float(r["avg_engagement"]) if r["avg_engagement"] else None,
        }
        for r in rows
    ]


@router.get("/reports/per-student")
async def report_per_student(
    teacher_id: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    admin=Depends(get_current_admin),
):
    """Aggregated stats per student, optionally filtered by teacher."""
    pool = await get_pool()

    query = """
        SELECT
            u.id, u.name, u.email, u.grade_level,
            lp.profile_data,
            sg.current_xp, sg.current_level, sg.current_streak,
            COUNT(DISTINCT s.id) as total_sessions,
            COUNT(DISTINCT a.id) as total_assessments,
            MAX(a.theta_after) as latest_ability,
            MAX(s.started_at) as last_active
        FROM users u
        LEFT JOIN learner_profiles lp ON u.id = lp.student_id
        LEFT JOIN student_gamification sg ON u.id = sg.student_id
        LEFT JOIN sessions s ON u.id = s.student_id
        LEFT JOIN assessments a ON u.id = a.student_id
    """
    params = []

    if teacher_id:
        query += " JOIN teacher_student_link tsl ON u.id = tsl.student_id WHERE tsl.teacher_id = $1 AND u.role = 'student'"
        params.append(UUID(teacher_id))
    else:
        query += " WHERE u.role = 'student'"

    query += f" GROUP BY u.id, u.name, u.email, u.grade_level, lp.profile_data, sg.current_xp, sg.current_level, sg.current_streak ORDER BY u.name LIMIT ${len(params) + 1}"
    params.append(limit)

    rows = await pool.fetch(query, *params)
    return [
        {
            "id": str(r["id"]),
            "name": r["name"] or r["email"].split("@")[0],
            "email": r["email"],
            "grade_level": r["grade_level"],
            "xp": r["current_xp"] or 0,
            "level": r["current_level"] or 1,
            "streak": r["current_streak"] or 0,
            "total_sessions": r["total_sessions"],
            "total_assessments": r["total_assessments"],
            "latest_ability": round(float(r["latest_ability"]), 2) if r["latest_ability"] else None,
            "last_active": r["last_active"].isoformat() if r["last_active"] else None,
        }
        for r in rows
    ]


@router.get("/reports/engagement")
async def engagement_report(
    days: int = Query(default=7, ge=1, le=90),
    admin=Depends(get_current_admin),
):
    """Daily engagement metrics across the platform."""
    pool = await get_pool()
    rows = await pool.fetch(f"""
        SELECT
            DATE(s.started_at) as day,
            COUNT(DISTINCT s.student_id) as active_students,
            COUNT(s.id) as sessions,
            ROUND(AVG((s.telemetry_summary->>'engagement_score')::float)::numeric, 2) as avg_engagement,
            ROUND(AVG(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60)::numeric, 1) as avg_session_minutes
        FROM sessions s
        WHERE s.started_at > NOW() - INTERVAL '{days} days'
          AND s.ended_at IS NOT NULL
        GROUP BY DATE(s.started_at)
        ORDER BY day DESC
    """)
    return [
        {
            "day": r["day"].isoformat(),
            "active_students": r["active_students"],
            "sessions": r["sessions"],
            "avg_engagement": float(r["avg_engagement"]) if r["avg_engagement"] else None,
            "avg_session_minutes": float(r["avg_session_minutes"]) if r["avg_session_minutes"] else None,
        }
        for r in rows
    ]


@router.get("/reports/feedback-summary")
async def feedback_summary(admin=Depends(get_current_admin)):
    """Aggregated feedback statistics."""
    pool = await get_pool()

    # Student feedback stats
    sf_stats = await pool.fetchrow("""
        SELECT
            COUNT(*) as total,
            ROUND(AVG(content_rating)::numeric, 1) as avg_content_rating,
            ROUND(AVG(teacher_rating)::numeric, 1) as avg_teacher_rating,
            COUNT(*) FILTER (WHERE difficulty_feedback = 'too_easy') as too_easy,
            COUNT(*) FILTER (WHERE difficulty_feedback = 'just_right') as just_right,
            COUNT(*) FILTER (WHERE difficulty_feedback = 'too_hard') as too_hard
        FROM student_feedback
    """)

    # Parent issues stats
    pi_stats = await pool.fetchrow("""
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'open') as open_count,
            COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count
        FROM parent_issues
    """)

    return {
        "student_feedback": {
            "total": sf_stats["total"],
            "avg_content_rating": float(sf_stats["avg_content_rating"]) if sf_stats["avg_content_rating"] else None,
            "avg_teacher_rating": float(sf_stats["avg_teacher_rating"]) if sf_stats["avg_teacher_rating"] else None,
            "difficulty_distribution": {
                "too_easy": sf_stats["too_easy"],
                "just_right": sf_stats["just_right"],
                "too_hard": sf_stats["too_hard"],
            },
        },
        "parent_issues": {
            "total": pi_stats["total"],
            "open": pi_stats["open_count"],
            "resolved": pi_stats["resolved_count"],
        },
    }


@router.get("/reports/guardrails")
async def guardrail_report(
    days: int = Query(default=7, ge=1, le=90),
    admin=Depends(get_current_admin),
):
    """Guardrail event summary for security monitoring."""
    pool = await get_pool()
    rows = await pool.fetch(f"""
        SELECT
            event_type,
            severity,
            action_taken,
            COUNT(*) as count
        FROM guardrail_events
        WHERE created_at > NOW() - INTERVAL '{days} days'
        GROUP BY event_type, severity, action_taken
        ORDER BY count DESC
    """)
    return [
        {
            "event_type": r["event_type"],
            "severity": r["severity"],
            "action_taken": r["action_taken"],
            "count": r["count"],
        }
        for r in rows
    ]
