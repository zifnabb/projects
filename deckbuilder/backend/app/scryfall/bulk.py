"""Scryfall bulk-data sync.

Downloads the Oracle Cards and (slimmed) Default Cards bulk files and upserts
them into `cards` / `printings`. Fully synchronous (own psycopg2 engine +
streaming JSON parse) so it can run in a worker thread without touching the
app's async event loop — the nightly APScheduler job runs it directly, and the
manual trigger calls it via asyncio.to_thread.

Bulk data has no rate limit; Scryfall asks only for a descriptive User-Agent
and that we cache >=24h (the nightly cadence satisfies that).
"""

import datetime as dt
import logging
import os
import tempfile
from collections.abc import Callable

import httpx
import ijson
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Card, Printing

log = logging.getLogger("scryfall.bulk")

BULK_MANIFEST = "https://api.scryfall.com/bulk-data"
_settings = get_settings()
_SYNC_URL = _settings.database_url.replace("+asyncpg", "+psycopg2")
_engine = create_engine(_SYNC_URL, pool_pre_ping=True, future=True)

# Printing layouts that aren't real deckbuildable cards.
_SKIP_LAYOUTS = {"art_series", "token", "double_faced_token", "emblem", "scheme", "planar", "vanguard"}


def _headers() -> dict[str, str]:
    return {"User-Agent": _settings.http_user_agent, "Accept": "application/json"}


def _bulk_uri(kind: str) -> str:
    r = httpx.get(BULK_MANIFEST, headers=_headers(), timeout=60, follow_redirects=True)
    r.raise_for_status()
    for item in r.json()["data"]:
        if item["type"] == kind:
            return item["download_uri"]
    raise ValueError(f"Scryfall bulk type {kind!r} not found in manifest")


def _download(url: str) -> str:
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    with httpx.stream("GET", url, headers=_headers(), timeout=None, follow_redirects=True) as r:
        r.raise_for_status()
        with open(path, "wb") as out:
            for chunk in r.iter_bytes(1 << 20):
                out.write(chunk)
    return path


def _oracle_id(o: dict) -> str | None:
    oid = o.get("oracle_id")
    if oid:
        return oid
    for face in o.get("card_faces") or []:
        if face.get("oracle_id"):
            return face["oracle_id"]
    return None


def _card_row(o: dict) -> dict | None:
    oid = _oracle_id(o)
    if not oid or not o.get("name"):
        return None
    return {
        "oracle_id": oid,
        "name": o["name"],
        "mana_cost": o.get("mana_cost"),
        "cmc": o.get("cmc") or 0,
        "type_line": o.get("type_line"),
        "oracle_text": o.get("oracle_text"),
        "power": o.get("power"),
        "toughness": o.get("toughness"),
        "loyalty": o.get("loyalty"),
        "colors": o.get("colors"),
        "color_identity": o.get("color_identity") or [],
        "produced_mana": o.get("produced_mana"),
        "keywords": o.get("keywords"),
        "legalities": o.get("legalities") or {},
        "prices": o.get("prices"),
        "image_uris": o.get("image_uris"),
        "card_faces": o.get("card_faces"),
        "layout": o.get("layout"),
        "edhrec_rank": o.get("edhrec_rank"),
        "reserved": bool(o.get("reserved", False)),
        "default_printing_id": o.get("id"),
    }


def _printing_row(o: dict) -> dict | None:
    if o.get("layout") in _SKIP_LAYOUTS:
        return None
    oid = _oracle_id(o)
    if not oid or not o.get("id"):
        return None
    imgs = o.get("image_uris")
    if not imgs:
        for face in o.get("card_faces") or []:
            if face.get("image_uris"):
                imgs = face["image_uris"]
                break
    released = o.get("released_at")
    return {
        "id": o["id"],
        "oracle_id": oid,
        "name": o.get("name", ""),
        "set_code": o.get("set", ""),
        "set_name": o.get("set_name"),
        "collector_number": o.get("collector_number"),
        "rarity": o.get("rarity"),
        "finishes": o.get("finishes"),
        "image_uris": imgs,
        "released_at": dt.date.fromisoformat(released) if released else None,
        "artist": o.get("artist"),
        "lang": o.get("lang", "en"),
        "prices": o.get("prices"),
    }


def _upsert(session: Session, model, rows: list[dict], key: str) -> None:
    if not rows:
        return
    # Dedupe within the batch so ON CONFLICT never hits the same row twice.
    deduped = list({r[key]: r for r in rows}.values())
    stmt = pg_insert(model)
    update = {c.name: stmt.excluded[c.name] for c in model.__table__.columns if c.name != key}
    stmt = stmt.values(deduped).on_conflict_do_update(index_elements=[key], set_=update)
    session.execute(stmt)


def _sync_kind(kind: str, model, mapper: Callable[[dict], dict | None], key: str, batch_size: int = 2000) -> int:
    log.info("scryfall sync: fetching %s manifest", kind)
    uri = _bulk_uri(kind)
    log.info("scryfall sync: downloading %s", uri)
    path = _download(uri)
    total = 0
    try:
        with Session(_engine) as session:
            batch: list[dict] = []
            with open(path, "rb") as f:
                for obj in ijson.items(f, "item"):
                    row = mapper(obj)
                    if row is None:
                        continue
                    batch.append(row)
                    if len(batch) >= batch_size:
                        _upsert(session, model, batch, key)
                        session.commit()
                        total += len(batch)
                        batch = []
            if batch:
                _upsert(session, model, batch, key)
                session.commit()
                total += len(batch)
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
    log.info("scryfall sync: %s upserted %d rows", kind, total)
    return total


def sync_bulk(kinds: tuple[str, ...] = ("oracle_cards", "default_cards")) -> dict[str, int]:
    """Sync the given bulk kinds. Returns {table: rows_processed}."""
    result: dict[str, int] = {}
    if "oracle_cards" in kinds:
        result["cards"] = _sync_kind("oracle_cards", Card, _card_row, "oracle_id")
    if "default_cards" in kinds:
        result["printings"] = _sync_kind("default_cards", Printing, _printing_row, "id")
    return result
