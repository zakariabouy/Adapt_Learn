from fastapi import APIRouter, Depends, HTTPException
from shared.database import get_pool
from routers.auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
import datetime

router = APIRouter(prefix="/gamification", tags=["Gamification"])

class XPUpdate(BaseModel):
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

@router.get("/status")
async def get_gamification_status(current_user = Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students have gamification stats")
    
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM student_gamification WHERE student_id = $1",
        current_user["id"]
    )
    
    if not row:
        # Initialize if not exists
        await pool.execute(
            "INSERT INTO student_gamification (student_id) VALUES ($1) ON CONFLICT DO NOTHING",
            current_user["id"]
        )
        row = await pool.fetchrow("SELECT * FROM student_gamification WHERE student_id = $1", current_user["id"])
    
    return dict(row)

@router.post("/add-xp")
async def add_xp(update: XPUpdate, current_user = Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students earn XP")
    
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            # 1. Log XP
            await conn.execute(
                "INSERT INTO xp_logs (student_id, xp_amount, reason) VALUES ($1, $2, $3)",
                current_user["id"], update.xp_amount, update.reason
            )
            
            # 2. Update Student Stats
            # Level logic: level = floor(sqrt(total_xp / 100)) + 1 (simple curve)
            await conn.execute(
                """
                UPDATE student_gamification 
                SET current_xp = current_xp + $2,
                    current_level = floor(sqrt((current_xp + $2) / 100.0)) + 1,
                    last_activity_date = CURRENT_DATE
                WHERE student_id = $1
                """,
                current_user["id"], update.xp_amount
            )
            
            # 3. Handle Streaks
            # If last_activity_date was yesterday, increment streak. 
            # If today, keep same. If older, reset to 1.
            await conn.execute(
                """
                UPDATE student_gamification
                SET current_streak = CASE 
                    WHEN last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak + 1
                    WHEN last_activity_date = CURRENT_DATE THEN current_streak
                    ELSE 1
                END,
                max_streak = GREATEST(max_streak, CASE 
                    WHEN last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak + 1
                    ELSE 1
                END)
                WHERE student_id = $1
                """,
                current_user["id"]
            )
            
    return {"status": "success", "xp_added": update.xp_amount}

@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(grade_level: Optional[int] = None):
    pool = await get_pool()
    if grade_level:
        rows = await pool.fetch("SELECT * FROM leaderboard WHERE grade_level = $1 LIMIT 50", grade_level)
    else:
        rows = await pool.fetch("SELECT * FROM leaderboard LIMIT 50")
    
    return [dict(row) for row in rows]

@router.get("/badges")
async def get_all_badges():
    pool = await get_pool()
    rows = await pool.fetch("SELECT * FROM badges")
    return [dict(row) for row in rows]
