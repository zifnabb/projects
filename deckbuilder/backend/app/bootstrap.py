"""First-boot admin bootstrap (idempotent). Creates the ADMIN_USERNAME user
from env if absent; the admin changes the password in Account settings after.
The env stays the break-glass definition (PLAN §15).
"""

import logging

from sqlalchemy import func, select

from app.auth.security import hash_password
from app.config import get_settings
from app.db import SessionLocal
from app.models import User

log = logging.getLogger("bootstrap")


async def ensure_admin() -> None:
    settings = get_settings()
    async with SessionLocal() as session:
        existing = await session.scalar(
            select(User).where(func.lower(User.username) == settings.admin_username.lower())
        )
        if existing is not None:
            return
        session.add(
            User(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_password),
                display_name=settings.admin_username,
                is_admin=True,
            )
        )
        await session.commit()
        log.info("bootstrapped admin user %r", settings.admin_username)
