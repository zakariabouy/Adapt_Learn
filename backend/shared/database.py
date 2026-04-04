import os
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
# Convert to standard postgres scheme for asyncpg
ASYNCPG_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()

pool = None

async def get_pool():
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(ASYNCPG_URL)
    return pool

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
