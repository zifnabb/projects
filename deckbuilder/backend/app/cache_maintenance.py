"""Nightly reaper for expired `api_cache` rows (security review 2026-07-30,
finding #6). The adapter writes cache rows but never deletes them, so expired
entries accumulate forever. Fully synchronous (own psycopg2 engine) so the
APScheduler worker thread runs it directly, like the bulk sync — never touches
the app's async event loop.
"""

import logging

from sqlalchemy import create_engine, delete, func
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import ApiCache

log = logging.getLogger("cache")

_settings = get_settings()
_SYNC_URL = _settings.database_url.replace("+asyncpg", "+psycopg2")
_engine = create_engine(_SYNC_URL, pool_pre_ping=True, future=True)


def purge_expired_cache() -> int:
    """Delete api_cache rows whose expires_at is in the past. Returns the count."""
    with Session(_engine) as session:
        result = session.execute(delete(ApiCache).where(ApiCache.expires_at < func.now()))
        session.commit()
        n = result.rowcount or 0
    if n:
        log.info("purged %d expired api_cache rows", n)
    return n
