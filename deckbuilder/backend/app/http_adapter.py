"""Shared outbound-HTTP adapter — the ONE polite client all third-party calls
sit behind (Scryfall search/rulings now; EDHREC / Commander Spellbook / etc.
later). Provides: descriptive User-Agent, a global <10 req/s throttle + small
concurrency cap, exponential backoff honouring Retry-After on 429, a Postgres
response cache (api_cache), and graceful-degrade via ThirdPartyError.

The frontend never calls third parties directly — everything routes here for
CORS-safety, caching, throttling, and swappability (PLAN §4).
"""

import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.sql import func

from app.config import get_settings
from app.db import SessionLocal
from app.models import ApiCache

log = logging.getLogger("http_adapter")
settings = get_settings()


class ThirdPartyError(Exception):
    """Upstream failed after retries — callers should degrade gracefully."""


class _Throttle:
    """Global rate limiter: at most `max_concurrency` in flight, and at least
    `min_interval` seconds between request starts (=> < ~1/min_interval req/s).
    """

    def __init__(self, min_interval: float, max_concurrency: int) -> None:
        self._min_interval = min_interval
        self._sem = asyncio.Semaphore(max_concurrency)
        self._lock = asyncio.Lock()
        self._last = 0.0

    async def __aenter__(self) -> "_Throttle":
        await self._sem.acquire()
        async with self._lock:
            wait = self._min_interval - (time.monotonic() - self._last)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last = time.monotonic()
        return self

    async def __aexit__(self, *exc: object) -> None:
        self._sem.release()


_throttle = _Throttle(min_interval=0.12, max_concurrency=4)  # ~8 req/s ceiling
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=20.0,
            follow_redirects=True,
            headers={"User-Agent": settings.http_user_agent, "Accept": "application/json"},
        )
    return _client


def _hash_key(provider: str, key: str) -> str:
    return hashlib.sha256(f"{provider}:{key}".encode()).hexdigest()


async def _cache_get(provider: str, key_hash: str) -> dict | None:
    async with SessionLocal() as session:
        stmt = select(ApiCache.payload).where(
            ApiCache.provider == provider,
            ApiCache.key_hash == key_hash,
            ApiCache.expires_at > func.now(),
        )
        return await session.scalar(stmt)


async def _cache_put(provider: str, key_hash: str, key_repr: str, payload: dict, ttl: int) -> None:
    expires = datetime.now(timezone.utc) + timedelta(seconds=ttl)
    async with SessionLocal() as session:
        stmt = pg_insert(ApiCache).values(
            provider=provider,
            key_hash=key_hash,
            key_repr=key_repr[:2000],
            payload=payload,
            fetched_at=func.now(),
            expires_at=expires,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["provider", "key_hash"],
            set_={
                "payload": stmt.excluded.payload,
                "fetched_at": func.now(),
                "expires_at": expires,
                "key_repr": stmt.excluded.key_repr,
            },
        )
        await session.execute(stmt)
        await session.commit()


async def fetch_json(
    provider: str,
    url: str,
    *,
    params: dict | None = None,
    ttl: int = 86_400,
    use_cache: bool = True,
    cache_errors: bool = False,
) -> dict:
    """GET url and return parsed JSON, with throttle + cache + backoff.

    - 2xx: cached for `ttl` seconds.
    - 4xx (e.g. Scryfall "no cards found" 404): the JSON error body is returned
      to the caller (not raised); cached only if `cache_errors`.
    - 5xx / network / 429-exhausted: raises ThirdPartyError so callers degrade.
    """
    logical_key = url + ("?" + urlencode(sorted(params.items())) if params else "")
    key_hash = _hash_key(provider, logical_key)

    if use_cache:
        cached = await _cache_get(provider, key_hash)
        if cached is not None:
            return cached

    client = _get_client()
    last_exc: Exception | None = None
    for attempt in range(4):
        try:
            async with _throttle:
                resp = await client.get(url, params=params)
        except httpx.HTTPError as exc:
            last_exc = exc
            log.warning("%s network error (attempt %d): %s", provider, attempt, exc)
            await asyncio.sleep(2**attempt)
            continue

        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            delay = float(retry_after) if retry_after and retry_after.isdigit() else 2**attempt
            log.warning("%s 429, backing off %.1fs", provider, delay)
            await asyncio.sleep(min(delay, 10))
            continue

        if resp.status_code >= 500:
            last_exc = ThirdPartyError(f"{provider} status {resp.status_code}")
            await asyncio.sleep(2**attempt)
            continue

        try:
            data = resp.json()
        except json.JSONDecodeError as exc:
            raise ThirdPartyError(f"{provider} returned non-JSON") from exc

        if resp.is_success and use_cache:
            await _cache_put(provider, key_hash, logical_key, data, ttl)
        elif use_cache and cache_errors:
            await _cache_put(provider, key_hash, logical_key, data, min(ttl, 3600))
        return data

    raise ThirdPartyError(f"{provider} failed after retries: {last_exc}")


async def aclose() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
