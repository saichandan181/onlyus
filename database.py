import os
import asyncpg
from contextlib import asynccontextmanager
from config import settings

pool: asyncpg.Pool = None


async def connect_db():
    """Create the asyncpg connection pool."""
    global pool
    pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=2,
        max_size=10,
    )
    print("[DB] Connection pool created")


async def close_db():
    """Close the asyncpg connection pool."""
    global pool
    if pool:
        await pool.close()
        print("[DB] Connection pool closed")


@asynccontextmanager
async def get_db():
    """Async context manager to acquire a connection from the pool."""
    async with pool.acquire() as conn:
        yield conn


async def run_migrations():
    """Run SQL migration files against the database (sorted by name)."""
    migrations_dir = os.path.join(os.path.dirname(__file__), "migrations")
    if not os.path.isdir(migrations_dir):
        print("[DB] No migrations directory, skipping")
        return

    files = sorted(
        f for f in os.listdir(migrations_dir) if f.endswith(".sql")
    )
    if not files:
        print("[DB] No migration files, skipping")
        return

    async with pool.acquire() as conn:
        for name in files:
            path = os.path.join(migrations_dir, name)
            with open(path, "r", encoding="utf-8") as f:
                sql = f.read()
            await conn.execute(sql)
            print(f"[DB] Applied migration: {name}")
    print("[DB] Migrations executed successfully")
