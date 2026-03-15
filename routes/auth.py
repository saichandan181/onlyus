from fastapi import APIRouter, Depends, HTTPException, status

from auth import hash_password, verify_password, create_token, get_current_user
import database
from models import (
    RegisterRequest,
    LoginRequest,
    UpdateProfileRequest,
    UserResponse,
    AuthResponse,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    """Register a new user account."""
    async with database.pool.acquire() as conn:
        # Check if email already exists
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1", body.email
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        # Hash password and insert user
        hashed = hash_password(body.password)
        row = await conn.fetchrow(
            "INSERT INTO users (name, email, password_hash, public_key) "
            "VALUES ($1, $2, $3, $4) "
            "RETURNING id, name, email, avatar, public_key, is_online, created_at",
            body.name,
            body.email,
            hashed,
            body.public_key,
        )

    user = dict(row)
    token = create_token(str(user["id"]), user["email"])

    return AuthResponse(
        user=UserResponse(**user),
        token=token,
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    """Authenticate and return a JWT token."""
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, name, email, password_hash, avatar, public_key, is_online, created_at "
            "FROM users WHERE email = $1",
            body.email,
        )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user = dict(row)
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_token(str(user["id"]), user["email"])

    return AuthResponse(
        user=UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            avatar=user["avatar"],
            public_key=user["public_key"],
            is_online=user["is_online"],
            created_at=user["created_at"],
        ),
        token=token,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get the authenticated user's profile."""
    return UserResponse(
        id=current_user["id"],
        name=current_user["name"],
        email=current_user["email"],
        avatar=current_user["avatar"],
        public_key=current_user["public_key"],
        is_online=current_user["is_online"],
        created_at=current_user["created_at"],
    )


@router.patch("/me", response_model=UserResponse)
async def update_me(body: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    """Update the authenticated user's profile (name and/or avatar)."""
    updates = []
    values = []
    idx = 1

    if body.name is not None:
        updates.append(f"name = ${idx}")
        values.append(body.name)
        idx += 1

    if body.avatar is not None:
        updates.append(f"avatar = ${idx}")
        values.append(body.avatar)
        idx += 1

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    values.append(str(current_user["id"]))
    query = (
        f"UPDATE users SET {', '.join(updates)} WHERE id = ${idx} "
        f"RETURNING id, name, email, avatar, public_key, is_online, created_at"
    )

    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(query, *values)

    return UserResponse(**dict(row))


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Log out: set offline and clear push token."""
    async with database.pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET is_online = false, push_token = NULL WHERE id = $1",
            str(current_user["id"]),
        )

    return {"success": True}
