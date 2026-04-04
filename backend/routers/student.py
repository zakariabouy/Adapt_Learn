from fastapi import APIRouter, Depends, HTTPException
from shared.models import LearnerModel, User
from routers.auth import get_current_user
from agents.profile.agent import get_student_profile, update_student_profile
from uuid import UUID

router = APIRouter(prefix="/student", tags=["Student"])

@router.get("/profile", response_model=LearnerModel)
async def get_profile(current_user = Depends(get_current_user)):
    # current_user is a Record from asyncpg
    profile = await get_student_profile(current_user["id"])
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@router.post("/profile", response_model=LearnerModel)
async def update_profile(profile: LearnerModel, current_user = Depends(get_current_user)):
    # Ensure the profile belongs to the current student
    if str(profile.student_id) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized to update this profile")
    
    updated_profile = await update_student_profile(current_user["id"], profile)
    return updated_profile
