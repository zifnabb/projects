"""Password hashing (bcrypt), JWT session tokens, and the session cookie.

Login identity is the username; the cookie is httpOnly + Secure + SameSite=Lax
with a ~30-day rolling expiry (PLAN §15).
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Response

from app.config import get_settings

settings = get_settings()

ALGORITHM = "HS256"
COOKIE_NAME = "vermilion_session"
COOKIE_MAX_AGE = 30 * 24 * 3600  # 30 days
_BCRYPT_MAX = 72  # bcrypt only considers the first 72 bytes


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:_BCRYPT_MAX], bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:_BCRYPT_MAX], password_hash.encode())
    except (ValueError, TypeError):
        return False


def create_token(user) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "adm": user.is_admin,
        "tv": user.token_version,
        "iat": now,
        "exp": now + timedelta(seconds=COOKIE_MAX_AGE),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")
