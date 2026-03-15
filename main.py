"""
main.py — Only Us Backend
Unified ASGI app: FastAPI REST + python-socketio relay.
"""

import uvicorn
import socketio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import connect_db, close_db, run_migrations, pool
from redis_client import connect_redis, close_redis
from relay import sio
from routes.auth import router as auth_router
from routes.pair import router as pair_router
from routes.users import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle handler."""
    # ── Startup ──
    print("[Server] Starting up...")
    await connect_db()
    await run_migrations()
    await connect_redis()
    print("[Server] Ready!")

    yield

    # ── Shutdown ──
    print("[Server] Shutting down...")
    try:
        # Set all users offline
        from database import pool as db_pool
        if db_pool:
            async with db_pool.acquire() as conn:
                await conn.execute("UPDATE users SET is_online = false")
    except Exception as e:
        print(f"[Server] Error resetting online status: {e}")

    await close_redis()
    await close_db()
    print("[Server] Shutdown complete")


# Create FastAPI app
fastapi_app = FastAPI(
    title="Only Us API",
    description="Private couples chat backend — blind relay architecture",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
origins = settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS != "*" else ["*"]
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
fastapi_app.include_router(auth_router)
fastapi_app.include_router(pair_router)
fastapi_app.include_router(users_router)


@fastapi_app.get("/")
async def health():
    return {
        "app": "Only Us",
        "status": "running",
        "version": "1.0.0",
    }


# Wrap FastAPI with Socket.IO ASGI app
combined_app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)


if __name__ == "__main__":
    uvicorn.run(
        "main:combined_app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
    )
