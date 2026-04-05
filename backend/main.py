import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from shared.database import get_pool
from routers import auth, student, session, content, quiz, teacher
from orchestrator.scheduler import start_scheduler
import traceback

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize the pool
    await get_pool()
    
    # Start background scheduler
    scheduler = start_scheduler()
    
    yield
    # Shutdown: Close the pool
    scheduler.shutdown()
    pass

app = FastAPI(
    title="AdaptLearn API", 
    version="0.1.0",
    lifespan=lifespan,
    debug=True
)

# CORS Configuration
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler — expose errors during development
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
        headers={
            "Access-Control-Allow-Origin": "http://localhost:3000",
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

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "AdaptLearn API is live"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
