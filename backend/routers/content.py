from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from shared.database import get_pool
from routers.auth import get_current_user
from uuid import uuid4
import datetime
import json
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

router = APIRouter(prefix="/content", tags=["Content"])

_llm = None

def get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"))
    return _llm

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
    
    # --- AI Analysis Phase ---
    prompt = f"""
    Analyze the following educational content and extract metadata.
    Content:
    {text_content[:2000]}
    
    Tasks:
    1. Identify the subject (e.g., Biology, Math, History).
    2. Estimate the target grade level (integer).
    3. Generate 5 IRT-calibrated quiz questions. 
       - Each question needs a difficulty (theta) between -3.0 and 3.0.
       - Each question needs 4 options (A, B, C, D) and a correct_id.
       - Include a helpful hint and a clear explanation.
    
    Return a JSON object with:
    {{
      "subject": "string",
      "grade_level": int,
      "topic": "string",
      "questions": [
        {{
          "text": "string",
          "options": [{{"id": "A", "label": "..."}}, ...],
          "correct_id": "A",
          "difficulty": float,
          "hint": "string",
          "explanation": "string"
        }}
      ]
    }}
    """
    
    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        # Clean potential markdown backticks
        raw_json = response.content.strip()
        if "```json" in raw_json:
            raw_json = raw_json.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_json:
            raw_json = raw_json.split("```")[1].split("```")[0].strip()
            
        ai_data = json.loads(raw_json)
    except Exception as e:
        print(f"AI Content Parsing Error: {e}")
        ai_data = {
            "subject": "General",
            "grade_level": 5,
            "topic": file.filename,
            "questions": []
        }

    pool = await get_pool()
    content_id = uuid4()
    
    # 1. Save Content Item
    await pool.execute(
        "INSERT INTO content_items (id, title, original_text, teacher_id, created_at, subject, grade_level) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        content_id, file.filename, text_content, current_user["id"], datetime.datetime.now(),
        ai_data.get("subject"), ai_data.get("grade_level")
    )
    
    # 2. Seed Question Bank
    for q in ai_data.get("questions", []):
        try:
            await pool.execute(
                """INSERT INTO question_bank 
                   (id, content_id, subject, topic, difficulty, question_text, options, correct_id, hint, explanation) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
                str(uuid4()), content_id, ai_data.get("subject"), ai_data.get("topic"), 
                q["difficulty"], q["text"], json.dumps(q["options"]), q["correct_id"], 
                q["hint"], q["explanation"]
            )
        except Exception as e:
            print(f"Failed to seed AI question: {e}")
    
    return {
        "id": content_id, 
        "title": file.filename, 
        "subject": ai_data.get("subject"),
        "questions_generated": len(ai_data.get("questions", [])),
        "status": "processed"
    }

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
