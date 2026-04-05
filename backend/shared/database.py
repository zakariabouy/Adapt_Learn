import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set. Copy .env.example to .env and fill in your values.")

# asyncpg expects postgresql:// scheme (not postgresql+asyncpg://)
ASYNCPG_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

pool = None

async def get_pool():
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(ASYNCPG_URL)
    return pool
