"""Auth API (Phase 3) — username-based, invite-only, email-free (PLAN §15)."""

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.ratelimit import TooManyAttempts, limiter
from app.auth.security import (
    clear_session_cookie,
    create_token,
    hash_password,
    set_session_cookie,
    verify_password,
)
from app.db import get_session
from app.models import Invite, PasswordReset, User

router = APIRouter(prefix="/api/auth", tags=["auth"])

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
GENERIC_LOGIN_ERROR = "invalid username or password"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _user_out(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "is_admin": user.is_admin,
        "theme_pref": user.theme_pref,
    }


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _valid_invite(invite: Invite | None) -> bool:
    return bool(
        invite
        and invite.used_by is None
        and (invite.expires_at is None or invite.expires_at > _now())
    )


# --------------------------------------------------------------------------- #
class LoginBody(BaseModel):
    username: str
    password: str


class RegisterBody(BaseModel):
    invite: str
    username: str
    password: str = Field(min_length=8, max_length=200)
    display_name: str | None = None


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=200)


class ResetBody(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=200)


class UpdateMeBody(BaseModel):
    display_name: str | None = None
    theme_pref: str | None = None


# --------------------------------------------------------------------------- #
@router.post("/login")
async def login(
    body: LoginBody,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict:
    ip_key = f"ip:{_client_ip(request)}"
    user_key = f"user:{body.username.lower()}"
    try:
        limiter.guard(ip_key)
        limiter.guard(user_key)
    except TooManyAttempts as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"too many attempts, try again in {exc.retry_after}s",
        )

    user = await session.scalar(select(User).where(func.lower(User.username) == body.username.lower()))
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        limiter.fail(ip_key)
        limiter.fail(user_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_LOGIN_ERROR)

    limiter.succeed(ip_key)
    limiter.succeed(user_key)
    user.last_login_at = _now()
    await session.commit()
    set_session_cookie(response, create_token(user))
    return _user_out(user)


@router.post("/logout")
async def logout(response: Response) -> dict:
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/invite/{code}")
async def check_invite(code: str, session: AsyncSession = Depends(get_session)) -> dict:
    invite = await session.get(Invite, code)
    return {"valid": _valid_invite(invite), "note": invite.note if invite else None}


@router.post("/register")
async def register(
    body: RegisterBody,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict:
    ip_key = f"reg:{_client_ip(request)}"
    try:
        limiter.guard(ip_key)
    except TooManyAttempts as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"too many attempts, try again in {exc.retry_after}s",
        )

    invite = await session.get(Invite, body.invite)
    if not _valid_invite(invite):
        limiter.fail(ip_key)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invite no longer valid")

    if not USERNAME_RE.match(body.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="username must be 3-32 chars: letters, numbers, _ . -",
        )
    existing = await session.scalar(
        select(User).where(func.lower(User.username) == body.username.lower())
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="username already taken")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        display_name=body.display_name or body.username,
    )
    session.add(user)
    await session.flush()
    invite.used_by = user.id
    invite.used_at = _now()
    user.last_login_at = _now()
    await session.commit()
    limiter.succeed(ip_key)
    set_session_cookie(response, create_token(user))
    return _user_out(user)


@router.post("/reset")
async def reset_password(
    body: ResetBody,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict:
    ip_key = f"reset:{_client_ip(request)}"
    try:
        limiter.guard(ip_key)
    except TooManyAttempts as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"too many attempts, try again in {exc.retry_after}s",
        )

    pr = await session.get(PasswordReset, body.token)
    if pr is None or pr.used_at is not None or pr.expires_at <= _now():
        limiter.fail(ip_key)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="reset link is no longer valid")

    user = await session.get(User, pr.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="reset link is no longer valid")

    user.password_hash = hash_password(body.new_password)
    user.token_version += 1  # invalidate any existing sessions
    pr.used_at = _now()
    await session.commit()
    limiter.succeed(ip_key)
    set_session_cookie(response, create_token(user))  # log the user in on the fresh version
    return _user_out(user)


@router.get("/me")
async def me(response: Response, user: User = Depends(get_current_user)) -> dict:
    set_session_cookie(response, create_token(user))  # rolling refresh
    return _user_out(user)


@router.patch("/me")
async def update_me(
    body: UpdateMeBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if body.display_name is not None:
        user.display_name = body.display_name[:64]
    if body.theme_pref is not None:
        if body.theme_pref not in ("dark", "light"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid theme")
        user.theme_pref = body.theme_pref
    await session.commit()
    return _user_out(user)


@router.post("/change-password")
async def change_password(
    body: ChangePasswordBody,
    response: Response,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    user.token_version += 1  # log out other sessions
    await session.commit()
    set_session_cookie(response, create_token(user))  # keep this session alive
    return {"ok": True}
