from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth import get_current_user
import database
from models import (
    UpdatePushTokenRequest,
    UpdatePublicKeyRequest,
    UserResponse,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/search", response_model=list[UserResponse])
async def search_users(
    q: str = Query(..., min_length=2),
    current_user: dict = Depends(get_current_user),
):
    """Search users by name or email. Minimum 2 characters."""
    user_id = str(current_user["id"])
    search_pattern = f"%{q}%"

    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, name, email, avatar, public_key, is_online, created_at "
            "FROM users "
            "WHERE (name ILIKE $1 OR email ILIKE $1) AND id != $2 "
            "LIMIT 10",
            search_pattern,
            user_id,
        )

    return [UserResponse(**dict(row)) for row in rows]


@router.patch("/push-token")
async def update_push_token(
    body: UpdatePushTokenRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update the user's Expo push notification token."""
    async with database.pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET push_token = $1 WHERE id = $2",
            body.push_token,
            str(current_user["id"]),
        )

    return {"success": True}


@router.patch("/public-key")
async def update_public_key(
    body: UpdatePublicKeyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update the user's public key for E2E encryption."""
    async with database.pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET public_key = $1 WHERE id = $2",
            body.public_key,
            str(current_user["id"]),
        )

    return {"success": True}
