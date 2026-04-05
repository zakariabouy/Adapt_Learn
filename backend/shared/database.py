import os
import asyncpg
import redis.asyncio as redis
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set. Copy .env.example to .env and fill in your values.")

# asyncpg expects postgresql:// scheme (not postgresql+asyncpg://)
ASYNCPG_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

pool = None
redis_pool = None

async def get_pool():
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(ASYNCPG_URL)
    return pool

async def get_redis():
    global redis_pool
    if redis_pool is None:
        redis_pool = redis.from_url(REDIS_URL, decode_responses=True)
    return redis_pool
