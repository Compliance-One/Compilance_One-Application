"""Register, login, refresh, logout, and /me."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.db.session import get_db
from app.models.entities import RefreshToken, User

router = APIRouter(prefix="/auth", tags=["Auth"])


class RegisterIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    phone: str = Field(..., min_length=8, max_length=20)
    password: str = Field(..., min_length=8, max_length=128)
    email: Optional[str] = Field(None, max_length=255)


class LoginIn(BaseModel):
    identifier: str = Field(..., description="Phone number or email")
    password: str = Field(..., min_length=1)


class RefreshIn(BaseModel):
    refresh_token: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserOut"


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str
    email: Optional[str] = None

    model_config = {"from_attributes": True}


def _user_out(user: User) -> UserOut:
    return UserOut(id=user.id, name=user.name, phone=user.phone, email=user.email)



def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
async def _issue_tokens(db: AsyncSession, user: User) -> TokenOut:
    access = create_access_token(user.id)
    raw, digest = generate_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(
        RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=digest,
            expires_at=expires,
        )
    )
    await db.commit()
    return TokenOut(
        access_token=access,
        refresh_token=raw,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_user_out(user),
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterIn, db: AsyncSession = Depends(get_db)):
    phone = payload.phone.strip()
    email = payload.email.strip().lower() if payload.email else None
    clauses = [User.phone == phone]
    if email:
        clauses.append(User.email == email)
    existing = await db.execute(select(User).where(or_(*clauses)))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone or email already registered")
    user = User(
        id=uuid.uuid4(),
        name=payload.name.strip(),
        phone=phone,
        email=email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()
    return await _issue_tokens(db, user)


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, db: AsyncSession = Depends(get_db)):
    ident = payload.identifier.strip()
    stmt = select(User).where(or_(User.phone == ident, User.email == ident.lower()))
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return await _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenOut)
async def refresh(payload: RefreshIn, db: AsyncSession = Depends(get_db)):
    digest = hash_refresh_token(payload.refresh_token)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == digest)
    row = (await db.execute(stmt)).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row is None or row.revoked_at is not None or _as_utc(row.expires_at) <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = await db.get(User, row.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    row.revoked_at = now
    await db.flush()
    return await _issue_tokens(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshIn, db: AsyncSession = Depends(get_db)):
    digest = hash_refresh_token(payload.refresh_token)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == digest)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is not None and row.revoked_at is None:
        row.revoked_at = datetime.now(timezone.utc)
        await db.commit()
    return None


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return _user_out(user)
