from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from shared.database import get_pool
from routers import auth, student, session, content

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize the pool
    await get_pool()
    yield
    # Shutdown: Close the pool
    # Note: asyncpg pool close might be needed here
    pass

app = FastAPI(
    title="AdaptLearn API", 
    version="0.1.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(student.router)
app.include_router(session.router)
app.include_router(content.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "AdaptLearn API is live"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
