"""Deck export + smart import (Phase 6, PLAN §13).

Export: plain text · MTG Arena · full-fidelity JSON.
Import: two-phase — /parse (auto-detect text/Arena/CSV/JSON/Archidekt-URL,
fuzzy-resolve against local cards, return a review payload) then /commit
(new | add | replace). Archidekt + Moxfield URL pulls go through the shared
adapter (fragile, graceful-degrade → caller falls back to paste).
"""

import csv
import io as _io
import json
import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.db import get_session
from app.formats import FORMATS, allows_any_number, can_be_commander, get_format
from app.http_adapter import ThirdPartyError, fetch_json
from app.models import Card, Deck, DeckCard, DeckCategory, Printing, User
from app.naming import random_deck_name
from app.routers.decks import (
    _apply_commander,
    _load_owned,
    _refresh_deck_state,
    _serialize_full,
)
from app.scryfall.search import _playable

log = logging.getLogger("io")
router = APIRouter(prefix="/api/io", tags=["io"])

BOARD_LABELS = {"command": "Commander", "main": "Deck", "side": "Sideboard", "maybe": "Maybeboard"}
SECTION_TO_BOARD = {
    "commander": "command",
    "command": "command",
    "commandzone": "command",
    "deck": "main",
    "main": "main",
    "mainboard": "main",
    "sideboard": "side",
    "side": "side",
    "maybeboard": "maybe",
    "maybe": "maybe",
    "considering": "maybe",
}

# ------------------------------- export ------------------------------------ #


async def _printing_map(session: AsyncSession, deck_cards, cards_by_oracle) -> dict:
    """row id -> Printing (explicit printing_id, else the card's default)."""
    ids = set()
    for dc in deck_cards:
        if dc.printing_id:
            ids.add(dc.printing_id)
        else:
            card = cards_by_oracle.get(dc.oracle_id)
            if card is not None and card.default_printing_id:
                ids.add(card.default_printing_id)
    if not ids:
        return {}
    rows = (await session.execute(select(Printing).where(Printing.id.in_(ids)))).scalars()
    by_id = {p.id: p for p in rows}
    out = {}
    for dc in deck_cards:
        pid = dc.printing_id
        if not pid:
            card = cards_by_oracle.get(dc.oracle_id)
            pid = card.default_printing_id if card is not None else None
        if pid and pid in by_id:
            out[dc.id] = by_id[pid]
    return out


@router.get("/decks/{deck_id}/export")
async def export_deck(
    deck_id: str,
    fmt: str = "text",
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    deck = await _load_owned(session, deck_id, user)
    data = await _serialize_full(session, deck)

    if fmt == "json":
        # full-fidelity backup — the only lossless round-trip (PLAN §13)
        payload = {
            "vermilion_deck": 1,
            "name": data["name"],
            "format": data["format"],
            "description": data["description"],
            "commander_oracle_id": data["commander_oracle_id"],
            "categories": data["categories"],
            "tags": [t["tag"] for t in data["tags"] if t["source"] == "user"],
            "cards": [
                {
                    "oracle_id": c["oracle_id"],
                    "name": c["card"].get("name"),
                    "board": c["board"],
                    "quantity": c["quantity"],
                    "printing_id": c["printing_id"],
                    "finish": c["finish"],
                    "category": next(
                        (k["name"] for k in data["categories"] if k["id"] == c["category_id"]),
                        None,
                    ),
                }
                for c in data["cards"]
            ],
        }
        content = json.dumps(payload, indent=2)
        return {"format": "json", "filename": f"{deck.name}.json", "content": content}

    # text / arena share the sectioned shape
    rows = (await session.execute(select(DeckCard).where(DeckCard.deck_id == deck.id))).scalars().all()
    oracle_ids = {dc.oracle_id for dc in rows}
    cards = {
        c.oracle_id: c
        for c in (await session.execute(select(Card).where(Card.oracle_id.in_(oracle_ids)))).scalars()
    }
    printings = await _printing_map(session, rows, cards) if fmt == "arena" else {}

    sections: dict[str, list[str]] = {"command": [], "main": [], "side": [], "maybe": []}
    for dc in sorted(rows, key=lambda r: (cards.get(r.oracle_id).name if cards.get(r.oracle_id) else "")):
        card = cards.get(dc.oracle_id)
        name = card.name if card is not None else dc.oracle_id
        if fmt == "arena":
            p = printings.get(dc.id)
            line = (
                f"{dc.quantity} {name} ({p.set_code.upper()}) {p.collector_number}"
                if p is not None
                else f"{dc.quantity} {name}"
            )
        else:
            line = f"{dc.quantity} {name}"
        sections[dc.board].append(line)

    parts = []
    for board in ("command", "main", "side", "maybe"):
        if sections[board]:
            parts.append(BOARD_LABELS[board])
            parts.extend(sections[board])
            parts.append("")
    content = "\n".join(parts).strip() + "\n"
    ext = "txt"
    return {"format": fmt, "filename": f"{deck.name}.{ext}", "content": content}


# ------------------------------- parsing ----------------------------------- #

ARENA_RE = re.compile(r"^(\d+)x?\s+(.+?)\s+\(([A-Za-z0-9]{2,6})\)\s+([A-Za-z0-9-★]+)$")
COUNT_RE = re.compile(r"^(\d+)x?\s+(.+)$")
CATEGORY_SUFFIX_RE = re.compile(r"\s*\[([^\]]+)\]\s*$")


class ParsedLine(BaseModel):
    input: str
    name: str
    quantity: int = 1
    board: str = "main"
    category: str | None = None
    set_code: str | None = None
    collector_number: str | None = None


def _parse_text(text: str) -> list[ParsedLine]:
    lines: list[ParsedLine] = []
    board = "main"
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("//"):
            continue
        section = SECTION_TO_BOARD.get(line.rstrip(":").replace(" ", "").lower())
        if section:
            board = section
            continue
        category = None
        m = CATEGORY_SUFFIX_RE.search(line)
        if m:
            category = m.group(1).split(",")[0].strip()
            line = CATEGORY_SUFFIX_RE.sub("", line)
        m = ARENA_RE.match(line)
        if m:
            lines.append(
                ParsedLine(
                    input=raw, name=m.group(2).strip(), quantity=int(m.group(1)),
                    board=board, category=category,
                    set_code=m.group(3).lower(), collector_number=m.group(4),
                )
            )
            continue
        m = COUNT_RE.match(line)
        if m:
            lines.append(ParsedLine(input=raw, name=m.group(2).strip(), quantity=int(m.group(1)), board=board, category=category))
        else:
            lines.append(ParsedLine(input=raw, name=line, board=board, category=category))
    return lines


def _parse_csv(text: str) -> list[ParsedLine] | None:
    try:
        reader = csv.DictReader(_io.StringIO(text))
        if not reader.fieldnames:
            return None
        fields = {f.lower().strip(): f for f in reader.fieldnames}
        name_col = next((fields[k] for k in ("name", "card name", "card") if k in fields), None)
        if name_col is None:
            return None
        qty_col = next((fields[k] for k in ("quantity", "count", "qty") if k in fields), None)
        cat_col = next((fields[k] for k in ("category", "categories", "tags") if k in fields), None)
        board_col = next((fields[k] for k in ("board", "section", "zone") if k in fields), None)
        out = []
        for row in reader:
            name = (row.get(name_col) or "").strip()
            if not name:
                continue
            qty = 1
            if qty_col:
                try:
                    qty = max(1, int(float(row.get(qty_col) or 1)))
                except ValueError:
                    qty = 1
            category = None
            board = "main"
            if cat_col and row.get(cat_col):
                category = row[cat_col].split(",")[0].strip() or None
                if category and category.replace(" ", "").lower() in SECTION_TO_BOARD:
                    board = SECTION_TO_BOARD[category.replace(" ", "").lower()]
                    category = None
            if board_col and row.get(board_col):
                board = SECTION_TO_BOARD.get(row[board_col].replace(" ", "").lower(), board)
            out.append(ParsedLine(input=f"{qty} {name}", name=name, quantity=qty, board=board, category=category))
        return out or None
    except csv.Error:
        return None


def _parse_our_json(text: str) -> tuple[list[ParsedLine], dict] | None:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or "cards" not in data:
        return None
    meta = {
        "deck_name": data.get("name"),
        "format": data.get("format"),
        "description": data.get("description"),
        "categories": data.get("categories") or [],
        "tags": data.get("tags") or [],
    }
    lines = [
        ParsedLine(
            input=f"{c.get('quantity', 1)} {c.get('name', c.get('oracle_id', '?'))}",
            name=c.get("name") or "",
            quantity=int(c.get("quantity", 1)),
            board=c.get("board", "main") if c.get("board") in BOARD_LABELS else "main",
            category=c.get("category"),
        )
        for c in data["cards"]
        if c.get("name") or c.get("oracle_id")
    ]
    return lines, meta


ARCHIDEKT_URL_RE = re.compile(r"archidekt\.com/(?:api/)?decks/(\d+)")


async def _parse_archidekt(url: str) -> tuple[list[ParsedLine], dict]:
    m = ARCHIDEKT_URL_RE.search(url)
    if not m:
        raise HTTPException(status_code=400, detail="not an Archidekt deck URL")
    api_url = f"https://archidekt.com/api/decks/{m.group(1)}/"
    try:
        data = await fetch_json("archidekt", api_url, ttl=300)
    except ThirdPartyError:
        raise HTTPException(
            status_code=422,
            detail="couldn't reach Archidekt — paste the deck's text or CSV export instead",
        )
    lines: list[ParsedLine] = []
    for entry in data.get("cards", []):
        card = entry.get("card") or {}
        oracle = card.get("oracleCard") or {}
        name = oracle.get("name")
        if not name:
            continue
        cats = entry.get("categories") or []
        board = "main"
        category = None
        for c in cats:
            key = str(c).replace(" ", "").lower()
            if key in SECTION_TO_BOARD and SECTION_TO_BOARD[key] != "main":
                board = SECTION_TO_BOARD[key]
                break
        for c in cats:
            key = str(c).replace(" ", "").lower()
            if key not in SECTION_TO_BOARD:
                category = str(c)
                break
        edition = (card.get("edition") or {}).get("editioncode")
        lines.append(
            ParsedLine(
                input=f"{entry.get('quantity', 1)} {name}",
                name=name,
                quantity=int(entry.get("quantity", 1)),
                board=board,
                category=category,
                set_code=edition.lower() if edition else None,
                collector_number=str(card.get("collectorNumber") or "") or None,
            )
        )
    meta = {
        "deck_name": data.get("name"),
        "format": "commander",
        "categories": [{"name": c.get("name")} for c in data.get("categories", []) if c.get("name")],
    }
    return lines, meta


MOXFIELD_URL_RE = re.compile(r"moxfield\.com/decks/([A-Za-z0-9_-]+)")
# Moxfield board key -> our board (commanders live in the command zone)
_MOXFIELD_BOARDS = {
    "commanders": "command",
    "mainboard": "main",
    "sideboard": "side",
    "maybeboard": "maybe",
}


async def _parse_moxfield(url: str) -> tuple[list[ParsedLine], dict]:
    m = MOXFIELD_URL_RE.search(url)
    if not m:
        raise HTTPException(status_code=400, detail="not a Moxfield deck URL")
    api_url = f"https://api.moxfield.com/v2/decks/all/{m.group(1)}"
    try:
        data = await fetch_json("moxfield", api_url, ttl=300)
    except ThirdPartyError:
        raise HTTPException(
            status_code=422,
            detail="couldn't reach Moxfield — paste the deck's text or CSV export instead",
        )
    lines: list[ParsedLine] = []
    for board_key, board in _MOXFIELD_BOARDS.items():
        entries = data.get(board_key) or {}
        for name, entry in entries.items():
            qty = int(entry.get("quantity", 1))
            card = entry.get("card") or {}
            # Moxfield groups cards under user-named columns via `tags`/no
            # native category on the basic payload; leave uncategorized.
            set_code = card.get("set")
            lines.append(
                ParsedLine(
                    input=f"{qty} {name}",
                    name=name,
                    quantity=qty,
                    board=board,
                    set_code=set_code.lower() if set_code else None,
                    collector_number=str(card.get("cn") or "") or None,
                )
            )
    # adapter returns 4xx JSON bodies (e.g. a 404 for a missing/private deck)
    # instead of raising, so an empty result means "not a readable deck".
    if not lines:
        raise HTTPException(
            status_code=422,
            detail="couldn't read that Moxfield deck (private or not found) — "
            "paste the deck's text or CSV export instead",
        )
    fmt = (data.get("format") or "commander").lower()
    if fmt not in FORMATS:
        fmt = "commander"
    return lines, {"deck_name": data.get("name"), "format": fmt, "categories": []}


async def _parse_url(url: str) -> tuple[list[ParsedLine], dict]:
    if MOXFIELD_URL_RE.search(url):
        return await _parse_moxfield(url)
    if ARCHIDEKT_URL_RE.search(url):
        return await _parse_archidekt(url)
    raise HTTPException(
        status_code=400,
        detail="unsupported deck URL — use an Archidekt or Moxfield deck link, or paste the list",
    )


async def _resolve(session: AsyncSession, lines: list[ParsedLine]) -> list[dict]:
    """Fuzzy-match parsed names to local cards (exact → trigram, PLAN §13)."""
    out = []
    cache: dict[str, tuple[str | None, str | None, bool]] = {}
    for line in lines:
        key = line.name.lower()
        if key not in cache:
            # _playable + edhrec order: when a name collides (e.g. "Savage
            # Lands" — a real Land AND a Jumpstart front-card token), never
            # resolve to the non-playable token; prefer the mainstream card.
            card = await session.scalar(
                _playable(select(Card).where(func.lower(Card.name) == key))
                .order_by(Card.edhrec_rank.asc().nullslast())
            )
            if card is None:
                # front face of split/DFC names ("A // B" ↔ "A")
                card = await session.scalar(
                    _playable(select(Card).where(func.lower(Card.name).like(f"{key} // %")))
                    .order_by(Card.edhrec_rank.asc().nullslast())
                )
            if card is not None:
                cache[key] = (card.oracle_id, card.name, False)
            else:
                sim = func.similarity(func.lower(Card.name), key)
                row = (
                    await session.execute(
                        _playable(select(Card, sim).where(sim > 0.55))
                        .order_by(sim.desc()).limit(1)
                    )
                ).first()
                if row:
                    cache[key] = (row[0].oracle_id, row[0].name, True)
                else:
                    cache[key] = (None, None, False)
        oracle_id, resolved_name, fuzzy = cache[key]
        out.append(
            {
                **line.model_dump(),
                "oracle_id": oracle_id,
                "resolved_name": resolved_name,
                "fuzzy": fuzzy,
            }
        )
    return out


class ParseBody(BaseModel):
    text: str | None = None
    url: str | None = None


@router.post("/import/parse")
async def import_parse(
    body: ParseBody,
    _user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    meta: dict = {}
    if body.url:
        lines, meta = await _parse_url(body.url)
    elif body.text and body.text.strip():
        text = body.text.strip()
        parsed = _parse_our_json(text)
        if parsed:
            lines, meta = parsed
        else:
            lines = _parse_csv(text) or _parse_text(text)
    else:
        raise HTTPException(status_code=400, detail="nothing to import")

    resolved = await _resolve(session, lines)
    return {
        "lines": resolved,
        "unresolved": sum(1 for r in resolved if r["oracle_id"] is None),
        "fuzzy": sum(1 for r in resolved if r["fuzzy"]),
        **meta,
    }


# ------------------------------- commit ------------------------------------ #


class CommitLine(BaseModel):
    oracle_id: str
    quantity: int = Field(default=1, ge=1)
    board: str = "main"
    category: str | None = None
    set_code: str | None = None
    collector_number: str | None = None


class CommitCategory(BaseModel):
    name: str
    target_min: int | None = None
    target_max: int | None = None


class CommitBody(BaseModel):
    mode: str  # new | add | replace
    deck_id: str | None = None
    name: str | None = None
    format: str = "commander"
    lines: list[CommitLine]
    categories: list[CommitCategory] = Field(default_factory=list)


@router.post("/import/commit")
async def import_commit(
    body: CommitBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if body.mode not in ("new", "add", "replace"):
        raise HTTPException(status_code=400, detail="mode must be new | add | replace")

    if body.mode == "new":
        if body.format not in FORMATS:
            raise HTTPException(status_code=400, detail="unknown format")
        deck = Deck(
            user_id=user.id,
            name=(body.name or "").strip() or random_deck_name(),
            format=body.format,
        )
        session.add(deck)
        await session.flush()
    else:
        if not body.deck_id:
            raise HTTPException(status_code=400, detail="deck_id required")
        deck = await _load_owned(session, body.deck_id, user)
        if body.mode == "replace":
            await session.execute(delete(DeckCard).where(DeckCard.deck_id == deck.id))
            await session.execute(delete(DeckCategory).where(DeckCategory.deck_id == deck.id))
            deck.commander_oracle_id = None
            await session.flush()

    # categories: explicit (with ranges, from JSON) + any referenced by lines
    existing = {
        c.name.lower(): c
        for c in (
            await session.execute(select(DeckCategory).where(DeckCategory.deck_id == deck.id))
        ).scalars()
    }
    wanted: dict[str, CommitCategory] = {c.name.lower(): c for c in body.categories if c.name}
    for line in body.lines:
        if line.category and line.category.lower() not in wanted:
            wanted[line.category.lower()] = CommitCategory(name=line.category)
    pos = len(existing)
    for key, cat in wanted.items():
        if key in existing:
            continue
        dc = DeckCategory(
            deck_id=deck.id, name=cat.name, position=pos,
            target_min=cat.target_min, target_max=cat.target_max, source="user",
        )
        session.add(dc)
        await session.flush()
        existing[key] = dc
        pos += 1

    # cards
    oracle_ids = {line.oracle_id for line in body.lines}
    cards = {
        c.oracle_id: c
        for c in (await session.execute(select(Card).where(Card.oracle_id.in_(oracle_ids)))).scalars()
    }
    # printing lookup by set+collector
    keys = {(l.set_code, l.collector_number) for l in body.lines if l.set_code and l.collector_number}
    printings: dict[tuple, str] = {}
    if keys:
        rows = (
            await session.execute(
                select(Printing).where(
                    Printing.set_code.in_({k[0] for k in keys}),
                )
            )
        ).scalars()
        for p in rows:
            printings[(p.set_code, p.collector_number)] = p.id

    singleton = get_format(deck.format)["singleton"]
    current = {
        (dc.oracle_id, dc.board): dc
        for dc in (
            await session.execute(select(DeckCard).where(DeckCard.deck_id == deck.id))
        ).scalars()
    }
    commander_candidate: str | None = None
    for line in body.lines:
        card = cards.get(line.oracle_id)
        if card is None:
            continue
        if line.board == "command" and commander_candidate is None and can_be_commander(card):
            commander_candidate = line.oracle_id
            continue  # the command-zone row is managed by _apply_commander
        board = line.board if line.board in BOARD_LABELS else "main"
        qty = 1 if (singleton and not allows_any_number(card)) else line.quantity
        printing_id = printings.get((line.set_code, line.collector_number)) if line.set_code else None
        category = existing.get(line.category.lower()) if line.category else None
        key = (line.oracle_id, board)
        if key in current:
            row = current[key]
            row.quantity = 1 if (singleton and not allows_any_number(card)) else row.quantity + qty
            if category is not None:
                row.category_id = category.id
        else:
            row = DeckCard(
                deck_id=deck.id, oracle_id=line.oracle_id, board=board, quantity=qty,
                printing_id=printing_id, category_id=category.id if category else None,
            )
            session.add(row)
            current[key] = row

    if commander_candidate and deck.commander_oracle_id is None:
        await _apply_commander(session, deck, commander_candidate)

    await _refresh_deck_state(session, deck)
    await session.commit()
    return await _serialize_full(session, deck)
