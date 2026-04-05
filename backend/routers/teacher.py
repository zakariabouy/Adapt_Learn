import os
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from shared.models import User, Role
from routers.auth import get_current_user
from shared.database import get_pool
from agents.iep.agent import generate_iep_report
from uuid import UUID
import json

router = APIRouter(prefix="/teacher", tags=["Teacher"])

async def get_current_teacher(current_user = Depends(get_current_user)):
    if current_user["role"] != Role.teacher.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges",
        )
    return current_user

@router.get("/students")
async def get_teacher_students(current_teacher = Depends(get_current_teacher)):
    pool = await get_pool()
    
    # Returning all students as no teacher-student mapping exists in schema yet
    students = await pool.fetch(
        """
        SELECT u.id, u.email, lp.profile_data, 
               (SELECT MAX(started_at) FROM sessions WHERE student_id = u.id) as last_active,
               (SELECT COUNT(DISTINCT content_id) FROM sessions WHERE student_id = u.id AND ended_at IS NOT NULL) as modules_completed
        FROM users u
        LEFT JOIN learner_profiles lp ON u.id = lp.student_id
        WHERE u.role = 'student'
        """
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
