from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from shared.models import LearnerModel, User
from routers.auth import get_current_user
from agents.profile.agent import get_student_profile, update_student_profile, generate_profile_summary
from agents.profile.game_profiler import process_game_result, get_available_games
from agents.adaptation.agent import chunk_content, transform_font, tts_convert, summarize_text, generate_visual_aid
from orchestrator.graph import adapt_content
from routers.gamification import _apply_xp
from shared.database import get_pool
from uuid import UUID
from pathlib import Path
import logging
import json
import hashlib

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/student", tags=["Student"])

@router.get("/profile", response_model=LearnerModel)
async def get_profile(current_user = Depends(get_current_user)):
    profile = await get_student_profile(current_user["id"])
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@router.post("/profile", response_model=LearnerModel)
async def update_profile(profile: LearnerModel, current_user = Depends(get_current_user)):
    if str(profile.student_id) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized to update this profile")

    updated_profile = await update_student_profile(current_user["id"], profile)

    # Invalidate adapted content cache so next workspace load re-generates with new profile
    pool = await get_pool()
    await pool.execute("DELETE FROM adapted_content WHERE student_id = $1", current_user["id"])

    return updated_profile

@router.get("/workspace/{content_id}")
async def get_adapted_workspace(
    content_id: UUID, 
    force_refresh: bool = Query(default=False),
    current_user = Depends(get_current_user)
):
    pool = await get_pool()
    
    # 1. Get Student Profile
    profile_record = await get_student_profile(current_user["id"])
    if not profile_record:
        raise HTTPException(status_code=404, detail="Student profile not found. Please complete onboarding.")
    
    # Convert Record to LearnerModel if it's not already (get_student_profile returns LearnerModel)
    profile = profile_record

    # 2. Check for cached adaptation (if not forced)
    # We use a hash of the profile's relevant settings to ensure cache hits/misses are accurate
    config_str = json.dumps({
        "preferred_font": profile.preferred_font,
        "preferred_modality": profile.preferred_modality,
        "learning_tags": profile.learning_tags,
        "tag_strength": profile.tag_strength
    }, sort_keys=True)
    
    if not force_refresh:
        cached = await pool.fetchrow(
            "SELECT adapted_text, adaptation_config FROM adapted_content WHERE content_id = $1 AND student_id = $2 AND md5(adaptation_config::text) = md5($3)",
            content_id, current_user["id"], config_str
        )
        
        if cached:
            title_row = await pool.fetchrow("SELECT title FROM content_items WHERE id = $1", content_id)
            return {
                "content_id": content_id,
                "title": title_row["title"] if title_row else None,
                "chunks": json.loads(cached["adapted_text"]),
                "css_config": await transform_font(profile),
                "cached": True
            }

    # 3. If not cached, generate adaptation
    content_item = await pool.fetchrow("SELECT title, original_text FROM content_items WHERE id = $1", content_id)
    if not content_item:
        raise HTTPException(status_code=404, detail="Content not found")

    original_text = content_item["original_text"]
    title = content_item["title"]

    # Simplify/Adapt using Orchestrator (passes content_id for RAG retrieval)
    adapted_text = await adapt_content(profile, original_text, content_id=str(content_id))

    # Chunking
    chunks = await chunk_content(adapted_text, profile.chunk_size or 500)

    # CSS Config
    css_config = await transform_font(profile)

    # 4. Upsert cache (avoids duplicate key errors on repeat loads)
    await pool.execute(
        """INSERT INTO adapted_content (content_id, student_id, adaptation_config, adapted_text)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (content_id, student_id, md5(adaptation_config::text))
           DO UPDATE SET adapted_text = EXCLUDED.adapted_text""",
        content_id, current_user["id"], config_str, json.dumps(chunks)
    )

    return {
        "content_id": content_id,
        "title": title,
        "chunks": chunks,
        "css_config": css_config,
        "cached": False
    }

@router.get("/workspace/{content_id}/summarize/{chunk_index}")
async def get_chunk_summary(
    content_id: UUID,
    chunk_index: int,
    current_user = Depends(get_current_user)
):
    """
    Returns a one-sentence AI summary for a specific chunk of content.
    """
    pool = await get_pool()
    
    # Get the latest adapted content for this student
    row = await pool.fetchrow(
        "SELECT adapted_text FROM adapted_content WHERE content_id = $1 AND student_id = $2 ORDER BY created_at DESC LIMIT 1",
        content_id, current_user["id"]
    )
    if not row:
        raise HTTPException(status_code=404, detail="Adapted content not found")
        
    chunks = json.loads(row["adapted_text"])
    if chunk_index < 0 or chunk_index >= len(chunks):
        raise HTTPException(status_code=400, detail="Invalid chunk index")
        
    summary = await summarize_text(chunks[chunk_index])
    return {"summary": summary}

@router.get("/workspace/{content_id}/visual/{chunk_index}")
async def get_chunk_visual(
    content_id: UUID,
    chunk_index: int,
    current_user = Depends(get_current_user)
):
    """
    Generates and returns an SVG visual aid for a specific chunk.
    """
    pool = await get_pool()
    
    row = await pool.fetchrow(
        "SELECT adapted_text FROM adapted_content WHERE content_id = $1 AND student_id = $2 ORDER BY created_at DESC LIMIT 1",
        content_id, current_user["id"]
    )
    if not row:
        raise HTTPException(status_code=404, detail="Adapted content not found")
        
    chunks = json.loads(row["adapted_text"])
    if chunk_index < 0 or chunk_index >= len(chunks):
        raise HTTPException(status_code=400, detail="Invalid chunk index")
        
    svg_code = await generate_visual_aid(chunks[chunk_index])
    return {"svg": svg_code}


class TTSRequest(BaseModel):
    text: str


@router.post("/audio/generate")
async def generate_audio(request: TTSRequest, current_user = Depends(get_current_user)):
    """
    Calls ElevenLabs TTS to synthesize the provided text for the current student.
    Returns the MP3 as a streaming file response, or a 503 if TTS is unavailable.
    """
    student_id = str(current_user["id"])

    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty")

    # tts_convert returns the file path on success, empty string on failure
    file_path = await tts_convert(request.text.strip(), student_id)

    if not file_path or not Path(file_path).exists():
        logger.warning("TTS generation failed or returned no file for student %s", student_id)
        raise HTTPException(
            status_code=503,
            detail="Audio synthesis unavailable. Check ElevenLabs API key configuration."
        )

    return FileResponse(
        path=file_path,
        media_type="audio/mpeg",
        filename=f"adaptlearn_{student_id[:8]}.mp3",
        headers={"Cache-Control": "no-store"}
    )


# ---------------------------------------------------------------------------
# Phase 3: Game Profiler, Profile Summary, Content Discovery
# ---------------------------------------------------------------------------

class GameResultRequest(BaseModel):
    game_type: str
    raw_score: float
    max_score: float
    time_spent_seconds: float
    max_time_seconds: float = 120.0


# XP awarded per game type (encourages variety)
_GAME_XP: dict = {
    "memory_cards": 20,
    "speed_tap": 15,
    "story_listen": 20,
    "pattern_match": 15,
    "reading_race": 25,
    "puzzle_solve": 20,
    "drag_and_sort": 15,
    "quiz": 10,
}


@router.post("/game-result")
async def submit_game_result(
    request: GameResultRequest,
    current_user=Depends(get_current_user),
):
    """
    Processes a completed game/interactive activity.
    Updates the student's learning profile tags via the Game Profiler agent,
    then awards XP proportional to their score.
    """
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students submit game results")

    student_id: UUID = current_user["id"]

    # 1. Run game profiler — updates learning tags in learner_profiles
    profiler_result = await process_game_result(
        student_id=student_id,
        game_type=request.game_type,
        raw_score=request.raw_score,
        max_score=request.max_score,
        time_spent_seconds=request.time_spent_seconds,
        max_time_seconds=request.max_time_seconds,
    )

    # 2. Award XP (base per game type, scaled by normalised score)
    base_xp = _GAME_XP.get(request.game_type, 10)
    normalised = profiler_result.get("score_normalized", 0.5)
    xp_earned = max(5, round(base_xp * (0.5 + normalised * 0.5)))  # at least 5 XP

    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            xp_result = await _apply_xp(
                conn,
                student_id,
                xp_earned,
                f"game_{request.game_type}",
            )

    return {
        **profiler_result,
        "xp_earned": xp_earned,
        "gamification": xp_result,
    }


@router.get("/games")
async def list_available_games(current_user=Depends(get_current_user)):
    """Returns all available game types and the learning tags they measure."""
    return get_available_games()


@router.get("/profile-summary")
async def get_profile_summary(current_user=Depends(get_current_user)):
    """
    Returns a kid-friendly profile description powered by Gemini.
    e.g. "You're a Visual Explorer! Your superpower is..."
    """
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students have a profile summary")
    return await generate_profile_summary(current_user["id"])


@router.get("/content")
async def list_content(
    subject: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    """
    Returns content items available to this student (filtered by their grade level).
    Optionally filter by subject.
    """
    pool = await get_pool()

    # Get student's grade level
    grade_row = await pool.fetchrow(
        "SELECT grade_level FROM users WHERE id = $1",
        current_user["id"],
    )
    grade_level = grade_row["grade_level"] if grade_row else None

    query = """
        SELECT ci.id, ci.title, ci.subject, ci.grade_level, ci.created_at,
               u.name AS teacher_name
        FROM content_items ci
        JOIN users u ON ci.teacher_id = u.id
        JOIN teacher_student_link tsl ON ci.teacher_id = tsl.teacher_id
        WHERE tsl.student_id = $1
    """
    params = [current_user["id"]]

    if subject:
        query += " AND ci.subject ILIKE $2"
        params.append(f"%{subject}%")

    query += " ORDER BY ci.created_at DESC"

    rows = await pool.fetch(query, *params)
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "subject": r["subject"],
            "grade_level": r["grade_level"],
            "teacher_name": r["teacher_name"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@router.get("/exams")
async def list_student_exams(current_user=Depends(get_current_user)):
    """Returns exams that have been approved by the teacher and assigned to this student."""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can view their exams")

    pool = await get_pool()

    # Check if the table exists (it's created on first approve)
    table_exists = await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_exams')"
    )
    if not table_exists:
        return []

    rows = await pool.fetch(
        """
        SELECT se.id, se.exam_data, se.status, se.assigned_at, se.completed_at,
               ci.title AS content_title, ci.subject
        FROM student_exams se
        LEFT JOIN content_items ci ON se.content_id = ci.id
        WHERE se.student_id = $1
        ORDER BY se.assigned_at DESC
        """,
        current_user["id"],
    )
    result = []
    for r in rows:
        exam_data = r["exam_data"]
        if isinstance(exam_data, str):
            exam_data = json.loads(exam_data)
        result.append({
            "id": str(r["id"]),
            "exam": exam_data,
            "content_title": r["content_title"],
            "subject": r["subject"],
            "status": r["status"],
            "assigned_at": r["assigned_at"].isoformat() if r["assigned_at"] else None,
            "completed_at": r["completed_at"].isoformat() if r["completed_at"] else None,
        })
    return result


class ExamAnswers(BaseModel):
    answers: dict  # {question_number: selected_option_id}


@router.post("/exams/{exam_id}/start")
async def start_exam(exam_id: UUID, current_user=Depends(get_current_user)):
    """Marks an exam as in_progress."""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can take exams")

    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id, status FROM student_exams WHERE id = $1 AND student_id = $2",
        exam_id, current_user["id"],
    )
    if not row:
        raise HTTPException(status_code=404, detail="Exam not found")
    if row["status"] == "completed":
        raise HTTPException(status_code=409, detail="Exam already completed")

    await pool.execute(
        "UPDATE student_exams SET status = 'in_progress', started_at = NOW() WHERE id = $1",
        exam_id,
    )
    return {"status": "in_progress"}


@router.post("/exams/{exam_id}/submit")
async def submit_exam(
    exam_id: UUID,
    body: ExamAnswers,
    current_user=Depends(get_current_user),
):
    """Submit exam answers, auto-grade MCQ, update IRT theta, award XP."""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can submit exams")

    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM student_exams WHERE id = $1 AND student_id = $2",
        exam_id, current_user["id"],
    )
    if not row:
        raise HTTPException(status_code=404, detail="Exam not found")
    if row["status"] == "completed":
        raise HTTPException(status_code=409, detail="Exam already submitted")

    exam_data = row["exam_data"]
    if isinstance(exam_data, str):
        exam_data = json.loads(exam_data)

    questions = exam_data.get("questions", [])
    if not questions:
        raise HTTPException(status_code=400, detail="Exam has no questions")

    # ── Auto-grade MCQ answers ──
    total_points = 0
    earned_points = 0
    results = []

    for q in questions:
        qnum = str(q.get("question_number", ""))
        q_type = q.get("question_type", "mcq")
        points = q.get("points", 1)
        total_points += points

        student_answer = body.answers.get(qnum, body.answers.get(int(qnum) if qnum.isdigit() else qnum, ""))
        correct = q.get("correct_answer", "")

        if q_type == "mcq":
            is_correct = str(student_answer).strip().upper() == str(correct).strip().upper()
            if is_correct:
                earned_points += points
        else:
            # Open questions: give partial credit (teacher can re-grade later)
            is_correct = bool(student_answer and len(str(student_answer).strip()) > 10)
            if is_correct:
                earned_points += max(1, points // 2)

        results.append({
            "question_number": q.get("question_number"),
            "student_answer": student_answer,
            "correct_answer": correct,
            "is_correct": is_correct,
            "points_earned": points if (q_type == "mcq" and is_correct) else (max(1, points // 2) if is_correct else 0),
            "explanation": q.get("explanation", ""),
        })

    score = earned_points / total_points if total_points > 0 else 0.0

    # ── IRT theta update (simplified 1PL) ──
    profile_row = await pool.fetchrow(
        "SELECT profile_data FROM learner_profiles WHERE student_id = $1",
        current_user["id"],
    )
    theta_before = 0.0
    if profile_row:
        profile = json.loads(profile_row["profile_data"])
        theta_before = profile.get("ability_estimate", 0.0)

    # Simple theta adjustment: +0.3 for high scores, -0.2 for low
    if score >= 0.8:
        theta_after = theta_before + 0.3
    elif score >= 0.5:
        theta_after = theta_before + 0.1
    else:
        theta_after = theta_before - 0.2

    theta_after = max(-3.0, min(3.0, theta_after))

    # Update learner profile with new theta
    if profile_row:
        profile["ability_estimate"] = round(theta_after, 2)
        await pool.execute(
            "UPDATE learner_profiles SET profile_data = $1 WHERE student_id = $2",
            json.dumps(profile), current_user["id"],
        )

    # ── Save exam results ──
    await pool.execute(
        """
        UPDATE student_exams
        SET status = 'completed',
            score = $1,
            answers = $2::jsonb,
            theta_before = $3,
            theta_after = $4,
            completed_at = NOW()
        WHERE id = $5
        """,
        score,
        json.dumps(body.answers),
        theta_before,
        theta_after,
        exam_id,
    )

    # ── Award XP ──
    xp_earned = max(10, round(score * 50))
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                xp_result = await _apply_xp(conn, current_user["id"], xp_earned, "exam_completion")
    except Exception as e:
        logger.warning("XP award failed for exam %s: %s", exam_id, e)
        xp_result = {}

    return {
        "score": round(score, 2),
        "earned_points": earned_points,
        "total_points": total_points,
        "percentage": round(score * 100),
        "theta_before": round(theta_before, 2),
        "theta_after": round(theta_after, 2),
        "xp_earned": xp_earned,
        "gamification": xp_result,
        "results": results,
    }
