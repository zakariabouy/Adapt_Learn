"""
Parent Router — Full parent role with KPI dashboard, onboarding, rewards, controls, course visibility.
"""

import json
import logging
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from shared.database import get_pool
from shared.models import (
    LinkChildRequest, ParentOnboardingRequest, ParentalControlsRequest,
    CustomRewardRequest, ParentIssueRequest, RedeemRewardRequest,
)
from routers.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/parent", tags=["Parent"])


async def get_current_parent(current_user=Depends(get_current_user)):
    if current_user["role"] != "parent":
        raise HTTPException(status_code=403, detail="Parent access required")
    return current_user


async def _verify_parent_child(parent_id: UUID, child_id: UUID):
    pool = await get_pool()
    link = await pool.fetchrow(
        "SELECT 1 FROM parent_child_link WHERE parent_id = $1 AND child_id = $2",
        parent_id, child_id,
    )
    if not link:
        raise HTTPException(status_code=403, detail="Child not linked to this parent")


# ─────────────────────────────────────────────────────────────────────────────
# Child Linking
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/link-child")
async def link_child(request: LinkChildRequest, parent=Depends(get_current_parent)):
    pool = await get_pool()
    child = await pool.fetchrow(
        "SELECT id FROM users WHERE email = $1 AND role = 'student'",
        request.child_email,
    )
    if not child:
        raise HTTPException(status_code=404, detail="Student not found")

    await pool.execute(
        "INSERT INTO parent_child_link (parent_id, child_id, relationship) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        parent["id"], child["id"], request.relationship,
    )
    return {"status": "linked", "child_id": str(child["id"])}


@router.get("/children")
async def list_children(parent=Depends(get_current_parent)):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT u.id, u.name, u.email, u.grade_level, pcl.relationship,
                  sg.current_xp, sg.current_level, sg.current_streak, sg.badges_unlocked
           FROM parent_child_link pcl
           JOIN users u ON pcl.child_id = u.id
           LEFT JOIN student_gamification sg ON u.id = sg.student_id
           WHERE pcl.parent_id = $1
           ORDER BY u.name""",
        parent["id"],
    )
    return [
        {
            "id": str(r["id"]),
            "name": r["name"] or r["email"].split("@")[0].capitalize(),
            "email": r["email"],
            "grade_level": r["grade_level"],
            "relationship": r["relationship"],
            "xp": r["current_xp"] or 0,
            "level": r["current_level"] or 1,
            "streak": r["current_streak"] or 0,
            "badges": json.loads(r["badges_unlocked"]) if r["badges_unlocked"] else [],
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# KPI Dashboard
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard/{child_id}")
async def get_child_dashboard(child_id: UUID, parent=Depends(get_current_parent)):
    await _verify_parent_child(parent["id"], child_id)
    pool = await get_pool()

    # Profile
    profile_row = await pool.fetchrow(
        "SELECT profile_data FROM learner_profiles WHERE student_id = $1", child_id
    )
    profile = json.loads(profile_row["profile_data"]) if profile_row else {}

    # Gamification
    gam = await pool.fetchrow(
        "SELECT * FROM student_gamification WHERE student_id = $1", child_id
    )

    # Recent assessments (last 10)
    assessments = await pool.fetch(
        """SELECT a.score, a.theta_after, a.taken_at, ci.title, ci.subject
           FROM assessments a
           LEFT JOIN sessions s ON a.session_id = s.id
           LEFT JOIN content_items ci ON s.content_id = ci.id
           WHERE a.student_id = $1
           ORDER BY a.taken_at DESC LIMIT 10""",
        child_id,
    )

    # Recent sessions (last 7 days)
    sessions = await pool.fetch(
        """SELECT s.started_at, s.ended_at, s.telemetry_summary, ci.title
           FROM sessions s
           LEFT JOIN content_items ci ON s.content_id = ci.id
           WHERE s.student_id = $1 AND s.started_at > NOW() - INTERVAL '7 days'
           ORDER BY s.started_at DESC""",
        child_id,
    )

    total_time = 0.0
    avg_engagement = 0.0
    for s in sessions:
        if s["started_at"] and s["ended_at"]:
            total_time += (s["ended_at"] - s["started_at"]).total_seconds() / 60.0
        summary = s["telemetry_summary"] or {}
        if isinstance(summary, str):
            summary = json.loads(summary)
        avg_engagement += 1.0 - summary.get("current_frustration_level", 0.5)

    if sessions:
        avg_engagement /= len(sessions)

    # Strengths / Weaknesses from profile
    ability = profile.get("ability_estimate", 0.0)
    mastery = profile.get("mastery_by_topic", {})
    sorted_topics = sorted(mastery.items(), key=lambda x: x[1], reverse=True)
    strengths = [t[0] for t in sorted_topics[:3] if t[1] >= 0.5]
    weaknesses = [t[0] for t in sorted_topics if t[1] < 0.3]

    # Daily usage
    usage = await pool.fetchrow(
        "SELECT total_minutes, session_count FROM daily_usage_log WHERE student_id = $1 AND usage_date = CURRENT_DATE",
        child_id,
    )

    return {
        "child_id": str(child_id),
        "profile": {
            "learning_tags": profile.get("learning_tags", []),
            "tag_strength": profile.get("tag_strength", {}),
            "preferred_modality": profile.get("preferred_modality", "text"),
            "ability_estimate": round(ability, 2),
            "reading_speed_wpm": profile.get("reading_speed_wpm", 0),
            "bartle_type": profile.get("bartle_type"),
            "bartle_scores": profile.get("bartle_scores"),
        },
        "gamification": {
            "xp": gam["current_xp"] if gam else 0,
            "level": gam["current_level"] if gam else 1,
            "streak": gam["current_streak"] if gam else 0,
            "badges": json.loads(gam["badges_unlocked"]) if gam and gam["badges_unlocked"] else [],
        },
        "week_summary": {
            "sessions": len(sessions),
            "total_minutes": round(total_time, 1),
            "avg_engagement": round(avg_engagement * 100, 1),
        },
        "strengths": strengths,
        "weaknesses": weaknesses,
        "recent_assessments": [
            {
                "title": a["title"],
                "subject": a["subject"],
                "score": round(a["score"] * 100, 1) if a["score"] else None,
                "ability": round(float(a["theta_after"]), 2) if a["theta_after"] else None,
                "date": a["taken_at"].isoformat() if a["taken_at"] else None,
            }
            for a in assessments
        ],
        "today_usage": {
            "minutes": round(usage["total_minutes"], 1) if usage else 0,
            "sessions": usage["session_count"] if usage else 0,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Scientific Onboarding
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/onboarding")
async def submit_onboarding(request: ParentOnboardingRequest, parent=Depends(get_current_parent)):
    """Parent provides scientific info about their child to improve AI adaptation."""
    pool = await get_pool()

    # Find child by email
    child = await pool.fetchrow(
        "SELECT id FROM users WHERE email = $1 AND role = 'student'", request.child_email
    )
    if not child:
        raise HTTPException(status_code=404, detail="Student not found")

    child_id = child["id"]
    await _verify_parent_child(parent["id"], child_id)

    await pool.execute(
        """INSERT INTO parent_onboarding (parent_id, child_id, child_birth_date, known_conditions,
               preferred_learning_time, attention_span_minutes, interests, languages_spoken, additional_notes,
               favorite_color, favorite_subject, favorite_animal, hobbies, personality_observations)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (parent_id, child_id) DO UPDATE SET
               child_birth_date = EXCLUDED.child_birth_date,
               known_conditions = EXCLUDED.known_conditions,
               preferred_learning_time = EXCLUDED.preferred_learning_time,
               attention_span_minutes = EXCLUDED.attention_span_minutes,
               interests = EXCLUDED.interests,
               languages_spoken = EXCLUDED.languages_spoken,
               additional_notes = EXCLUDED.additional_notes,
               favorite_color = EXCLUDED.favorite_color,
               favorite_subject = EXCLUDED.favorite_subject,
               favorite_animal = EXCLUDED.favorite_animal,
               hobbies = EXCLUDED.hobbies,
               personality_observations = EXCLUDED.personality_observations,
               updated_at = NOW()""",
        parent["id"], child_id,
        request.child_birth_date,
        request.known_conditions,
        request.preferred_learning_time,
        request.attention_span_minutes,
        request.interests,
        request.languages_spoken,
        request.additional_notes,
        request.favorite_color,
        request.favorite_subject,
        request.favorite_animal,
        request.hobbies,
        request.personality_observations,
    )

    # Inject parent data into learner profile
    profile_row = await pool.fetchrow(
        "SELECT profile_data FROM learner_profiles WHERE student_id = $1", child_id
    )
    if profile_row:
        profile = json.loads(profile_row["profile_data"])

        # Conditions → learning tags
        condition_to_tag = {
            "dyslexia": "slow_reader",
            "ADHD": "short_attention",
            "hearing_impairment": "visual_learner",
            "visual_impairment": "audio_learner",
        }
        existing_tags = set(profile.get("learning_tags", []))
        for cond in request.known_conditions:
            tag = condition_to_tag.get(cond)
            if tag:
                existing_tags.add(tag)
        profile["learning_tags"] = list(existing_tags)

        if request.attention_span_minutes:
            profile["chunk_size"] = min(request.attention_span_minutes * 8, 500)

        # Personal favorites → profile fields
        if request.favorite_color:
            profile["favorite_color"] = request.favorite_color
        if request.favorite_subject:
            profile["favorite_subject"] = request.favorite_subject
        if request.favorite_animal:
            profile["favorite_animal"] = request.favorite_animal
        if request.hobbies:
            profile["hobbies"] = request.hobbies
        if request.personality_observations:
            existing_traits = set(profile.get("personality_traits", []))
            existing_traits.update(request.personality_observations)
            profile["personality_traits"] = list(existing_traits)

        await pool.execute(
            "UPDATE learner_profiles SET profile_data = $1, last_updated = NOW() WHERE student_id = $2",
            json.dumps(profile), child_id,
        )

    return {"status": "onboarding_saved", "child_id": str(child_id)}


@router.get("/onboarding/{child_id}")
async def get_onboarding(child_id: UUID, parent=Depends(get_current_parent)):
    await _verify_parent_child(parent["id"], child_id)
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM parent_onboarding WHERE parent_id = $1 AND child_id = $2",
        parent["id"], child_id,
    )
    if not row:
        return {"status": "not_submitted"}
    return {
        "child_birth_date": str(row["child_birth_date"]) if row["child_birth_date"] else None,
        "known_conditions": row["known_conditions"] or [],
        "preferred_learning_time": row["preferred_learning_time"],
        "attention_span_minutes": row["attention_span_minutes"],
        "interests": row["interests"] or [],
        "languages_spoken": row["languages_spoken"] or [],
        "additional_notes": row["additional_notes"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Parental Controls
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/controls/{child_id}")
async def set_parental_controls(
    child_id: UUID,
    request: ParentalControlsRequest,
    parent=Depends(get_current_parent),
):
    await _verify_parent_child(parent["id"], child_id)
    pool = await get_pool()
    await pool.execute(
        """INSERT INTO parental_controls
               (parent_id, child_id, daily_time_limit_minutes, session_max_minutes,
                allowed_start_hour, allowed_end_hour, break_interval_minutes,
                break_duration_minutes, allow_leaderboard, allow_messaging)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (parent_id, child_id) DO UPDATE SET
               daily_time_limit_minutes = EXCLUDED.daily_time_limit_minutes,
               session_max_minutes = EXCLUDED.session_max_minutes,
               allowed_start_hour = EXCLUDED.allowed_start_hour,
               allowed_end_hour = EXCLUDED.allowed_end_hour,
               break_interval_minutes = EXCLUDED.break_interval_minutes,
               break_duration_minutes = EXCLUDED.break_duration_minutes,
               allow_leaderboard = EXCLUDED.allow_leaderboard,
               allow_messaging = EXCLUDED.allow_messaging,
               updated_at = NOW()""",
        parent["id"], child_id,
        request.daily_time_limit_minutes, request.session_max_minutes,
        request.allowed_start_hour, request.allowed_end_hour,
        request.break_interval_minutes, request.break_duration_minutes,
        request.allow_leaderboard, request.allow_messaging,
    )
    return {"status": "controls_updated", "child_id": str(child_id)}


@router.get("/controls/{child_id}")
async def get_parental_controls(child_id: UUID, parent=Depends(get_current_parent)):
    await _verify_parent_child(parent["id"], child_id)
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM parental_controls WHERE parent_id = $1 AND child_id = $2",
        parent["id"], child_id,
    )
    if not row:
        return {"status": "defaults", "daily_time_limit_minutes": 60, "session_max_minutes": 45}
    return {
        "daily_time_limit_minutes": row["daily_time_limit_minutes"],
        "session_max_minutes": row["session_max_minutes"],
        "allowed_start_hour": row["allowed_start_hour"],
        "allowed_end_hour": row["allowed_end_hour"],
        "break_interval_minutes": row["break_interval_minutes"],
        "break_duration_minutes": row["break_duration_minutes"],
        "allow_leaderboard": row["allow_leaderboard"],
        "allow_messaging": row["allow_messaging"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Custom Rewards
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/rewards/{child_id}")
async def create_custom_reward(
    child_id: UUID,
    request: CustomRewardRequest,
    parent=Depends(get_current_parent),
):
    await _verify_parent_child(parent["id"], child_id)
    pool = await get_pool()
    row = await pool.fetchrow(
        """INSERT INTO custom_rewards (parent_id, child_id, title, description, xp_cost, icon)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id""",
        parent["id"], child_id, request.title, request.description, request.xp_cost, request.icon,
    )
    return {"id": str(row["id"]), "status": "reward_created"}


@router.get("/rewards/{child_id}")
async def list_custom_rewards(child_id: UUID, parent=Depends(get_current_parent)):
    await _verify_parent_child(parent["id"], child_id)
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM custom_rewards WHERE child_id = $1 AND parent_id = $2 ORDER BY created_at DESC",
        child_id, parent["id"],
    )
    return [
        {
            "id": str(r["id"]),
            "title": r["title"],
            "description": r["description"],
            "xp_cost": r["xp_cost"],
            "icon": r["icon"],
            "is_active": r["is_active"],
            "is_redeemed": r["is_redeemed"],
            "redeemed_at": r["redeemed_at"].isoformat() if r["redeemed_at"] else None,
        }
        for r in rows
    ]


@router.delete("/rewards/{reward_id}")
async def delete_custom_reward(reward_id: UUID, parent=Depends(get_current_parent)):
    pool = await get_pool()
    deleted = await pool.execute(
        "DELETE FROM custom_rewards WHERE id = $1 AND parent_id = $2",
        reward_id, parent["id"],
    )
    return {"status": "deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# Course Visibility (read-only adapted content)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/courses/{child_id}")
async def list_child_courses(child_id: UUID, parent=Depends(get_current_parent)):
    """Lists all content items available to the child (read-only for parent)."""
    await _verify_parent_child(parent["id"], child_id)
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT ci.id, ci.title, ci.subject, ci.grade_level, ci.created_at, u.name as teacher_name
           FROM content_items ci
           JOIN teacher_student_link tsl ON ci.teacher_id = tsl.teacher_id
           JOIN users u ON ci.teacher_id = u.id
           WHERE tsl.student_id = $1
           ORDER BY ci.created_at DESC""",
        child_id,
    )
    return [
        {
            "id": str(r["id"]),
            "title": r["title"],
            "subject": r["subject"],
            "grade_level": r["grade_level"],
            "teacher_name": r["teacher_name"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@router.get("/courses/{child_id}/{content_id}")
async def view_adapted_content(child_id: UUID, content_id: UUID, parent=Depends(get_current_parent)):
    """Parent can see the adapted content their child received."""
    await _verify_parent_child(parent["id"], child_id)
    pool = await get_pool()
    row = await pool.fetchrow(
        """SELECT ac.adapted_text, ac.adaptation_config, ci.title, ci.subject
           FROM adapted_content ac
           JOIN content_items ci ON ac.content_id = ci.id
           WHERE ac.content_id = $1 AND ac.student_id = $2
           ORDER BY ac.created_at DESC LIMIT 1""",
        content_id, child_id,
    )
    if not row:
        return {"status": "not_yet_adapted", "message": "Your child hasn't accessed this content yet."}
    return {
        "title": row["title"],
        "subject": row["subject"],
        "chunks": json.loads(row["adapted_text"]) if row["adapted_text"] else [],
        "read_only": True,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Issue Reporting
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/issues")
async def report_issue(request: ParentIssueRequest, parent=Depends(get_current_parent)):
    child_id = UUID(request.child_id)
    await _verify_parent_child(parent["id"], child_id)
    pool = await get_pool()
    target = UUID(request.target_id) if request.target_id else None
    row = await pool.fetchrow(
        """INSERT INTO parent_issues (parent_id, child_id, issue_type, target_id, title, description)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id""",
        parent["id"], child_id, request.issue_type, target, request.title, request.description,
    )
    return {"id": str(row["id"]), "status": "reported"}


@router.get("/issues")
async def list_my_issues(parent=Depends(get_current_parent)):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT pi.*, u.name as child_name
           FROM parent_issues pi
           JOIN users u ON pi.child_id = u.id
           WHERE pi.parent_id = $1
           ORDER BY pi.created_at DESC LIMIT 50""",
        parent["id"],
    )
    return [
        {
            "id": str(r["id"]),
            "child_name": r["child_name"],
            "issue_type": r["issue_type"],
            "title": r["title"],
            "status": r["status"],
            "created_at": r["created_at"].isoformat(),
            "response": r["response"],
        }
        for r in rows
    ]
