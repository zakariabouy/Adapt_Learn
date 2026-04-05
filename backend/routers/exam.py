from fastapi import APIRouter, Depends, HTTPException
from shared.database import get_pool
from routers.auth import get_current_user
from routers.teacher import get_current_teacher
from orchestrator.graph import generate_exam_via_graph
from pydantic import BaseModel
from uuid import UUID
import json

router = APIRouter(prefix="/exam", tags=["Exams"])

class ExamGenerateRequest(BaseModel):
    student_id: UUID
    content_id: UUID
    grade_level: int = 3

@router.post("/generate")
async def generate_exam(request: ExamGenerateRequest, current_teacher = Depends(get_current_teacher)):
    """Generates a kid-appropriate exam for a student based on specific course content."""
    pool = await get_pool()
    
    # 1. Verify student is linked to this teacher
    link = await pool.fetchrow(
        "SELECT 1 FROM teacher_student_link WHERE teacher_id = $1 AND student_id = $2",
        current_teacher["id"], request.student_id
    )
    if not link:
        raise HTTPException(status_code=403, detail="Student not linked to this teacher")
    
    # 2. Verify content exists
    content = await pool.fetchrow(
        "SELECT id, title, original_text FROM content_items WHERE id = $1",
        request.content_id
    )
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # 3. Get student profile
    profile_row = await pool.fetchrow(
        "SELECT profile_data FROM learner_profiles WHERE student_id = $1",
        request.student_id
    )
    if not profile_row:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    learner_model = json.loads(profile_row["profile_data"])
    
    # 4. Trigger Orchestrator
    try:
        exam_data = await generate_exam_via_graph(
            learner_model=learner_model,
            content_id=str(request.content_id),
            grade_level=request.grade_level
        )
        
        if not exam_data:
             raise HTTPException(status_code=500, detail="Agent failed to generate exam data")
             
        return {
            "student_id": request.student_id,
            "content_title": content["title"],
            "exam": exam_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Exam generation failed: {str(e)}")
