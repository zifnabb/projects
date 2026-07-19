"""Scryfall-backed search.

Two lanes (PLAN §8):
- autocomplete / quick-add -> local Postgres pg_trgm (instant, no API calls);
- full search -> proxy Scryfall /cards/search server-side (throttled + cached
  via the shared adapter), results hydrated from local `cards`, graceful-degrade
  to a local name search if Scryfall is unavailable.
"""

import logging

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.http_adapter import ThirdPartyError, fetch_json
from app.models import Card, Printing

log = logging.getLogger("scryfall.search")

SEARCH_URL = "https://api.scryfall.com/cards/search"
RULINGS_URL = "https://api.scryfall.com/cards/{id}/rulings"

# Non-playable layouts excluded from deck-building search (tokens, emblems…).
_NON_PLAYABLE_LAYOUTS = ("token", "double_faced_token", "emblem", "art_series")


def _playable(stmt):
    return stmt.where(
        or_(Card.layout.is_(None), Card.layout.notin_(_NON_PLAYABLE_LAYOUTS))
    )


def _serialize(card: Card | None, payload: dict | None) -> dict:
    """Merge a local gameplay row with a Scryfall search payload. Local fields
    win for gameplay data; the payload provides the image + any brand-new card
    not yet in the local sync.
    """
    p = payload or {}
    image = p.get("image_uris") or {}
    if not image and p.get("card_faces"):
        image = (p["card_faces"][0] or {}).get("image_uris") or {}
    if card is not None:
        return {
            "oracle_id": card.oracle_id,
            "name": card.name,
            "mana_cost": card.mana_cost,
            "cmc": card.cmc,
            "type_line": card.type_line,
            "oracle_text": card.oracle_text,
            "colors": card.colors,
            "color_identity": card.color_identity,
            "power": card.power,
            "toughness": card.toughness,
            "loyalty": card.loyalty,
            "keywords": card.keywords,
            "legalities": card.legalities,
            "edhrec_rank": card.edhrec_rank,
            "image": image or (card.image_uris or {}),
            "in_local": True,
        }
    # brand-new card not yet synced: fall back to the payload
    return {
        "oracle_id": p.get("oracle_id"),
        "name": p.get("name"),
        "mana_cost": p.get("mana_cost"),
        "cmc": p.get("cmc"),
        "type_line": p.get("type_line"),
        "oracle_text": p.get("oracle_text"),
        "colors": p.get("colors"),
        "color_identity": p.get("color_identity"),
        "power": p.get("power"),
        "toughness": p.get("toughness"),
        "loyalty": p.get("loyalty"),
        "keywords": p.get("keywords"),
        "legalities": p.get("legalities"),
        "edhrec_rank": p.get("edhrec_rank"),
        "image": image,
        "in_local": False,
    }


async def autocomplete(
    session: AsyncSession, q: str, limit: int = 15, *, commanders_only: bool = False
) -> list[dict]:
    q = q.strip()
    if not q:
        return []
    lowered = q.lower()
    like = f"%{lowered}%"
    prefix = f"{lowered}%"
    # prefix matches first, then shortest names, then alphabetical
    stmt = _playable(
        select(Card)
        .where(func.lower(Card.name).like(like))
        .order_by(
            (func.lower(Card.name).like(prefix)).desc(),
            func.length(Card.name),
            Card.name,
        )
        .limit(limit)
    )
    if commanders_only:
        # valid commanders, commander-legal (the picker's "legal only" toggle)
        stmt = stmt.where(
            or_(
                and_(
                    func.lower(Card.type_line).like("%legendary%"),
                    func.lower(Card.type_line).like("%creature%"),
                ),
                func.lower(Card.oracle_text).like("%can be your commander%"),
            ),
            Card.legalities["commander"].astext == "legal",
        )
    cards = (await session.execute(stmt)).scalars().all()
    return [
        {
            "name": c.name,
            "oracle_id": c.oracle_id,
            "mana_cost": c.mana_cost,
            "type_line": c.type_line,
            "color_identity": c.color_identity,
            "image": c.image_uris or {},
        }
        for c in cards
    ]


async def _local_fallback(session: AsyncSession, query: str, limit: int = 60) -> dict:
    # Best-effort degrade: treat the query as a name substring.
    like = f"%{query.lower()}%"
    stmt = _playable(
        select(Card)
        .where(func.lower(Card.name).like(like))
        .order_by(func.length(Card.name), Card.name)
        .limit(limit)
    )
    cards = (await session.execute(stmt)).scalars().all()
    return {
        "total": len(cards),
        "has_more": False,
        "page": 1,
        "degraded": True,
        "results": [_serialize(c, None) for c in cards],
    }


async def full_search(
    session: AsyncSession,
    query: str,
    *,
    page: int = 1,
    order: str = "name",
    unique: str = "cards",
) -> dict:
    query = query.strip()
    if not query:
        return {"total": 0, "has_more": False, "page": page, "results": []}

    params = {"q": query, "page": page, "order": order, "unique": unique}
    try:
        data = await fetch_json("scryfall_search", SEARCH_URL, params=params, ttl=86_400)
    except ThirdPartyError:
        log.warning("scryfall search degraded to local for %r", query)
        return await _local_fallback(session, query)

    if data.get("object") == "error":
        # e.g. 404 "no cards found", or a bad-syntax 400
        return {
            "total": 0,
            "has_more": False,
            "page": page,
            "results": [],
            "warning": data.get("details"),
        }

    payloads = data.get("data", [])
    oracle_ids = [c["oracle_id"] for c in payloads if c.get("oracle_id")]
    local: dict[str, Card] = {}
    if oracle_ids:
        rows = (await session.execute(select(Card).where(Card.oracle_id.in_(oracle_ids)))).scalars().all()
        local = {c.oracle_id: c for c in rows}

    results = [_serialize(local.get(c.get("oracle_id")), c) for c in payloads]
    return {
        "total": data.get("total_cards", len(results)),
        "has_more": data.get("has_more", False),
        "page": page,
        "results": results,
    }


async def card_detail(session: AsyncSession, oracle_id: str) -> dict | None:
    card = await session.get(Card, oracle_id)
    if card is None:
        return None
    prints = (
        await session.execute(
            select(Printing).where(Printing.oracle_id == oracle_id).order_by(Printing.released_at.desc())
        )
    ).scalars().all()
    detail = _serialize(card, None)
    detail["prices"] = card.prices
    detail["reserved"] = card.reserved
    detail["layout"] = card.layout
    detail["default_printing_id"] = card.default_printing_id
    detail["printings"] = [
        {
            "id": p.id,
            "set_code": p.set_code,
            "set_name": p.set_name,
            "collector_number": p.collector_number,
            "rarity": p.rarity,
            "finishes": p.finishes,
            "released_at": p.released_at.isoformat() if p.released_at else None,
            "artist": p.artist,
            "image": p.image_uris or {},
        }
        for p in prints
    ]
    return detail


async def rulings(scryfall_id: str) -> list[dict] | None:
    """On-demand, cached rulings for a printing id. None => source unavailable
    (caller shows 'rulings unavailable'); [] => genuinely no rulings.
    """
    try:
        data = await fetch_json(
            "scryfall_rulings", RULINGS_URL.format(id=scryfall_id), ttl=7 * 86_400
        )
    except ThirdPartyError:
        return None
    if data.get("object") == "error":
        return []
    return [
        {"source": r.get("source"), "published_at": r.get("published_at"), "comment": r.get("comment")}
        for r in data.get("data", [])
    ]
