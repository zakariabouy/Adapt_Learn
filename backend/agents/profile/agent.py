import json
from typing import Optional
from shared.models import LearnerModel
from shared.database import get_pool
from uuid import UUID

async def get_student_profile(student_id: UUID) -> Optional[LearnerModel]:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT profile_data FROM learner_profiles WHERE student_id = $1",
        student_id
    )
    if row:
        data = json.loads(row["profile_data"])
        return LearnerModel(**data)
    return None

async def update_student_profile(student_id: UUID, profile: LearnerModel):
    pool = await get_pool()
    profile_json = profile.model_dump_json()
    
    # Upsert the profile
    await pool.execute(
        """
        INSERT INTO learner_profiles (student_id, profile_data, last_updated)
        VALUES ($1, $2, NOW())
        ON CONFLICT (student_id) DO UPDATE
        SET profile_data = EXCLUDED.profile_data,
            last_updated = NOW()
        """,
        student_id, profile_json
    )
    return profile
