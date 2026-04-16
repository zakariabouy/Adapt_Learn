import os
import json
import logging
from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime, timedelta

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

from shared.database import get_pool
from shared.guardrails import run_output_guardrails, check_content_safety, log_guardrail_event

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


async def _gather_student_history(student_id: UUID) -> Dict[str, Any]:
    """
    Aggregates ALL historical data for a student across their entire journey.
    This is the core data that makes orientation reports valuable:
    the more years of data, the more reliable the guidance.
    """
    pool = await get_pool()

    # --- Basic info ---
    user_row = await pool.fetchrow(
        "SELECT name, email, created_at FROM users WHERE id = $1", student_id
    )
    student_name = "Unknown"
    months_on_platform = 0
    if user_row:
        student_name = (
            user_row["name"]
            if user_row["name"]
            else user_row["email"].split("@")[0].capitalize()
        )
        months_on_platform = max(
            1,
            (datetime.now() - user_row["created_at"].replace(tzinfo=None)).days // 30,
        )

    # --- Learning profile ---
    profile_row = await pool.fetchrow(
        "SELECT profile_data FROM learner_profiles WHERE student_id = $1", student_id
    )
    profile = json.loads(profile_row["profile_data"]) if profile_row else {}

    # --- All assessments (entire history) ---
    assessments = await pool.fetch(
        """
        SELECT a.score, a.theta_before, a.theta_after, a.responses,
               a.taken_at, ci.subject, ci.title
        FROM assessments a
        LEFT JOIN sessions s ON a.session_id = s.id
        LEFT JOIN content_items ci ON s.content_id = ci.id
        WHERE a.student_id = $1
        ORDER BY a.taken_at ASC
        """,
        student_id,
    )

    # --- Performance by subject ---
    subject_performance: Dict[str, List[float]] = {}
    ability_over_time: List[Dict[str, Any]] = []

    for a in assessments:
        subj = a["subject"] or "General"
        score = a["score"] if a["score"] is not None else 0.0
        if subj not in subject_performance:
            subject_performance[subj] = []
        subject_performance[subj].append(score)

        ability_over_time.append({
            "date": a["taken_at"].strftime("%Y-%m-%d") if a["taken_at"] else "N/A",
            "theta": float(a["theta_after"]) if a["theta_after"] else 0.0,
            "subject": subj,
        })

    # Compute averages per subject
    subject_averages = {
        subj: round(sum(scores) / len(scores) * 100, 1)
        for subj, scores in subject_performance.items()
    }

    # --- Session engagement data ---
    sessions = await pool.fetch(
        """
        SELECT s.telemetry_summary, s.started_at, s.ended_at, ci.subject
        FROM sessions s
        LEFT JOIN content_items ci ON s.content_id = ci.id
        WHERE s.student_id = $1 AND s.ended_at IS NOT NULL
        ORDER BY s.started_at ASC
        """,
        student_id,
    )

    total_study_minutes = 0.0
    subject_engagement: Dict[str, List[float]] = {}

    for s in sessions:
        if s["started_at"] and s["ended_at"]:
            duration = (
                s["ended_at"].replace(tzinfo=None)
                - s["started_at"].replace(tzinfo=None)
            ).total_seconds() / 60.0
            total_study_minutes += duration

        summary = s["telemetry_summary"] or {}
        if isinstance(summary, str):
            summary = json.loads(summary)

        subj = s["subject"] or "General"
        frustration = summary.get("current_frustration_level", 0.5)
        engagement = 1.0 - frustration

        if subj not in subject_engagement:
            subject_engagement[subj] = []
        subject_engagement[subj].append(engagement)

    # Average engagement per subject
    engagement_by_subject = {
        subj: round(sum(vals) / len(vals) * 100, 1)
        for subj, vals in subject_engagement.items()
    }

    # --- Mastery data from profile ---
    mastery_by_topic = profile.get("mastery_by_topic", {})

    # --- Identify strengths and weaknesses ---
    all_subjects = set(subject_averages.keys()) | set(engagement_by_subject.keys())
    subject_scores = {}
    for subj in all_subjects:
        perf = subject_averages.get(subj, 50.0)
        eng = engagement_by_subject.get(subj, 50.0)
        # Combined score: 60% performance + 40% engagement
        subject_scores[subj] = round(perf * 0.6 + eng * 0.4, 1)

    sorted_subjects = sorted(subject_scores.items(), key=lambda x: x[1], reverse=True)
    strengths = [s[0] for s in sorted_subjects[:3] if s[1] >= 50]
    weaknesses = [s[0] for s in sorted_subjects if s[1] < 40]

    return {
        "student_name": student_name,
        "months_on_platform": months_on_platform,
        "learning_tags": profile.get("learning_tags", []),
        "tag_strength": profile.get("tag_strength", {}),
        "preferred_modality": profile.get("preferred_modality", "text"),
        "current_ability": profile.get("ability_estimate", 0.0),
        "total_assessments": len(assessments),
        "total_study_minutes": round(total_study_minutes, 1),
        "subject_averages": subject_averages,
        "engagement_by_subject": engagement_by_subject,
        "subject_combined_scores": subject_scores,
        "mastery_by_topic": mastery_by_topic,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "ability_over_time": ability_over_time[-20:],  # last 20 data points
    }


def _build_orientation_prompt(history: Dict[str, Any]) -> str:
    return f"""You are an expert child education counselor specialized in primary school orientation.

Based on the following longitudinal data for a student, generate a comprehensive orientation report.

STUDENT: {history['student_name']}
TIME ON PLATFORM: {history['months_on_platform']} months

LEARNING PROFILE:
- Learning style tags: {history['learning_tags']}
- Tag strengths: {history['tag_strength']}
- Preferred modality: {history['preferred_modality']}
- Current ability estimate (IRT): {history['current_ability']:.2f}

ACADEMIC PERFORMANCE:
- Total assessments taken: {history['total_assessments']}
- Total study time: {history['total_study_minutes']:.0f} minutes
- Performance by subject (avg score %): {json.dumps(history['subject_averages'])}
- Engagement by subject (avg %): {json.dumps(history['engagement_by_subject'])}
- Combined scores (60% performance + 40% engagement): {json.dumps(history['subject_combined_scores'])}
- Topic mastery: {json.dumps(history['mastery_by_topic'])}

IDENTIFIED STRENGTHS: {history['strengths']}
IDENTIFIED WEAKNESSES: {history['weaknesses']}

ABILITY PROGRESSION OVER TIME:
{json.dumps(history['ability_over_time'][-10:])}

Generate an orientation report in Markdown with these sections:

## Student Profile Summary
A warm, encouraging 2-3 sentence overview of who this student is as a learner.

## Academic Strengths
What subjects and skills does this student excel at? Be specific with data.

## Areas for Growth
Where can this student improve? Frame positively — "opportunities" not "weaknesses".

## Learning Style Insights
Based on their learning tags and engagement patterns, what teaching approaches work best for them?

## Recommended Academic Paths
Based on ALL the accumulated data, suggest 2-3 academic/career directions this student shows natural aptitude for.
Examples: STEM, Arts, Languages, Social Sciences, Sports/Physical, Technology, etc.
Be specific about WHY each path fits based on the data.

## Recommendations for Parents & Teachers
3-5 actionable recommendations to support this student's development.

## Confidence Level
State how confident this assessment is based on data volume:
- Less than 3 months data: "Preliminary — more data needed"
- 3-12 months: "Developing — patterns are emerging"
- 1-3 years: "Reliable — consistent patterns observed"
- 3+ years: "High confidence — strong longitudinal evidence"

IMPORTANT:
- Be encouraging and positive — this is about a child
- Use simple language that parents can understand
- Base ALL recommendations on the actual data provided
- Never make medical or psychological diagnoses
- If data is limited, say so honestly
"""


async def generate_orientation_report(
    student_id: UUID, teacher_id: UUID
) -> Dict[str, Any]:
    """
    Main entry point: generates an orientation report for a student.
    Called by the teacher route (Adam builds the route).
    """
    # 1. Gather all historical data
    history = await _gather_student_history(student_id)

    # 2. Generate report via Gemini
    prompt = _build_orientation_prompt(history)

    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        markdown_report = response.content

        # ── Output guardrails ──
        output_check = await run_output_guardrails(
            markdown_report, endpoint="orientation/report"
        )
        markdown_report = output_check["filtered_text"]

        if not output_check["safe"]:
            await log_guardrail_event(
                event_type="content_safety",
                severity="warning",
                action_taken="filtered",
                endpoint="orientation/report",
                output_snippet=markdown_report[:500],
                details={"issues": output_check["issues"]},
            )
    except Exception as e:
        logger.error(
            "Gemini orientation report failed for student %s: %s", student_id, e
        )
        markdown_report = (
            "# Orientation Report\n\n"
            "Unable to generate report at this time. Please try again later."
        )

    # 3. Store in DB for future reference
    pool = await get_pool()
    report_id = await pool.fetchval(
        """
        INSERT INTO iep_reports (student_id, teacher_id, report_data, week)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """,
        student_id,
        teacher_id,
        json.dumps({
            "type": "orientation",
            "markdown": markdown_report,
            "data_summary": {
                "strengths": history["strengths"],
                "weaknesses": history["weaknesses"],
                "subject_scores": history["subject_combined_scores"],
                "months_tracked": history["months_on_platform"],
            },
        }),
        f"orientation-{datetime.now().strftime('%Y-%m-%d')}",
    )

    return {
        "id": str(report_id),
        "markdown": markdown_report,
        "student_name": history["student_name"],
        "data_summary": {
            "strengths": history["strengths"],
            "weaknesses": history["weaknesses"],
            "subject_scores": history["subject_combined_scores"],
            "total_assessments": history["total_assessments"],
            "months_on_platform": history["months_on_platform"],
            "total_study_minutes": history["total_study_minutes"],
        },
    }
