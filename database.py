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
    """Run SQL migration files against the database."""
    migrations_dir = os.path.join(os.path.dirname(__file__), "migrations")
    migration_file = os.path.join(migrations_dir, "001_create_tables.sql")

    if not os.path.exists(migration_file):
        print("[DB] No migration file found, skipping")
        return

    with open(migration_file, "r") as f:
        sql = f.read()

    async with pool.acquire() as conn:
        await conn.execute(sql)
    print("[DB] Migrations executed successfully")
