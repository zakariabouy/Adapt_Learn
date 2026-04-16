"""
Orientation Agent — Aggregates all student data sources and generates
a holistic cognitive profile report via Gemini structured outputs.

Flow:
  1. aggregate_student_data() — SQL joins across all tables → context JSON
  2. compute_dispersion_index() — variance of IRT scores → Scanner/Diver float
  3. infer_bartle_type() — gamification behavior → Bartle classification
  4. generate_orientation_report() — Gemini call with structured output
"""

import os
import json
import math
import logging
from uuid import UUID

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from shared.database import get_pool
from agents.orientation.schema import OrientationReportSchema
from agents.orientation.prompt import SYSTEM_PROMPT

logger = logging.getLogger(__name__)

_llm = None


def get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )
    return _llm


# ─────────────────────────────────────────────────────────────────────────────
# Data Aggregation
# ─────────────────────────────────────────────────────────────────────────────

async def aggregate_student_data(student_id: UUID) -> dict:
    """Pull every data source into a single context dict for the LLM."""
    pool = await get_pool()

    # ── User basics ──
    user = await pool.fetchrow(
        "SELECT name, email, grade_level FROM users WHERE id = $1", student_id
    )
    if not user:
        raise ValueError(f"Student {student_id} not found")

    # ── Learner profile (VARK, ability, learning tags) ──
    profile_row = await pool.fetchrow(
        "SELECT profile_data FROM learner_profiles WHERE student_id = $1", student_id
    )
    profile = json.loads(profile_row["profile_data"]) if profile_row else {}

    # ── IRT scores by subject ──
    irt_rows = await pool.fetch(
        """
        SELECT ci.subject,
               AVG(a.theta_after)                       AS avg_theta,
               COUNT(*)                                  AS attempts,
               MAX(a.theta_after) - MIN(a.theta_after)  AS theta_range
        FROM assessments a
        JOIN sessions s  ON a.session_id = s.id
        JOIN content_items ci ON s.content_id = ci.id
        WHERE a.student_id = $1
        GROUP BY ci.subject
        """,
        student_id,
    )
    irt_scores = {}
    for row in irt_rows:
        irt_scores[row["subject"]] = {
            "avg_theta": round(float(row["avg_theta"] or 0), 2),
            "attempts": row["attempts"],
            "theta_range": round(float(row["theta_range"] or 0), 2),
        }

    # ── Telemetry (recent 20 sessions) ──
    telemetry_rows = await pool.fetch(
        """
        SELECT telemetry_summary, started_at, ended_at
        FROM sessions
        WHERE student_id = $1 AND telemetry_summary IS NOT NULL
        ORDER BY started_at DESC LIMIT 20
        """,
        student_id,
    )
    total_session_minutes = 0.0
    frustration_events = 0
    avg_attention_score = 0.0
    session_count = len(telemetry_rows)

    for row in telemetry_rows:
        summary = row["telemetry_summary"]
        if isinstance(summary, str):
            summary = json.loads(summary)
        if row["started_at"] and row["ended_at"]:
            delta = (row["ended_at"] - row["started_at"]).total_seconds() / 60.0
            total_session_minutes += delta
        frustration_events += summary.get("frustration_events", 0)
        avg_attention_score += 1.0 - summary.get("current_frustration_level", 0.5)

    if session_count > 0:
        avg_attention_score /= session_count

    telemetry = {
        "total_sessions": session_count,
        "total_minutes": round(total_session_minutes, 1),
        "avg_session_minutes": round(total_session_minutes / max(1, session_count), 1),
        "frustration_events": frustration_events,
        "avg_attention_score": round(avg_attention_score, 2),
    }

    # ── Gamification ──
    gam_row = await pool.fetchrow(
        """SELECT current_xp, current_level, current_streak, max_streak, badges_unlocked
           FROM student_gamification WHERE student_id = $1""",
        student_id,
    )
    gamification = {
        "xp": gam_row["current_xp"] if gam_row else 0,
        "level": gam_row["current_level"] if gam_row else 1,
        "streak": gam_row["current_streak"] if gam_row else 0,
        "max_streak": gam_row["max_streak"] if gam_row else 0,
        "badges": list(gam_row["badges_unlocked"] or []) if gam_row else [],
    }

    rank_row = await pool.fetchrow(
        "SELECT grade_rank, global_rank FROM leaderboard WHERE student_id = $1",
        student_id,
    )
    gamification["grade_rank"] = rank_row["grade_rank"] if rank_row else None
    gamification["global_rank"] = rank_row["global_rank"] if rank_row else None

    # ── Parent context ──
    parent_row = await pool.fetchrow(
        """
        SELECT po.known_conditions, po.preferred_learning_time,
               po.attention_span_minutes, po.interests, po.languages_spoken,
               po.additional_notes, po.favorite_color, po.favorite_subject,
               po.favorite_animal, po.hobbies, po.personality_observations
        FROM parent_onboarding po
        WHERE po.child_id = $1
        LIMIT 1
        """,
        student_id,
    )
    parent_context = {}
    if parent_row:
        parent_context = {
            "known_conditions": parent_row["known_conditions"] or [],
            "preferred_learning_time": parent_row["preferred_learning_time"],
            "attention_span_minutes": parent_row["attention_span_minutes"],
            "interests": parent_row["interests"] or [],
            "languages_spoken": parent_row["languages_spoken"] or [],
            "notes": parent_row["additional_notes"],
            "favorite_color": parent_row["favorite_color"],
            "favorite_subject": parent_row["favorite_subject"],
            "favorite_animal": parent_row["favorite_animal"],
            "hobbies": parent_row["hobbies"],
            "personality_observations": parent_row["personality_observations"],
        }

    # ── VARK profile ──
    vark_keys = [
        ("visual", ["vark_visual", "visual_score"]),
        ("auditory", ["vark_auditory", "auditory_score"]),
        ("reading", ["vark_reading", "reading_score"]),
        ("kinesthetic", ["vark_kinesthetic", "kinesthetic_score"]),
    ]
    vark_profile = {}
    for dim, candidates in vark_keys:
        for key in candidates:
            val = profile.get(key, 0)
            if val:
                vark_profile[dim] = val
                break
        else:
            vark_profile[dim] = 0

    # ── Assessment history (last 15) ──
    assessment_rows = await pool.fetch(
        """
        SELECT a.score, a.theta_after, a.taken_at, ci.title, ci.subject
        FROM assessments a
        JOIN sessions s ON a.session_id = s.id
        JOIN content_items ci ON s.content_id = ci.id
        WHERE a.student_id = $1
        ORDER BY a.taken_at DESC LIMIT 15
        """,
        student_id,
    )
    assessment_history = [
        {
            "title": r["title"],
            "subject": r["subject"],
            "score": round(float(r["score"] or 0), 2),
            "theta": round(float(r["theta_after"] or 0), 2),
            "date": r["taken_at"].isoformat() if r["taken_at"] else None,
        }
        for r in assessment_rows
    ]

    # ── Derived metrics (computed server-side, not by LLM) ──
    dispersion_index = compute_dispersion_index(irt_scores)
    bartle_type = infer_bartle_type(gamification, telemetry, profile)

    return {
        "student_name": user["name"] or user["email"].split("@")[0].capitalize(),
        "grade_level": user["grade_level"] or 3,
        "irt_scores": irt_scores,
        "telemetry": telemetry,
        "vark_profile": vark_profile,
        "gamification": gamification,
        "parent_context": parent_context,
        "dispersion_index": dispersion_index,
        "inferred_bartle_type": bartle_type,
        "assessment_history": assessment_history,
        "learning_tags": profile.get("learning_tags", []),
        "preferred_modality": profile.get("preferred_modality", "text"),
        "ability_estimate": profile.get("ability_estimate", 0.0),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Derived Metrics (deterministic — not delegated to LLM)
# ─────────────────────────────────────────────────────────────────────────────

def compute_dispersion_index(irt_scores: dict) -> float:
    """
    Variance-based dispersion index.
    Low variance → Scanner (0.0), high variance → Diver (1.0).
    """
    if len(irt_scores) < 2:
        return 0.5

    thetas = [s["avg_theta"] for s in irt_scores.values()]
    mean = sum(thetas) / len(thetas)
    variance = sum((t - mean) ** 2 for t in thetas) / len(thetas)

    index = 1.0 - math.exp(-2.0 * variance)
    return round(min(1.0, max(0.0, index)), 2)


def infer_bartle_type(gamification: dict, telemetry: dict, profile: dict) -> str:
    """
    Infer Bartle player type from behavioral signals.
    Each signal adds to a score; highest wins.
    """
    scores = {"achiever": 0.1, "explorer": 0.0, "socializer": 0.0, "challenger": 0.0}

    xp = gamification.get("xp", 0)
    max_streak = gamification.get("max_streak", 0)
    badge_count = len(gamification.get("badges", []))

    # ── Achiever: grind XP, long streaks, badge collector ──
    if xp > 300:
        scores["achiever"] += 0.3
    if max_streak >= 5:
        scores["achiever"] += 0.3
    if badge_count >= 3:
        scores["achiever"] += 0.2

    # ── Explorer: multi-modal, many sessions, visual learner ──
    modality = profile.get("preferred_modality", "text")
    tags = profile.get("learning_tags", [])
    if modality == "visual":
        scores["explorer"] += 0.3
    if len(tags) >= 3:
        scores["explorer"] += 0.2
    if telemetry.get("total_sessions", 0) >= 10:
        scores["explorer"] += 0.2

    # ── Socializer: leaderboard focus, group tags ──
    grade_rank = gamification.get("grade_rank")
    if grade_rank and grade_rank <= 5:
        scores["socializer"] += 0.3
    tag_text = " ".join(tags).lower()
    if any(kw in tag_text for kw in ["collaborative", "social", "team"]):
        scores["socializer"] += 0.3

    # ── Challenger: high frustration tolerance + high ability ──
    frustration = telemetry.get("frustration_events", 0)
    attention = telemetry.get("avg_attention_score", 0.5)
    if frustration > 5 and attention > 0.6:
        scores["challenger"] += 0.4
    ability = profile.get("ability_estimate", 0.0)
    if ability > 1.0:
        scores["challenger"] += 0.3

    return max(scores, key=scores.get)


# ─────────────────────────────────────────────────────────────────────────────
# Report Generation
# ─────────────────────────────────────────────────────────────────────────────

async def generate_orientation_report(student_id: UUID) -> dict:
    """
    Main entry point.
    1. Aggregate all data sources
    2. Call Gemini with structured output (OrientationReportSchema)
    3. Return the validated report dict
    """
    context = await aggregate_student_data(student_id)

    llm = get_llm()
    structured_llm = llm.with_structured_output(OrientationReportSchema)

    context_json = json.dumps(context, ensure_ascii=False, default=str)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=(
            "Generate an orientation report for this student. "
            "Analyze ALL data sources provided and cross-reference them "
            "to identify the cognitive archetype, dispersion axis, and "
            "personalized reward suggestions.\n\n"
            f"## Student Data\n```json\n{context_json}\n```"
        )),
    ]

    logger.info("Generating orientation report for student %s", student_id)

    result = await structured_llm.ainvoke(messages)

    if isinstance(result, OrientationReportSchema):
        report_dict = result.model_dump()
    else:
        report_dict = result

    report_dict["_input_context"] = context

    logger.info(
        "Orientation report generated: archetype=%s, dispersion=%s, bartle=%s",
        report_dict.get("archetype", {}).get("primary"),
        report_dict.get("dispersion", {}).get("type"),
        report_dict.get("psychometric_summary", {}).get("bartle_type"),
    )

    return report_dict
