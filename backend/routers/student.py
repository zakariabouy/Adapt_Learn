from fastapi import APIRouter, Depends, HTTPException
from shared.models import LearnerModel, User
from routers.auth import get_current_user
from agents.profile.agent import get_student_profile, update_student_profile
from agents.adaptation.agent import chunk_content, transform_font
from orchestrator.graph import adapt_content
from shared.database import get_pool
from uuid import UUID
import json
import hashlib

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
async def get_adapted_workspace(content_id: UUID, current_user = Depends(get_current_user)):
    pool = await get_pool()
    
    # 1. Get Student Profile
    profile_record = await get_student_profile(current_user["id"])
    if not profile_record:
        raise HTTPException(status_code=404, detail="Student profile not found. Please complete onboarding.")
    
    # Convert Record to LearnerModel if it's not already (get_student_profile returns LearnerModel)
    profile = profile_record

    # 2. Check for cached adaptation
    # We use a hash of the profile's relevant settings to ensure cache hits/misses are accurate
    config_str = json.dumps({
        "preferred_font": profile.preferred_font,
        "preferred_modality": profile.preferred_modality,
        "disabilities": profile.disabilities,
        "severity": profile.severity
    }, sort_keys=True)
    
    cached = await pool.fetchrow(
        "SELECT adapted_text, adaptation_config FROM adapted_content WHERE content_id = $1 AND student_id = $2 AND md5(adaptation_config::text) = md5($3)",
        content_id, current_user["id"], config_str
    )
    
    if cached:
        return {
            "content_id": content_id,
            "chunks": json.loads(cached["adapted_text"]),
            "css_config": await transform_font(profile),
            "cached": True
        }

    # 3. If not cached, generate adaptation
    content_item = await pool.fetchrow("SELECT original_text FROM content_items WHERE id = $1", content_id)
    if not content_item:
        raise HTTPException(status_code=404, detail="Content not found")
    
    original_text = content_item["original_text"]
    
    # Simplify/Adapt using Orchestrator
    adapted_text = await adapt_content(profile, original_text)
    
    # Chunking
    chunks = await chunk_content(adapted_text, profile.chunk_size or 500)
    
    # CSS Config
    css_config = await transform_font(profile)
    
    # 4. Store in cache
    await pool.execute(
        "INSERT INTO adapted_content (content_id, student_id, adaptation_config, adapted_text) VALUES ($1, $2, $3, $4)",
        content_id, current_user["id"], config_str, json.dumps(chunks)
    )
    
    return {
        "content_id": content_id,
        "chunks": chunks,
        "css_config": css_config,
        "cached": False
    }
