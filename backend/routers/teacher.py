import os
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from shared.models import User, Role
from routers.auth import get_current_user
from shared.database import get_pool
from agents.iep.agent import generate_iep_report
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
        SELECT u.id, u.email, lp.profile_data, 
               (SELECT MAX(started_at) FROM sessions WHERE student_id = u.id) as last_active,
               (SELECT COUNT(DISTINCT content_id) FROM sessions WHERE student_id = u.id AND ended_at IS NOT NULL) as modules_completed
        FROM users u
        JOIN teacher_student_link tsl ON u.id = tsl.student_id
        LEFT JOIN learner_profiles lp ON u.id = lp.student_id
        WHERE tsl.teacher_id = $1 AND u.role = 'student'
        """,
        current_teacher["id"]
    )
    
    result = []
    for s in students:
        profile = json.loads(s["profile_data"]) if s["profile_data"] else {}
        ability = profile.get("ability_estimate", 0.0)
        
        # Risk level calculation based on ability
        risk_level = "low"
        if ability < -1.5:
            risk_level = "high"
        elif ability < -0.5:
            risk_level = "medium"
            
        result.append({
            "id": s["id"],
            "name": s["email"].split("@")[0].capitalize(),
            "email": s["email"],
            "lastActive": s["last_active"].isoformat() if s["last_active"] else "Never",
            "riskLevel": risk_level,
            "modulesCompleted": s["modules_completed"] or 0,
            "ability": round(ability, 2)
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
    
    # Average engagement (from last 24h sessions)
    yesterday = datetime.now() - timedelta(days=1)
    avg_engagement = await pool.fetchval(
        """
        SELECT AVG((telemetry_summary->>'engagement_score')::float) 
        FROM sessions s
        JOIN teacher_student_link tsl ON s.student_id = tsl.student_id
        WHERE tsl.teacher_id = $1 AND s.started_at >= $2
        """,
        current_teacher["id"], yesterday
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

    # Hourly trend for impact analysis (mocking structure from real data)
    # In a real app, we'd group sessions by hour
    trend = [
        {"time": "08:00", "frustration": 20, "engagement": 75},
        {"time": "10:00", "frustration": 45, "engagement": 60},
        {"time": "12:00", "frustration": 30, "engagement": 85},
        {"time": "14:00", "frustration": 15, "engagement": 90},
        {"time": "16:00", "frustration": 10, "engagement": 95},
    ]

    return {
        "totalStudents": total_students or 0,
        "avgEngagement": round((avg_engagement or 0.85) * 100),
        "riskAlerts": risk_count,
        "performanceTrend": trend
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
        "SELECT taken_at, ability_after FROM assessments WHERE student_id = $1 ORDER BY taken_at ASC",
        student_id
    )
    
    growth_data = [
        {
            "date": a["taken_at"].strftime("%m/%d"),
            "ability": round(a["ability_after"], 2)
        } for a in assessments
    ]
    
    return growth_data

@router.get("/reports/{student_id}")
async def get_student_report(student_id: UUID, current_teacher = Depends(get_current_teacher)):
    # Trigger IEP Agent to generate report
    report = await generate_iep_report(student_id, current_teacher["id"])
    
    # Check if PDF was generated successfully
    pdf_path = report.get("pdf_path")
    if pdf_path and os.path.exists(pdf_path):
        return FileResponse(
            pdf_path, 
            media_type="application/pdf", 
            filename=f"IEP_Report_{student_id}.pdf"
        )
    
    # Fallback to markdown if PDF generation failed
    return {"markdown": report["markdown"]}
