from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from uuid import UUID


# ─── Request Models ────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    public_key: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar: Optional[str] = None


class JoinPairRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class UpdatePushTokenRequest(BaseModel):
    push_token: str


class UpdatePublicKeyRequest(BaseModel):
    public_key: str


# ─── Response Models ───────────────────────────────────────

class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    avatar: Optional[str] = None
    public_key: Optional[str] = None
    is_online: bool = False
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    user: UserResponse
    token: str


class GenerateCodeResponse(BaseModel):
    code: str
    expires_at: datetime


class PartnerResponse(BaseModel):
    id: UUID
    name: str
    avatar: Optional[str] = None
    public_key: Optional[str] = None
    is_online: bool = False

    model_config = {"from_attributes": True}


class PairStatusResponse(BaseModel):
    paired: bool
    pair_id: Optional[UUID] = None
    partner: Optional[PartnerResponse] = None
