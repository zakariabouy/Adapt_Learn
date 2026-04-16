import os
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from shared.models import User, Role
from routers.auth import get_current_user
from shared.database import get_pool
from agents.iep.agent import generate_iep_report
from orchestrator.graph import generate_orientation_via_graph
from shared.pending import enqueue_pending_action
from uuid import UUID
import json
from datetime import datetime, timedelta


class LinkStudentRequest(BaseModel):
    student_email: EmailStr

router = APIRouter(prefix="/teacher", tags=["Teacher"])

async def get_current_teacher(current_user = Depends(get_current_user)):
    if current_user["role"] != Role.teacher.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges",
        )
    return current_user

@router.post("/link-student")
async def link_student(request: LinkStudentRequest, current_teacher = Depends(get_current_teacher)):
    """Links a student to the current teacher by student email."""
    pool = await get_pool()
    student = await pool.fetchrow(
        "SELECT id FROM users WHERE email = $1 AND role = 'student'",
        request.student_email
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    await pool.execute(
        "INSERT INTO teacher_student_link (teacher_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        current_teacher["id"], student["id"]
    )
    return {"status": "linked", "student_id": str(student["id"])}


@router.get("/students")
async def get_teacher_students(current_teacher = Depends(get_current_teacher)):
    pool = await get_pool()
    
    students = await pool.fetch(
        """
        SELECT u.id, u.name, u.email, u.grade_level, lp.profile_data,
               (SELECT MAX(started_at) FROM sessions WHERE student_id = u.id) as last_active,
               (SELECT COUNT(DISTINCT content_id) FROM sessions WHERE student_id = u.id AND ended_at IS NOT NULL) as modules_completed
        FROM users u
        JOIN teacher_student_link tsl ON u.id = tsl.student_id
        LEFT JOIN learner_profiles lp ON u.id = lp.student_id
        WHERE tsl.teacher_id = $1 AND u.role = 'student'
        ORDER BY u.grade_level, u.name
        """,
        current_teacher["id"]
    )

    result = []
    for s in students:
        profile = json.loads(s["profile_data"]) if s["profile_data"] else {}
        ability = profile.get("ability_estimate", 0.0)

        risk_level = "low"
        if ability < -1.5:
            risk_level = "high"
        elif ability < -0.5:
            risk_level = "medium"

        result.append({
            "id": s["id"],
            "name": s["name"] or s["email"].split("@")[0].capitalize(),
            "email": s["email"],
            "grade_level": s["grade_level"],
            "learning_tags": profile.get("learning_tags", []),
            "lastActive": s["last_active"].isoformat() if s["last_active"] else "Never",
            "riskLevel": risk_level,
            "modulesCompleted": s["modules_completed"] or 0,
            "ability": round(ability, 2),
        })
        
    return result

@router.get("/stats")
async def get_cohort_stats(current_teacher = Depends(get_current_teacher)):
    """Returns aggregate stats for the teacher's cohort."""
    pool = await get_pool()
    
    # Total students
    total_students = await pool.fetchval(
        "SELECT COUNT(*) FROM teacher_student_link WHERE teacher_id = $1",
        current_teacher["id"]
    )
    
    # Average engagement (from last 7 days sessions)
    avg_engagement = await pool.fetchval(
        """
        SELECT AVG((telemetry_summary->>'engagement_score')::float) 
        FROM sessions s
        JOIN teacher_student_link tsl ON s.student_id = tsl.student_id
        WHERE tsl.teacher_id = $1 AND s.started_at >= NOW() - INTERVAL '7 days'
        """,
        current_teacher["id"]
    )
    
    # Risk count
    risk_count = 0
    students = await pool.fetch(
        "SELECT profile_data FROM learner_profiles lp JOIN teacher_student_link tsl ON lp.student_id = tsl.student_id WHERE tsl.teacher_id = $1",
        current_teacher["id"]
    )
    for s in students:
        p = json.loads(s["profile_data"])
        if p.get("ability_estimate", 0) < -1.0:
            risk_count += 1

    # Hourly trend for impact analysis
    rows = await pool.fetch(
        """
        SELECT
            to_char(date_trunc('hour', s.started_at), 'HH24:MI') AS hour_label,
            ROUND(
                AVG(
                    (s.telemetry_summary->>'current_frustration_level')::float
                ) * 100
            )::int AS avg_frustration,
            ROUND(
                (1.0 - AVG(
                    (s.telemetry_summary->>'current_frustration_level')::float
                )) * 100
            )::int AS avg_engagement
        FROM sessions s
        JOIN teacher_student_link tsl ON s.student_id = tsl.student_id
        WHERE tsl.teacher_id = $1
            AND s.started_at >= NOW() - INTERVAL '7 days'
            AND s.ended_at IS NOT NULL
            AND s.telemetry_summary IS NOT NULL
        GROUP BY date_trunc('hour', s.started_at)
        ORDER BY date_trunc('hour', s.started_at)
        """,
        current_teacher["id"]
    )

    trend = [
        {
            "time": r["hour_label"],
            "frustration": r["avg_frustration"],
            "engagement": r["avg_engagement"]
        }
        for r in rows
    ]

    if not trend:
        trend = [{"time": "No data", "frustration": 0, "engagement": 0}]

    avg_display = round(avg_engagement * 100) if avg_engagement is not None else None

    pending_reviews = await pool.fetchval(
        "SELECT COUNT(*) FROM pending_actions WHERE teacher_id = $1 AND status = 'pending'",
        current_teacher["id"]
    )

    return {
        "totalStudents": total_students or 0,
        "avgEngagement": avg_display,
        "riskAlerts": risk_count,
        "performanceTrend": trend,
        "pendingReviews": pending_reviews or 0,
    }

@router.get("/student/{student_id}/growth")
async def get_student_growth(student_id: UUID, current_teacher = Depends(get_current_teacher)):
    """Returns historical ability estimate data for a specific student."""
    pool = await get_pool()
    
    # Verify link
    link = await pool.fetchrow(
        "SELECT 1 FROM teacher_student_link WHERE teacher_id = $1 AND student_id = $2",
        current_teacher["id"], student_id
    )
    if not link:
        raise HTTPException(status_code=403, detail="Student not linked to this teacher")
        
    assessments = await pool.fetch(
        """
        SELECT taken_at, theta_after
        FROM assessments
        WHERE student_id = $1
        ORDER BY taken_at ASC
        """,
        student_id
    )
    
    growth_data = [
        {
            "date": a["taken_at"].strftime("%m/%d %H:%M"),
            "ability": round(float(a["theta_after"]), 2)
        } for a in assessments
    ]
    
    if not growth_data:
        return [{"date": "No data", "ability": 0.0}]
    
    return growth_data

@router.get("/reports/{student_id}")
async def get_student_report(student_id: UUID, current_teacher = Depends(get_current_teacher)):
    """Generates an IEP report and enqueues it for HITL review."""
    pool = await get_pool()

    # Verify link
    link = await pool.fetchrow(
        "SELECT 1 FROM teacher_student_link WHERE teacher_id = $1 AND student_id = $2",
        current_teacher["id"], student_id
    )
    if not link:
        raise HTTPException(status_code=403, detail="Student not linked to this teacher")

    # Trigger IEP Agent to generate report
    try:
        report = await generate_iep_report(student_id, current_teacher["id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"IEP generation failed: {str(e)}")

    # Enqueue into the HITL review queue instead of returning directly
    pending = await enqueue_pending_action(
        action_type="iep_report",
        teacher_id=current_teacher["id"],
        payload={
            "student_name": report.get("stats", {}).get("student_name", "Unknown"),
            "week": datetime.now().strftime("%Y-W%W"),
            "auto_generated": True,
            "markdown": report["markdown"],
            "stats_summary": report.get("stats", {}),
            "pdf_path": report.get("pdf_path"),
        },
        student_id=student_id,
    )

    return {
        "status": "pending_review",
        "pending_id": pending["id"],
        "message": "IEP report generated — awaiting teacher approval in the review desk.",
        "report_preview": report["markdown"][:500] + "…" if len(report["markdown"]) > 500 else report["markdown"],
    }

@router.get("/student/{student_id}/orientation")
async def get_student_orientation(student_id: UUID, current_teacher = Depends(get_current_teacher)):
    """Generates a long-term orientation/career guidance report for a student."""
    pool = await get_pool()
    
    # 1. Verify link
    link = await pool.fetchrow(
        "SELECT 1 FROM teacher_student_link WHERE teacher_id = $1 AND student_id = $2",
        current_teacher["id"], student_id
    )
    if not link:
        raise HTTPException(status_code=403, detail="Student not linked to this teacher")
    
    # 2. Get Student Profile
    profile_row = await pool.fetchrow(
        "SELECT profile_data FROM learner_profiles WHERE student_id = $1",
        student_id
    )
    if not profile_row:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    learner_model = json.loads(profile_row["profile_data"])
    
    # 3. Trigger Orientation Agent via Orchestrator
    try:
        report = await generate_orientation_via_graph(learner_model, str(current_teacher["id"]))

        # 4. HITL gate: orientation reports go to parents — teacher must
        # review the AI output before it is finalized and sent.
        pending = await enqueue_pending_action(
            action_type="orientation_report",
            teacher_id=current_teacher["id"],
            payload={"report": report},
            student_id=student_id,
        )

        return {
            "status": "pending_review",
            "pending_id": pending["id"],
            "message": "Orientation report generated — awaiting teacher approval.",
            "report_preview": report,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Orientation generation failed: {str(e)}")
