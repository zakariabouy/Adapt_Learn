import os
import logging
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from shared.database import get_pool
from routers import auth, student, session, content, quiz, teacher, admin
from orchestrator.scheduler import start_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize the pool
    await get_pool()
    
    # Start background scheduler
    scheduler = start_scheduler()
    
    yield
    # Shutdown: Close the pool and scheduler
    try:
        if scheduler and scheduler.running:
            scheduler.shutdown(wait=False)
    except Exception:
        pass

_debug = os.getenv("DEBUG", "false").lower() == "true"
app = FastAPI(
    title="AdaptLearn API", 
    version="0.1.0",
    lifespan=lifespan,
    debug=_debug
)

# CORS Configuration — set ALLOWED_ORIGINS as comma-separated list in env
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler — expose errors during development
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true"
        }
    )

# Include Routers
app.include_router(auth.router)
app.include_router(student.router)
app.include_router(session.router)
app.include_router(content.router)
app.include_router(quiz.router)
app.include_router(teacher.router)
app.include_router(admin.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "AdaptLearn API is live"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=int(os.getenv("PORT", 8000)), 
        reload=_debug,
        log_level="debug" if _debug else "info"
    )
