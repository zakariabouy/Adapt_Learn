from fastapi import APIRouter, Depends, HTTPException
from shared.log_store import orchestrator_logs
from routers.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/orchestrator-logs")
async def get_logs(current_user = Depends(get_current_user)):
    # In a real app, we'd check if user is an admin
    # For the hackathon demo, any authenticated user can view them if they know the route
    return orchestrator_logs.get_logs()
