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
# Use re.sub with ^ anchor to avoid partial substring replacement bugs
import re as _re
ASYNCPG_URL = _re.sub(r'^postgres(ql\+asyncpg)?://', 'postgresql://', _raw_url)

# Log the host we're connecting to (safe: no password)
_db_host = ASYNCPG_URL.split("@")[-1].split("/")[0] if "@" in ASYNCPG_URL else ASYNCPG_URL
logger.info("DATABASE_URL normalized. Connecting to host: %s", _db_host)

pool = None
redis_pool = None


async def get_pool():h
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
