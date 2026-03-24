import random
from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
import database
import redis_client
from models import (
    JoinPairRequest,
    GenerateCodeResponse,
    PairStatusResponse,
    PartnerResponse,
)

router = APIRouter(prefix="/pair", tags=["Pair"])


@router.post("/generate", response_model=GenerateCodeResponse)
async def generate_code(current_user: dict = Depends(get_current_user)):
    """Generate a 6-digit pairing code. Deletes any existing unused codes for this user."""
    user_id = str(current_user["id"])

    async with database.pool.acquire() as conn:
        # Check if already paired
        existing_pair = await conn.fetchrow(
            "SELECT id FROM pairs WHERE user_a = $1 OR user_b = $1", user_id
        )
        if existing_pair:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already paired",
            )

        # Delete existing unused codes for this user
        await conn.execute(
            "DELETE FROM pairing_codes WHERE created_by = $1 AND used = false", user_id
        )

        # Generate a 6-digit zero-padded code
        code = str(random.randint(0, 999999)).zfill(6)

        # Insert pairing code
        row = await conn.fetchrow(
            "INSERT INTO pairing_codes (code, created_by) VALUES ($1, $2) "
            "RETURNING code, expires_at",
            code,
            user_id,
        )

    return GenerateCodeResponse(code=row["code"], expires_at=row["expires_at"])


@router.post("/join")
async def join_pair(body: JoinPairRequest, current_user: dict = Depends(get_current_user)):
    """Join a pair using a 6-digit pairing code."""
    user_id = str(current_user["id"])

    async with database.pool.acquire() as conn:
        # Find the pairing code
        code_row = await conn.fetchrow(
            "SELECT code, created_by FROM pairing_codes "
            "WHERE code = $1 AND used = false AND expires_at > NOW()",
            body.code,
        )
        if not code_row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired code",
            )

        creator_id = str(code_row["created_by"])

        # Cannot pair with yourself
        if creator_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot pair with yourself",
            )

        # Check neither user is already paired
        existing_pair = await conn.fetchrow(
            "SELECT id FROM pairs WHERE user_a IN ($1, $2) OR user_b IN ($1, $2)",
            creator_id,
            user_id,
        )
        if existing_pair:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="One of you is already paired",
            )

        # Create pair in a transaction
        async with conn.transaction():
            pair_row = await conn.fetchrow(
                "INSERT INTO pairs (user_a, user_b) VALUES ($1, $2) RETURNING id",
                creator_id,
                user_id,
            )
            await conn.execute(
                "UPDATE pairing_codes SET used = true WHERE code = $1",
                body.code,
            )

        # Query partner profile
        partner = await conn.fetchrow(
            "SELECT id, name, avatar, public_key, is_online FROM users WHERE id = $1",
            creator_id,
        )

    return {
        "pair_id": str(pair_row["id"]),
        "partner": PartnerResponse(**dict(partner)),
    }


@router.get("/status", response_model=PairStatusResponse)
async def pair_status(current_user: dict = Depends(get_current_user)):
    """Get the current pairing status."""
    user_id = str(current_user["id"])

    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT p.id, "
            "u.id AS partner_id, u.name, u.avatar, u.public_key, u.is_online "
            "FROM pairs p "
            "JOIN users u ON u.id = CASE "
            "  WHEN p.user_a = $1 THEN p.user_b ELSE p.user_a END "
            "WHERE p.user_a = $1 OR p.user_b = $1",
            user_id,
        )

    if not row:
        return PairStatusResponse(paired=False)

    return PairStatusResponse(
        paired=True,
        pair_id=row["id"],
        partner=PartnerResponse(
            id=row["partner_id"],
            name=row["name"],
            avatar=row["avatar"],
            public_key=row["public_key"],
            is_online=row["is_online"],
        ),
    )


@router.get("/partner", response_model=PartnerResponse)
async def get_partner(current_user: dict = Depends(get_current_user)):
    """Get the partner's profile."""
    user_id = str(current_user["id"])

    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT u.id, u.name, u.avatar, u.public_key, u.is_online "
            "FROM pairs p "
            "JOIN users u ON u.id = CASE "
            "  WHEN p.user_a = $1 THEN p.user_b ELSE p.user_a END "
            "WHERE p.user_a = $1 OR p.user_b = $1",
            user_id,
        )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not paired",
        )

    return PartnerResponse(**dict(row))


@router.delete("/unpair")
async def unpair(current_user: dict = Depends(get_current_user)):
    """Unpair and clean up all Redis data for both users."""
    user_id = str(current_user["id"])

    async with database.pool.acquire() as conn:
        # Get pair info
        pair_row = await conn.fetchrow(
            "SELECT id, user_a, user_b FROM pairs WHERE user_a = $1 OR user_b = $1",
            user_id,
        )

        if not pair_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Not paired",
            )

        user_a_id = str(pair_row["user_a"])
        user_b_id = str(pair_row["user_b"])

        # Delete the pair
        await conn.execute(
            "DELETE FROM pairs WHERE user_a = $1 OR user_b = $1", user_id
        )

    # Clear Redis for both users
    try:
        # Delete offline queues
        await redis_client.redis.delete(f"offline_queue:{user_a_id}")
        await redis_client.redis.delete(f"offline_queue:{user_b_id}")

        # SCAN + DEL all pending_media keys for both users
        for uid in [user_a_id, user_b_id]:
            cursor = 0
            while True:
                cursor, keys = await redis_client.redis.scan(
                    cursor=cursor, match=f"pending_media:{uid}:*", count=100
                )
                if keys:
                    await redis_client.redis.delete(*keys)
                if cursor == 0:
                    break
    except Exception as e:
        print(f"[Unpair] Error clearing Redis: {e}")

    return {"success": True}
