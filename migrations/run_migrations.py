"""
Standalone migration runner.
Can be executed directly: python migrations/run_migrations.py
"""
import asyncio
import os
import sys

# Add parent directory to path so we can import config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg
from config import settings


async def run():
    conn = await asyncpg.connect(dsn=settings.DATABASE_URL)
    migrations_dir = os.path.dirname(os.path.abspath(__file__))
    migration_file = os.path.join(migrations_dir, "001_create_tables.sql")

    if not os.path.exists(migration_file):
        print("[Migrations] No migration file found")
        await conn.close()
        return

    with open(migration_file, "r") as f:
        sql = f.read()

    await conn.execute(sql)
    print("[Migrations] 001_create_tables.sql executed successfully")
    await conn.close()


if __name__ == "__main__":
    asyncio.run(run())
