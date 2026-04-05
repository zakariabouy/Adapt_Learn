from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from shared.database import get_pool
from routers.auth import get_current_user
from uuid import uuid4
import datetime

router = APIRouter(prefix="/content", tags=["Content"])

@router.post("/upload")
async def upload_content(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    # Validate file type
    if not (file.filename.endswith(".md") or file.filename.endswith(".txt")):
        raise HTTPException(status_code=400, detail="Only .md or .txt files are allowed.")
    
    # Check if user is a teacher
    if current_user["role"] != "teacher":
         raise HTTPException(status_code=403, detail="Only teachers can upload content.")

    content = await file.read()
    text_content = content.decode("utf-8")
    
    pool = await get_pool()
    content_id = uuid4()
    
    await pool.execute(
        "INSERT INTO content_items (id, title, original_text, teacher_id, created_at) VALUES ($1, $2, $3, $4, $5)",
        content_id, file.filename, text_content, current_user["id"], datetime.datetime.now()
    )
    
    return {"id": content_id, "title": file.filename, "status": "uploaded"}

@router.get("/list")
async def list_content(current_user = Depends(get_current_user)):
    pool = await get_pool()
    rows = await pool.fetch("SELECT id, title, subject, grade_level FROM content_items ORDER BY created_at DESC")
    return [dict(row) for row in rows]

@router.get("/teacher/dashboard/stats")
async def get_teacher_stats(current_user = Depends(get_current_user)):
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Forbidden")

    pool = await get_pool()

    student_count = await pool.fetchval(
        "SELECT COUNT(*) FROM teacher_student_link WHERE teacher_id = $1",
        current_user["id"]
    )
    content_count = await pool.fetchval(
        "SELECT COUNT(*) FROM content_items WHERE teacher_id = $1",
        current_user["id"]
    )
    # Students with ability < -0.5 are considered at-risk
    risk_alerts = await pool.fetchval(
        """
        SELECT COUNT(*) FROM learner_profiles lp
        JOIN teacher_student_link tsl ON lp.student_id = tsl.student_id
        WHERE tsl.teacher_id = $1
          AND (lp.profile_data->>'ability_estimate')::float < -0.5
        """,
        current_user["id"]
    )
    # Sessions started in last hour with no end time
    active_sessions = await pool.fetchval(
        "SELECT COUNT(*) FROM sessions WHERE started_at > NOW() - INTERVAL '1 hour' AND ended_at IS NULL"
    )

    return {
        "student_count": student_count or 0,
        "content_count": content_count or 0,
        "active_sessions": active_sessions or 0,
        "risk_alerts": risk_alerts or 0
    }
