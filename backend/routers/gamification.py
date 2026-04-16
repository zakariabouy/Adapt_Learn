from fastapi import APIRouter, Depends, HTTPException
from shared.database import get_pool
from routers.auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
import json
import math

router = APIRouter(prefix="/gamification", tags=["Gamification"])

# XP thresholds for badge unlocks (id -> required_xp)
BADGE_XP_THRESHOLDS = {
    "explorer_1": 0,
    "smarty_100": 100,
    "streak_3": 300,
    "quiz_ace": 500,
}


class XPUpdate(BaseModel):
    xp_amount: int
    reason: str


class TeacherXPAward(BaseModel):
    student_id: UUID
    xp_amount: int
    reason: str


class LeaderboardEntry(BaseModel):
    student_id: UUID
    name: str
    grade_level: int
    current_xp: int
    current_level: int
    current_streak: int
    grade_rank: int
    global_rank: int


async def _apply_xp(conn, student_id: UUID, xp_amount: int, reason: str) -> dict:
    """
    Atomic XP award: logs XP, updates level + streak in a single UPDATE,
    then auto-unlocks any newly earned badges.
    Returns the updated gamification row.
    """
    # 1. Log XP
    await conn.execute(
        "INSERT INTO xp_logs (student_id, xp_amount, reason) VALUES ($1, $2, $3)",
        student_id, xp_amount, reason
    )

    # 2. Single atomic UPDATE — streak is evaluated on the OLD last_activity_date
    #    before we overwrite it, so the CASE reads the previous value correctly.
    row = await conn.fetchrow(
        """
        UPDATE student_gamification
        SET
            current_xp     = current_xp + $2,
            current_level  = floor(sqrt((current_xp + $2) / 100.0))::int + 1,
            current_streak = CASE
                WHEN last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak + 1
                WHEN last_activity_date = CURRENT_DATE                     THEN current_streak
                ELSE 1
            END,
            max_streak = GREATEST(
                max_streak,
                CASE
                    WHEN last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak + 1
                    WHEN last_activity_date = CURRENT_DATE                     THEN current_streak
                    ELSE 1
                END
            ),
            last_activity_date = CURRENT_DATE
        WHERE student_id = $1
        RETURNING current_xp, current_level, current_streak, max_streak, badges_unlocked
        """,
        student_id, xp_amount,
    )

    if not row:
        raise ValueError("Student gamification record not found")

    new_xp = row["current_xp"]
    raw_badges = row["badges_unlocked"]
    if isinstance(raw_badges, str):
        already_unlocked = json.loads(raw_badges)
    elif isinstance(raw_badges, list):
        already_unlocked = raw_badges
    else:
        already_unlocked = []
    newly_earned = []

    # 3. Auto-unlock badges based on XP thresholds
    for badge_id, threshold in BADGE_XP_THRESHOLDS.items():
        if badge_id not in already_unlocked and new_xp >= threshold:
            already_unlocked.append(badge_id)
            newly_earned.append(badge_id)

    if newly_earned:
        await conn.execute(
            "UPDATE student_gamification SET badges_unlocked = $2 WHERE student_id = $1",
            student_id, json.dumps(already_unlocked),
        )

    return {
        "current_xp": new_xp,
        "current_level": row["current_level"],
        "current_streak": row["current_streak"],
        "max_streak": row["max_streak"],
        "newly_earned_badges": newly_earned,
    }


@router.get("/status")
async def get_gamification_status(current_user=Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students have gamification stats")

    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM student_gamification WHERE student_id = $1",
        current_user["id"]
    )

    if not row:
        await pool.execute(
            "INSERT INTO student_gamification (student_id) VALUES ($1) ON CONFLICT DO NOTHING",
            current_user["id"]
        )
        row = await pool.fetchrow(
            "SELECT * FROM student_gamification WHERE student_id = $1",
            current_user["id"]
        )

    return dict(row)


@router.post("/add-xp")
async def add_xp(update: XPUpdate, current_user=Depends(get_current_user)):
    """Student self-reports XP (e.g., after completing a quiz)."""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students earn XP")

    if update.xp_amount <= 0 or update.xp_amount > 500:
        raise HTTPException(status_code=400, detail="XP amount must be between 1 and 500")

    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            result = await _apply_xp(conn, current_user["id"], update.xp_amount, update.reason)

    return {"status": "success", "xp_added": update.xp_amount, **result}


@router.post("/award-xp")
async def teacher_award_xp(award: TeacherXPAward, current_user=Depends(get_current_user)):
    """Teachers award XP to a student (server-authoritative, prevents client abuse)."""
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can award XP")

    if award.xp_amount <= 0 or award.xp_amount > 1000:
        raise HTTPException(status_code=400, detail="XP amount must be between 1 and 1000")

    pool = await get_pool()

    # Verify student is linked to this teacher
    link = await pool.fetchrow(
        "SELECT 1 FROM teacher_student_link WHERE teacher_id = $1 AND student_id = $2",
        current_user["id"], award.student_id,
    )
    if not link:
        raise HTTPException(status_code=403, detail="Student not linked to this teacher")

    async with pool.acquire() as conn:
        async with conn.transaction():
            result = await _apply_xp(conn, award.student_id, award.xp_amount, award.reason)

    return {"status": "success", "xp_added": award.xp_amount, **result}


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(grade_level: Optional[int] = None, current_user=Depends(get_current_user)):
    pool = await get_pool()
    if grade_level:
        rows = await pool.fetch(
            "SELECT * FROM leaderboard WHERE grade_level = $1 ORDER BY grade_rank LIMIT 50",
            grade_level,
        )
    else:
        rows = await pool.fetch("SELECT * FROM leaderboard ORDER BY global_rank LIMIT 50")

    return [dict(row) for row in rows]


@router.get("/badges")
async def get_all_badges():
    """Returns all badge definitions."""
    pool = await get_pool()
    rows = await pool.fetch("SELECT * FROM badges ORDER BY requirement_xp")
    return [dict(row) for row in rows]


@router.get("/badges/my-status")
async def get_my_badge_status(current_user=Depends(get_current_user)):
    """Returns all badges with earned/unearned status for the current student."""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students have badge status")

    pool = await get_pool()
    all_badges = await pool.fetch("SELECT * FROM badges ORDER BY requirement_xp")
    sg_row = await pool.fetchrow(
        "SELECT badges_unlocked, current_xp FROM student_gamification WHERE student_id = $1",
        current_user["id"],
    )

    unlocked = list(sg_row["badges_unlocked"] or []) if sg_row else []
    current_xp = sg_row["current_xp"] if sg_row else 0

    return [
        {
            **dict(b),
            "earned": b["id"] in unlocked,
            "xp_to_go": max(0, (b["requirement_xp"] or 0) - current_xp),
        }
        for b in all_badges
    ]
