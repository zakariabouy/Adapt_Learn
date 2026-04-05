from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from shared.models import LearnerModel, User
from routers.auth import get_current_user
from agents.profile.agent import get_student_profile, update_student_profile
from agents.adaptation.agent import chunk_content, transform_font, tts_convert
from orchestrator.graph import adapt_content
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
        "disabilities": profile.disabilities,
        "severity": profile.severity
    }, sort_keys=True)
    
    if not force_refresh:
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
    # First delete existing if force_refresh was true to avoid unique constraint violations
    if force_refresh:
        await pool.execute(
            "DELETE FROM adapted_content WHERE content_id = $1 AND student_id = $2 AND md5(adaptation_config::text) = md5($3)",
            content_id, current_user["id"], config_str
        )

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
