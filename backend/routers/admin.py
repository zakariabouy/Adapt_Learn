from fastapi import APIRouter, Depends, HTTPException
from shared.log_store import orchestrator_logs
from routers.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/orchestrator-logs")
async def get_logs(current_user = Depends(get_current_user)):
    if current_user["role"] not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Admin or teacher access required")
    return orchestrator_logs.get_logs()
