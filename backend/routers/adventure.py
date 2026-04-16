"""
Adventure router — server-of-record for the Godot Adventure World state.

The Godot iframe is stateless across reloads, so we persist:
  - which therapy pack the parent/teacher assigned (dyslexia/adhd/autism/anxiety)
  - which mission arrows the student has already cleared

POST /adventure/complete is the authoritative XP path for the Godot game:
it is idempotent (second call for the same mission is a no-op) and awards XP
through the same _apply_xp helper the rest of the gamification stack uses.
This means the browser can't double-dip XP by replaying a mission.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List
import json

from shared.database import get_pool
from routers.auth import get_current_user
from routers.gamification import _apply_xp

router = APIRouter(prefix="/adventure", tags=["Adventure"])

# Mirrors PACKS in isometric-game-demo/game_manager.gd. Kept as a frozen set
# so we validate pack_id at the API boundary instead of trusting the client.
VALID_PACKS = {"dyslexia", "adhd", "autism", "anxiety"}

# Mirrors ALL_MISSIONS ids in game_manager.gd. If this falls out of sync with
# the Godot side, the server rejects the completion — which is the safer
# direction: a mis-spelled mission_id from the iframe won't silently award XP.
VALID_MISSION_IDS = {
    # dyslexia
    "g1", "g2", "g3", "g6",
    # adhd
    "a1", "a2", "a3", "a4",
    # autism
    "u1", "u2", "u3", "u4",
    # anxiety
    "fr1", "mw1", "n1", "n2", "n3", "n4",
}

# XP per mission — matches the client-side MISSION_XP map in adventure/page.tsx.
# Server is authoritative; the client value is only used for optimistic UI.
MISSION_XP: dict[str, int] = {
    "mw1": 30, "fr1": 25,
    "g1": 20, "g2": 20, "g3": 20, "g6": 20,
    "a1": 20, "a2": 20, "a3": 20, "a4": 20,
    "u1": 20, "u2": 20, "u3": 20, "u4": 20,
    "n1": 15, "n2": 15, "n3": 15, "n4": 15,
}


class AdventureConfig(BaseModel):
    pack_id: str
    completed: List[str]


class CompleteMissionRequest(BaseModel):
    mission_id: str = Field(..., min_length=1, max_length=16)
    # Optional engine score (0–10k). Capped small because we only use it for
    # a tiny bonus — the base XP per mission dominates.
    score: int = Field(0, ge=0, le=10_000)


def _parse_completed(raw) -> list[str]:
    """completed_missions can come back as list (asyncpg JSONB) or str (text)."""
    if isinstance(raw, list):
        return [str(x) for x in raw]
    if isinstance(raw, str):
        try:
            return [str(x) for x in json.loads(raw)]
        except json.JSONDecodeError:
            return []
    return []


async def _ensure_row(conn, student_id):
    """Create the student_adventure row if missing, using the default anxiety pack."""
    await conn.execute(
        "INSERT INTO student_adventure (student_id) VALUES ($1) ON CONFLICT DO NOTHING",
        student_id,
    )


@router.get("/config", response_model=AdventureConfig)
async def get_adventure_config(current_user=Depends(get_current_user)):
    """
    Returns the current pack assignment and completed mission list.
    The Godot iframe reads this (via URL query params) on boot so arrows the
    student already cleared don't respawn.
    """
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students have adventure config")

    pool = await get_pool()
    async with pool.acquire() as conn:
        await _ensure_row(conn, current_user["id"])
        row = await conn.fetchrow(
            "SELECT pack_id, completed_missions FROM student_adventure WHERE student_id = $1",
            current_user["id"],
        )

    return AdventureConfig(
        pack_id=row["pack_id"],
        completed=_parse_completed(row["completed_missions"]),
    )


@router.post("/complete")
async def complete_mission(req: CompleteMissionRequest, current_user=Depends(get_current_user)):
    """
    Idempotent mission completion. First call persists the mission and awards
    base + (score // 20) bonus XP. Second call for the same mission returns
    the current state with `already_completed: true` and no XP delta.
    """
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can complete adventure missions")

    if req.mission_id not in VALID_MISSION_IDS:
        raise HTTPException(status_code=400, detail=f"Unknown mission_id: {req.mission_id}")

    # mw1 is the VARK arrow — the VARK flow awards its own XP on submission,
    # so stepping on that arrow should not fire gamification XP here. We still
    # persist the step so the arrow doesn't respawn.
    award_xp_for_mission = req.mission_id != "mw1"

    base_xp = MISSION_XP.get(req.mission_id, 15)
    bonus = min(50, req.score // 20)
    xp_to_award = min(500, base_xp + bonus)

    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await _ensure_row(conn, current_user["id"])
            row = await conn.fetchrow(
                "SELECT completed_missions FROM student_adventure WHERE student_id = $1 FOR UPDATE",
                current_user["id"],
            )
            completed = _parse_completed(row["completed_missions"])

            if req.mission_id in completed:
                return {
                    "status": "noop",
                    "already_completed": True,
                    "completed": completed,
                    "xp_awarded": 0,
                }

            completed.append(req.mission_id)
            await conn.execute(
                "UPDATE student_adventure SET completed_missions = $2::jsonb, updated_at = NOW() WHERE student_id = $1",
                current_user["id"],
                json.dumps(completed),
            )

            xp_result = {}
            if award_xp_for_mission:
                xp_result = await _apply_xp(
                    conn,
                    current_user["id"],
                    xp_to_award,
                    f"adventure:{req.mission_id}",
                )

    return {
        "status": "success",
        "already_completed": False,
        "completed": completed,
        "xp_awarded": xp_to_award if award_xp_for_mission else 0,
        **xp_result,
    }
