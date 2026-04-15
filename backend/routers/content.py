import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from shared.database import get_pool
from shared.rag import embed_and_store_content, retrieve_relevant_chunks, reembed_all_content
from routers.auth import get_current_user
from uuid import uuid4, UUID
import datetime
import json
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

import io
import pdfplumber

logger = logging.getLogger(__name__)

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
    allowed_extensions = [".md", ".txt", ".pdf"]
    if not any(file.filename.endswith(ext) for ext in allowed_extensions):
        raise HTTPException(status_code=400, detail="Only .md, .txt or .pdf files are allowed.")
    
    # Check if user is a teacher
    if current_user["role"] != "teacher":
         raise HTTPException(status_code=403, detail="Only teachers can upload content.")

    if file.filename.endswith(".pdf"):
        content = await file.read()
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                text_content = "\n".join(page.extract_text() or "" for page in pdf.pages)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to extract text from PDF: {str(e)}")
    else:
        content = await file.read()
        text_content = content.decode("utf-8")
    
    if not text_content.strip():
         raise HTTPException(status_code=400, detail="File is empty or contains no readable text.")
    
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
        logger.warning("AI Content Parsing Error: %s", e)
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
            logger.warning("Failed to seed AI question: %s", e)
    
    # 3. RAG: chunk + embed content for semantic retrieval
    rag_meta = {"subject": ai_data.get("subject"), "grade_level": ai_data.get("grade_level")}
    chunks_stored = 0
    try:
        chunks_stored = await embed_and_store_content(content_id, text_content, rag_meta)
    except Exception as e:
        logger.warning("RAG embedding failed for content %s (non-blocking): %s", content_id, e)

    return {
        "id": content_id,
        "title": file.filename,
        "subject": ai_data.get("subject"),
        "questions_generated": len(ai_data.get("questions", [])),
        "rag_chunks": chunks_stored,
        "status": "processed"
    }

@router.get("/list")
async def list_content(current_user = Depends(get_current_user)):
    pool = await get_pool()
    if current_user["role"] == "teacher":
        rows = await pool.fetch(
            "SELECT id, title, subject, grade_level FROM content_items WHERE teacher_id = $1 ORDER BY created_at DESC",
            current_user["id"]
        )
    else:
        rows = await pool.fetch(
            """SELECT ci.id, ci.title, ci.subject, ci.grade_level
               FROM content_items ci
               JOIN teacher_student_link tsl ON ci.teacher_id = tsl.teacher_id
               WHERE tsl.student_id = $1
               ORDER BY ci.created_at DESC""",
            current_user["id"]
        )
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


# ---------------------------------------------------------------------------
# RAG endpoints
# ---------------------------------------------------------------------------


@router.get("/search")
async def semantic_search(
    q: str = Query(..., min_length=2, description="Search query"),
    content_id: Optional[str] = None,
    top_k: int = Query(default=5, ge=1, le=20),
    current_user=Depends(get_current_user),
):
    """
    Semantic search across the pedagogical knowledge base.
    Returns the most relevant content chunks ranked by cosine similarity.
    """
    cid = UUID(content_id) if content_id else None
    results = await retrieve_relevant_chunks(q, content_id=cid, top_k=top_k)

    # Stringify UUIDs for JSON serialization
    for r in results:
        r["content_id"] = str(r["content_id"])

    return {"query": q, "results": results}


@router.post("/reembed")
async def reembed_all(current_user=Depends(get_current_user)):
    """
    Re-embeds all content items. Teacher/admin only.
    Useful after model upgrade or initial migration to RAG.
    """
    if current_user["role"] not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teacher or admin access required")

    result = await reembed_all_content()
    return result
