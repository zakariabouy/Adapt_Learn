import os
import logging
import asyncpg
import redis.asyncio as redis
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_raw_url = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

if not _raw_url:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. "
        "Copy .env.example to .env and fill in your values."
    )

# Normalize scheme: asyncpg requires postgresql://, not postgres:// or postgresql+asyncpg://
ASYNCPG_URL = (
    _raw_url
    .replace("postgresql+asyncpg://", "postgresql://")
    .replace("postgres://", "postgresql://")
)

pool = None
redis_pool = None


async def get_pool():
    global pool
    if pool is None:
        try:
            pool = await asyncpg.create_pool(ASYNCPG_URL, ssl="require")
        except Exception as e:
            logger.error("Failed to connect to PostgreSQL: %s", e)
            raise RuntimeError(
                f"Database connection failed. Check DATABASE_URL and network access. Error: {e}"
            ) from e
    return pool


async def get_redis():
    global redis_pool
    if redis_pool is None:
        try:
            redis_pool = redis.from_url(REDIS_URL, decode_responses=True)
            # Ping to verify connection is alive
            await redis_pool.ping()
        except Exception as e:
            logger.warning("Redis unavailable — session history will be disabled: %s", e)
            redis_pool = None
    return redis_pool
