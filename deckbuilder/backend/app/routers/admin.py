"""Admin API (Phase 3) — invites + users. All routes require an admin session.

Minimal by design (a handful of friends): mint/list/revoke invites; list users,
deactivate/reactivate, mint reset links, promote/demote admin with a
never-zero-active-admins guard (PLAN §15).
"""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_admin
from app.db import get_session
from app.models import Invite, PasswordReset, User

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])

RESET_TTL = timedelta(hours=2)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _invite_out(i: Invite) -> dict:
    return {
        "code": i.code,
        "note": i.note,
        "created_at": i.created_at.isoformat() if i.created_at else None,
        "expires_at": i.expires_at.isoformat() if i.expires_at else None,
        "used_by": i.used_by,
        "used_at": i.used_at.isoformat() if i.used_at else None,
        "register_path": f"/register?invite={i.code}",
    }


def _user_admin_out(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "display_name": u.display_name,
        "is_admin": u.is_admin,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
    }


async def _active_admin_count(session: AsyncSession, exclude_id: str | None = None) -> int:
    stmt = select(func.count()).select_from(User).where(User.is_admin.is_(True), User.is_active.is_(True))
    if exclude_id:
        stmt = stmt.where(User.id != exclude_id)
    return await session.scalar(stmt) or 0


class MintInviteBody(BaseModel):
    note: str | None = None
    expires_in_days: int | None = None


class SetActiveBody(BaseModel):
    active: bool


class SetAdminBody(BaseModel):
    is_admin: bool


# ------------------------------- invites ---------------------------------- #
@router.post("/invites")
async def mint_invite(
    body: MintInviteBody,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    code = secrets.token_urlsafe(24)
    expires_at = _now() + timedelta(days=body.expires_in_days) if body.expires_in_days else None
    invite = Invite(code=code, created_by=admin.id, note=body.note, expires_at=expires_at)
    session.add(invite)
    await session.commit()
    return _invite_out(invite)


@router.get("/invites")
async def list_invites(session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows = await session.execute(select(Invite).order_by(Invite.created_at.desc()))
    return [_invite_out(i) for i in rows.scalars()]


@router.delete("/invites/{code}")
async def revoke_invite(code: str, session: AsyncSession = Depends(get_session)) -> dict:
    invite = await session.get(Invite, code)
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="invite not found")
    if invite.used_by is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invite already used")
    await session.delete(invite)
    await session.commit()
    return {"ok": True}


# -------------------------------- users ------------------------------------ #
@router.get("/users")
async def list_users(session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows = await session.execute(select(User).order_by(User.created_at))
    return [_user_admin_out(u) for u in rows.scalars()]


@router.post("/users/{user_id}/active")
async def set_active(
    user_id: str,
    body: SetActiveBody,
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    if not body.active and user.is_admin and await _active_admin_count(session, exclude_id=user.id) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="cannot deactivate the last admin")
    user.is_active = body.active
    if not body.active:
        user.token_version += 1  # kill live sessions immediately
    await session.commit()
    return _user_admin_out(user)


@router.post("/users/{user_id}/admin")
async def set_admin(
    user_id: str,
    body: SetAdminBody,
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    if not body.is_admin and user.is_admin and await _active_admin_count(session, exclude_id=user.id) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="cannot demote the last admin")
    user.is_admin = body.is_admin
    user.token_version += 1  # refresh admin claim in existing sessions
    await session.commit()
    return _user_admin_out(user)


@router.post("/users/{user_id}/reset-link")
async def mint_reset_link(user_id: str, session: AsyncSession = Depends(get_session)) -> dict:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    token = secrets.token_urlsafe(24)
    pr = PasswordReset(token=token, user_id=user_id, expires_at=_now() + RESET_TTL)
    session.add(pr)
    await session.commit()
    return {"token": token, "reset_path": f"/reset?token={token}", "expires_at": pr.expires_at.isoformat()}
