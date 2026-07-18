"""Auth dependencies: resolve the current user from the session cookie, and
gate admin-only routes. Enforces token_version (session invalidation) and
is_active (deactivation kills live sessions).
"""

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import COOKIE_NAME, decode_token
from app.db import get_session
from app.models import User


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    try:
        payload = decode_token(token)
    except Exception:  # noqa: BLE001 — any decode/expiry failure = unauthenticated
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid session")

    user = await session.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="session invalid")
    if user.token_version != payload.get("tv"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="session expired")
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin only")
    return user
