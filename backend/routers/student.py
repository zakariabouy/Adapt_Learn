from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
from shared.models import LearnerModel, User, RedeemRewardRequest, VARKSubmitRequest
from routers.auth import get_current_user
from agents.profile.agent import get_student_profile, update_student_profile, generate_profile_summary
from agents.profile.game_profiler import process_game_result, get_available_games
from agents.profile.vark import process_vark_submission, get_vark_questions
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

# ─────────────────────────────────────────────────────────────────────────────
# Unified Full Profile (merges all 4 sources)
# ─────────────────────────────────────────────────────────────────────────────

BARTLE_LABELS = {
    "achiever": "Achiever",
    "explorer": "Explorer",
    "socializer": "Socializer",
    "killer": "Challenger",
}

VARK_LABELS = {"V": "Visual", "A": "Auditory", "R": "Read/Write", "K": "Kinesthetic"}


@router.get("/full-profile")
async def get_full_profile(current_user=Depends(get_current_user)):
    """
    Aggregates the student's profile from all 4 sources:
      1. VARK test scores
      2. Parent onboarding data (favorites, conditions, personality)
      3. Teacher corrections/observations
      4. Game profiler (Bartle type, tag strengths)
    Returns a unified view for the profile dashboard.
    """
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Students only")

    pool = await get_pool()
    student_id = current_user["id"]

    # 1. Core learner profile
    profile = await get_student_profile(student_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Complete onboarding first.")

    # 2. Parent onboarding data
    parent_data = await pool.fetchrow(
        """SELECT po.*, u.name AS parent_name
           FROM parent_onboarding po
           JOIN parent_child_link pcl ON po.parent_id = pcl.parent_id AND po.child_id = pcl.child_id
           JOIN users u ON po.parent_id = u.id
           WHERE po.child_id = $1
           ORDER BY po.updated_at DESC LIMIT 1""",
        student_id,
    )

    # 3. Teacher corrections
    corrections = await pool.fetch(
        """SELECT tc.correction_type, tc.data, tc.created_at, u.name AS teacher_name
           FROM teacher_corrections tc
           JOIN users u ON tc.teacher_id = u.id
           WHERE tc.student_id = $1
           ORDER BY tc.created_at DESC LIMIT 10""",
        student_id,
    )

    # 4. Game history (last 20 games)
    games = await pool.fetch(
        """SELECT questions, responses, score, taken_at
           FROM assessments
           WHERE student_id = $1 AND questions::text LIKE '%game_type%'
           ORDER BY taken_at DESC LIMIT 20""",
        student_id,
    )

    # 5. Gamification stats
    gam = await pool.fetchrow(
        "SELECT * FROM student_gamification WHERE student_id = $1", student_id
    )

    # 6. User basic info
    user_row = await pool.fetchrow(
        "SELECT name, email, grade_level, created_at FROM users WHERE id = $1", student_id
    )

    # Build unified response
    # VARK section
    vark_section = None
    if profile.vark_completed and profile.vark_scores:
        dominant = max(profile.vark_scores, key=profile.vark_scores.get)
        vark_section = {
            "completed": True,
            "scores": profile.vark_scores,
            "dominant": dominant,
            "dominant_label": VARK_LABELS.get(dominant, dominant),
        }

    # Bartle section
    bartle_section = None
    if profile.bartle_scores:
        bartle_section = {
            "scores": profile.bartle_scores,
            "type": profile.bartle_type,
            "type_label": BARTLE_LABELS.get(profile.bartle_type or "", "Unknown"),
        }

    # Parent section
    parent_section = None
    if parent_data:
        parent_section = {
            "provided_by": parent_data["parent_name"],
            "known_conditions": parent_data["known_conditions"] or [],
            "interests": parent_data["interests"] or [],
            "attention_span_minutes": parent_data["attention_span_minutes"],
            "preferred_learning_time": parent_data["preferred_learning_time"],
            "languages_spoken": parent_data["languages_spoken"] or [],
            "favorite_color": parent_data.get("favorite_color"),
            "favorite_subject": parent_data.get("favorite_subject"),
            "favorite_animal": parent_data.get("favorite_animal"),
            "hobbies": parent_data.get("hobbies") or [],
            "personality_observations": parent_data.get("personality_observations") or [],
        }

    # Teacher section
    teacher_section = []
    for c in corrections:
        data = json.loads(c["data"]) if isinstance(c["data"], str) else c["data"]
        teacher_section.append({
            "teacher_name": c["teacher_name"],
            "type": c["correction_type"],
            "data": data,
            "date": c["created_at"].isoformat(),
        })

    # Games section
    game_history = []
    for g in games:
        q = json.loads(g["questions"]) if isinstance(g["questions"], str) else g["questions"]
        game_history.append({
            "game_type": q.get("game_type", "unknown"),
            "score": round(g["score"], 2) if g["score"] else 0,
            "date": g["taken_at"].isoformat() if g["taken_at"] else None,
        })

    return {
        "student": {
            "name": user_row["name"] if user_row else None,
            "email": user_row["email"] if user_row else None,
            "grade_level": user_row["grade_level"] if user_row else None,
            "member_since": user_row["created_at"].isoformat() if user_row else None,
        },
        "learning_profile": {
            "tags": profile.learning_tags,
            "tag_strength": profile.tag_strength,
            "preferred_modality": profile.preferred_modality,
            "reading_speed_wpm": profile.reading_speed_wpm,
            "ability_estimate": profile.ability_estimate,
            "personality_traits": profile.personality_traits,
            "favorite_color": profile.favorite_color,
            "favorite_subject": profile.favorite_subject,
            "favorite_animal": profile.favorite_animal,
            "hobbies": profile.hobbies,
        },
        "vark": vark_section,
        "bartle": bartle_section,
        "parent_insights": parent_section,
        "teacher_observations": teacher_section,
        "game_history": game_history,
        "gamification": {
            "xp": gam["current_xp"] if gam else 0,
            "level": gam["current_level"] if gam else 1,
            "streak": gam["current_streak"] if gam else 0,
            "badges": json.loads(gam["badges_unlocked"]) if gam and gam["badges_unlocked"] else [],
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# VARK Learning Style Assessment
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/vark/questions")
async def get_vark_test(current_user=Depends(get_current_user)):
    """Returns the 16 VARK questions for the frontend questionnaire."""
    return {"questions": get_vark_questions()}


@router.post("/vark/submit")
async def submit_vark_test(
    request: VARKSubmitRequest,
    current_user=Depends(get_current_user),
):
    """
    Submit completed VARK test answers. Scores the test and updates
    the student's learner profile with VARK scores, preferred modality,
    and learning tags.
    """
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can take the VARK test")

    # Validate all 16 questions are answered
    answered_ids = {a.question_id for a in request.answers}
    expected_ids = set(range(1, 17))
    if answered_ids != expected_ids:
        missing = expected_ids - answered_ids
        raise HTTPException(
            status_code=400,
            detail=f"Missing answers for questions: {sorted(missing)}",
        )

    answers = [(a.question_id, a.selected) for a in request.answers]
    result = await process_vark_submission(current_user["id"], answers)
    return result


@router.get("/vark/status")
async def get_vark_status(current_user=Depends(get_current_user)):
    """Check if the current student has completed the VARK test."""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students have VARK status")

    profile = await get_student_profile(current_user["id"])
    if not profile:
        return {"completed": False, "scores": None}

    return {
        "completed": profile.vark_completed,
        "scores": profile.vark_scores if profile.vark_completed else None,
        "dominant_style": (
            max(profile.vark_scores, key=profile.vark_scores.get)
            if profile.vark_scores
            else None
        ),
    }


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


# ─────────────────────────────────────────────────────────────────────────────
# Anti-Addiction Safeguards
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_SESSION_MAX = 45        # minutes
DEFAULT_DAILY_LIMIT = 60        # minutes
DEFAULT_BREAK_INTERVAL = 45     # minutes
DEFAULT_BREAK_DURATION = 10     # minutes


async def _get_student_limits(student_id: UUID) -> dict:
    """Fetch parental controls or use defaults."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM parental_controls WHERE child_id = $1 LIMIT 1",
        student_id,
    )
    if row:
        return {
            "session_max": row["session_max_minutes"],
            "daily_limit": row["daily_time_limit_minutes"],
            "break_interval": row["break_interval_minutes"],
            "break_duration": row["break_duration_minutes"],
            "start_hour": row["allowed_start_hour"],
            "end_hour": row["allowed_end_hour"],
        }
    return {
        "session_max": DEFAULT_SESSION_MAX,
        "daily_limit": DEFAULT_DAILY_LIMIT,
        "break_interval": DEFAULT_BREAK_INTERVAL,
        "break_duration": DEFAULT_BREAK_DURATION,
        "start_hour": 8,
        "end_hour": 20,
    }


@router.get("/session-check")
async def check_session_allowed(current_user=Depends(get_current_user)):
    """
    Check if the student is allowed to start/continue a session.
    Enforces anti-addiction safeguards: daily limits, session limits, forced breaks, time-of-day.
    """
    if current_user["role"] != "student":
        return {"allowed": True, "reason": "Non-student users have no session limits"}

    pool = await get_pool()
    student_id = current_user["id"]
    limits = await _get_student_limits(student_id)
    now = datetime.now(timezone.utc)

    # 1. Check time-of-day restrictions
    current_hour = now.hour
    if current_hour < limits["start_hour"] or current_hour >= limits["end_hour"]:
        return {
            "allowed": False,
            "reason": f"Learning hours are {limits['start_hour']}:00 - {limits['end_hour']}:00",
            "break_required": False,
        }

    # 2. Check if session is locked (forced break in effect)
    lock = await pool.fetchrow(
        "SELECT locked_until FROM session_locks WHERE student_id = $1", student_id
    )
    if lock and lock["locked_until"] > now:
        remaining = (lock["locked_until"] - now).total_seconds() / 60.0
        return {
            "allowed": False,
            "reason": "Break time! Rest your eyes and move around.",
            "break_required": True,
            "locked_until": lock["locked_until"].isoformat(),
            "remaining_minutes": round(remaining, 1),
        }
    elif lock:
        # Lock expired — clean up
        await pool.execute("DELETE FROM session_locks WHERE student_id = $1", student_id)

    # 3. Check daily usage limit
    usage = await pool.fetchrow(
        "SELECT total_minutes, session_count, last_session_start FROM daily_usage_log WHERE student_id = $1 AND usage_date = CURRENT_DATE",
        student_id,
    )
    daily_used = usage["total_minutes"] if usage else 0.0
    remaining_daily = limits["daily_limit"] - daily_used

    if remaining_daily <= 0:
        return {
            "allowed": False,
            "reason": "You've reached your daily learning limit. Great job today! Come back tomorrow.",
            "remaining_minutes": 0,
            "break_required": False,
        }

    # 4. Check if break is needed (continuous session > break_interval)
    if usage and usage["last_session_start"]:
        continuous = (now - usage["last_session_start"].replace(tzinfo=timezone.utc)).total_seconds() / 60.0
        if continuous >= limits["break_interval"]:
            # Trigger forced break
            locked_until = now + timedelta(minutes=limits["break_duration"])
            await pool.execute(
                """INSERT INTO session_locks (student_id, locked_until, reason)
                   VALUES ($1, $2, 'forced_break')
                   ON CONFLICT (student_id) DO UPDATE SET locked_until = $2""",
                student_id, locked_until,
            )
            # Log the break
            await pool.execute(
                """INSERT INTO daily_usage_log (student_id, usage_date, forced_breaks)
                   VALUES ($1, CURRENT_DATE, 1)
                   ON CONFLICT (student_id, usage_date)
                   DO UPDATE SET forced_breaks = daily_usage_log.forced_breaks + 1""",
                student_id,
            )
            return {
                "allowed": False,
                "reason": f"Time for a {limits['break_duration']}-minute break! Stand up, stretch, and rest your eyes.",
                "break_required": True,
                "locked_until": locked_until.isoformat(),
                "remaining_minutes": limits["break_duration"],
            }

    return {
        "allowed": True,
        "remaining_minutes": round(remaining_daily, 1),
        "session_max_minutes": min(limits["session_max"], remaining_daily),
        "break_required": False,
    }


@router.post("/session-heartbeat")
async def session_heartbeat(current_user=Depends(get_current_user)):
    """
    Called periodically by the frontend to track active session time.
    Updates daily usage log with elapsed minutes.
    """
    if current_user["role"] != "student":
        return {"status": "skipped"}

    pool = await get_pool()
    student_id = current_user["id"]
    now = datetime.now(timezone.utc)

    # Upsert daily usage: add 1 minute per heartbeat (frontend calls every 60s)
    await pool.execute(
        """INSERT INTO daily_usage_log (student_id, usage_date, total_minutes, session_count, last_session_start)
           VALUES ($1, CURRENT_DATE, 1, 1, $2)
           ON CONFLICT (student_id, usage_date)
           DO UPDATE SET
               total_minutes = daily_usage_log.total_minutes + 1,
               last_session_start = COALESCE(daily_usage_log.last_session_start, $2)""",
        student_id, now,
    )

    # Check if limits are about to be exceeded
    limits = await _get_student_limits(student_id)
    usage = await pool.fetchrow(
        "SELECT total_minutes FROM daily_usage_log WHERE student_id = $1 AND usage_date = CURRENT_DATE",
        student_id,
    )
    remaining = limits["daily_limit"] - (usage["total_minutes"] if usage else 0)

    warning = None
    if remaining <= 5:
        warning = "less_than_5_minutes"
    elif remaining <= 10:
        warning = "less_than_10_minutes"

    return {"status": "ok", "remaining_minutes": round(remaining, 1), "warning": warning}


# ─────────────────────────────────────────────────────────────────────────────
# Reward Redemption (student redeems custom or classroom rewards)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/redeem-reward")
async def redeem_reward(request: RedeemRewardRequest, current_user=Depends(get_current_user)):
    """Student spends XP to redeem a reward."""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can redeem rewards")

    pool = await get_pool()
    student_id = current_user["id"]
    reward_id = UUID(request.reward_id)

    # Fetch reward details
    if request.reward_type == "custom":
        reward = await pool.fetchrow(
            "SELECT * FROM custom_rewards WHERE id = $1 AND child_id = $2 AND is_active = TRUE AND is_redeemed = FALSE",
            reward_id, student_id,
        )
    else:
        reward = await pool.fetchrow(
            "SELECT * FROM classroom_rewards WHERE id = $1 AND is_active = TRUE",
            reward_id,
        )

    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found or already redeemed")

    # Check XP
    gam = await pool.fetchrow(
        "SELECT current_xp FROM student_gamification WHERE student_id = $1", student_id
    )
    current_xp = gam["current_xp"] if gam else 0
    if current_xp < reward["xp_cost"]:
        raise HTTPException(status_code=400, detail=f"Not enough XP. Need {reward['xp_cost']}, have {current_xp}")

    # Deduct XP and record redemption
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE student_gamification SET current_xp = current_xp - $1 WHERE student_id = $2",
                reward["xp_cost"], student_id,
            )
            await conn.execute(
                """INSERT INTO reward_redemptions (student_id, reward_type, reward_id, xp_spent)
                   VALUES ($1, $2, $3, $4)""",
                student_id, request.reward_type, reward_id, reward["xp_cost"],
            )
            if request.reward_type == "custom":
                await conn.execute(
                    "UPDATE custom_rewards SET is_redeemed = TRUE, redeemed_at = NOW() WHERE id = $1",
                    reward_id,
                )

    # Notify parent if custom reward
    if request.reward_type == "custom":
        await pool.execute(
            """INSERT INTO notifications (user_id, notification_type, title, body, data)
               VALUES ($1, 'reward_redeemed', $2, $3, $4)""",
            reward.get("parent_id") or student_id,
            f"Reward Redeemed: {reward['title']}",
            f"Your child redeemed '{reward['title']}' for {reward['xp_cost']} XP!",
            f'{{"reward_id": "{reward_id}"}}',
        )

    return {
        "status": "redeemed",
        "reward_title": reward["title"],
        "xp_spent": reward["xp_cost"],
        "xp_remaining": current_xp - reward["xp_cost"],
    }


@router.get("/rewards")
async def list_available_rewards(current_user=Depends(get_current_user)):
    """Lists all rewards available to this student (custom + classroom)."""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Students only")

    pool = await get_pool()
    student_id = current_user["id"]

    # Custom rewards from parents
    custom = await pool.fetch(
        "SELECT * FROM custom_rewards WHERE child_id = $1 AND is_active = TRUE AND is_redeemed = FALSE ORDER BY xp_cost",
        student_id,
    )

    # Classroom rewards from linked teachers
    classroom = await pool.fetch(
        """SELECT cr.* FROM classroom_rewards cr
           JOIN teacher_student_link tsl ON cr.teacher_id = tsl.teacher_id
           WHERE tsl.student_id = $1 AND cr.is_active = TRUE
           ORDER BY cr.xp_cost""",
        student_id,
    )

    return {
        "custom_rewards": [
            {"id": str(r["id"]), "title": r["title"], "description": r["description"],
             "xp_cost": r["xp_cost"], "icon": r["icon"], "type": "custom"}
            for r in custom
        ],
        "classroom_rewards": [
            {"id": str(r["id"]), "title": r["title"], "description": r["description"],
             "xp_cost": r["xp_cost"], "icon": r["icon"], "type": "classroom"}
            for r in classroom
        ],
    }
