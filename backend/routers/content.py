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
