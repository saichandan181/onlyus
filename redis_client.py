import redis.asyncio as aioredis
from config import settings

redis = None


async def connect_redis():
    """Create the async Redis connection."""
    global redis
    redis = aioredis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
    )
    # Test the connection
    await redis.ping()
    print("[Redis] Connected")


async def close_redis():
    """Close the async Redis connection."""
    global redis
    if redis:
        await redis.aclose()
        print("[Redis] Connection closed")
