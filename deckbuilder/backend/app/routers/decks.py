"""Decks API (Phase 4) — CRUD, boards, categories, tags, clone, share,
color-identity + legality validation, Draft→Legal auto-tag, template seeding.
"""

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.db import get_session
from app.deck_templates import template_for_format
from app.formats import DEFAULT_FORMAT, FORMATS, allows_any_number, get_format, validate_deck
from app.game_changers import GAME_CHANGER_ORACLE_IDS
from app.models import Card, Deck, DeckCard, DeckCategory, DeckTag, Printing, User
from app.naming import random_deck_name

router = APIRouter(prefix="/api", tags=["decks"])
BOARDS = {"main", "side", "maybe", "command"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ------------------------------ bodies ------------------------------------- #
class CreateDeckBody(BaseModel):
    name: str | None = None
    format: str = DEFAULT_FORMAT
    commander_oracle_id: str | None = None
    use_template: bool = True
    visibility: str = "private"
    description: str | None = None


class UpdateDeckBody(BaseModel):
    name: str | None = None
    description: str | None = None
    format: str | None = None
    commander_oracle_id: str | None = None
    deck_art_oracle_id: str | None = None


class AddCardBody(BaseModel):
    oracle_id: str
    board: str = "main"
    quantity: int = Field(default=1, ge=1)
    printing_id: str | None = None
    finish: str | None = None
    category_id: str | None = None


class UpdateCardBody(BaseModel):
    board: str | None = None
    quantity: int | None = Field(default=None, ge=1)
    printing_id: str | None = None
    finish: str | None = None
    category_id: str | None = None


class CategoryBody(BaseModel):
    name: str
    target_min: int | None = None
    target_max: int | None = None
    color_tag: str | None = None
    position: int | None = None


class TagBody(BaseModel):
    tag: str


class CategoryOrderBody(BaseModel):
    order: list[str]  # category ids, new display order


class VisibilityBody(BaseModel):
    visibility: str  # private | shared


# ------------------------------ helpers ------------------------------------ #
async def _load_owned(session: AsyncSession, deck_id: str, user: User) -> Deck:
    deck = await session.get(Deck, deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="deck not found")
    if deck.user_id != user.id:
        raise HTTPException(status_code=403, detail="not your deck")
    return deck


async def _deck_cards(session: AsyncSession, deck_id: str) -> list[DeckCard]:
    rows = await session.execute(select(DeckCard).where(DeckCard.deck_id == deck_id))
    return list(rows.scalars())


async def _card_map(session: AsyncSession, oracle_ids: set[str]) -> dict[str, Card]:
    if not oracle_ids:
        return {}
    rows = await session.execute(select(Card).where(Card.oracle_id.in_(oracle_ids)))
    return {c.oracle_id: c for c in rows.scalars()}


async def _refresh_deck_state(session: AsyncSession, deck: Deck) -> dict:
    """Recompute color identity (from commander) + legality, sync Draft/Legal
    system tag, bump updated_at. Returns the legality result.
    """
    cards = await _deck_cards(session, deck.id)
    ids = {dc.oracle_id for dc in cards}
    if deck.commander_oracle_id:
        ids.add(deck.commander_oracle_id)
    cmap = await _card_map(session, ids)

    if deck.commander_oracle_id and deck.commander_oracle_id in cmap:
        deck.color_identity = list(cmap[deck.commander_oracle_id].color_identity or [])

    legality = validate_deck(deck.format, deck, cmap, cards)

    await session.execute(
        delete(DeckTag).where(DeckTag.deck_id == deck.id, DeckTag.source == "system")
    )
    session.add(DeckTag(deck_id=deck.id, tag="Legal" if legality["legal"] else "Draft", source="system"))
    deck.updated_at = _now()
    return legality


async def _apply_commander(session: AsyncSession, deck: Deck, oracle_id: str | None) -> None:
    """Set/replace the commander and keep a command-board card in sync."""
    await session.execute(
        delete(DeckCard).where(DeckCard.deck_id == deck.id, DeckCard.board == "command")
    )
    deck.commander_oracle_id = oracle_id
    if oracle_id:
        session.add(DeckCard(deck_id=deck.id, oracle_id=oracle_id, board="command", quantity=1))


def _face_summaries(faces: list | None) -> list[dict] | None:
    """Per-face name + image for double-faced cards (transform / modal_dfc /
    flip …). Top-level `image_uris` is null on these, so the board must read
    face images or it renders blank. None for single-faced cards."""
    if not faces or len(faces) < 2:
        return None
    out = []
    for f in faces:
        out.append(
            {
                "name": f.get("name"),
                "image": f.get("image_uris") or {},
                "mana_cost": f.get("mana_cost"),
                "type_line": f.get("type_line"),
                "oracle_text": f.get("oracle_text"),
            }
        )
    return out


def _card_summary(card: Card | None, printing: Printing | None = None) -> dict:
    if card is None:
        return {}
    # both faces follow the selected printing when it carries per-face art;
    # otherwise the oracle (default-printing) faces.
    faces = None
    if printing is not None:
        faces = _face_summaries(printing.card_faces)
    if faces is None:
        faces = _face_summaries(card.card_faces)
    # image precedence: selected printing → card default → front face (MDFC)
    image = (printing.image_uris if printing else None) or card.image_uris or {}
    if not image and faces:
        image = faces[0]["image"]
    return {
        "name": card.name,
        "mana_cost": card.mana_cost,
        "cmc": card.cmc,
        "type_line": card.type_line,
        "color_identity": card.color_identity,
        "image": image or {},
        # double-faced cards: face images so the board can render + flip
        "faces": faces,
        "layout": card.layout,
        "keywords": card.keywords,
        # WotC Commander Game Changer (per-card label, PLAN §11)
        "game_changer": card.oracle_id in GAME_CHANGER_ORACLE_IDS,
        # singleton formats: only these cards may exceed quantity 1
        "multiples_ok": allows_any_number(card),
        # stats sidebar inputs (color cost & production, PLAN §11)
        "produced_mana": card.produced_mana,
    }


def _card_issues(deck: Deck, fmt: dict, dc: DeckCard, card: Card | None) -> list[str]:
    """Per-row legality problems (yellow highlight in the UI) — same rules as
    validate_deck, but evaluated per card so the board can flag offenders.
    Format/identity issues flag every board; the singleton cap only counts
    main+command (matching the deck-level check)."""
    if card is None:
        return []
    issues: list[str] = []
    status = (card.legalities or {}).get(deck.format)
    if status == "banned":
        issues.append(f"Banned in {fmt['name']}")
    elif status == "not_legal":
        issues.append(f"Not legal in {fmt['name']}")
    if fmt["enforce_color_identity"] and deck.commander_oracle_id:
        if not set(card.color_identity or []) <= set(deck.color_identity or []):
            issues.append("Outside the commander's color identity")
    if (
        fmt["singleton"]
        and dc.board in ("main", "command")
        and dc.quantity > 1
        and not allows_any_number(card)
    ):
        issues.append(f"Appears {dc.quantity}× (singleton allows one)")
    return issues


async def _serialize_full(session: AsyncSession, deck: Deck) -> dict:
    cards = await _deck_cards(session, deck.id)
    ids = {dc.oracle_id for dc in cards}
    if deck.commander_oracle_id:
        ids.add(deck.commander_oracle_id)
    cmap = await _card_map(session, ids)
    legality = validate_deck(deck.format, deck, cmap, cards)
    fmt = get_format(deck.format)

    # selected-printing images so the board reflects the chosen art (PLAN §9)
    printing_ids = {dc.printing_id for dc in cards if dc.printing_id}
    pmap: dict[str, Printing] = {}
    if printing_ids:
        pmap = {
            p.id: p
            for p in (
                await session.execute(select(Printing).where(Printing.id.in_(printing_ids)))
            ).scalars().all()
        }

    cats = (
        await session.execute(
            select(DeckCategory).where(DeckCategory.deck_id == deck.id).order_by(DeckCategory.position)
        )
    ).scalars().all()
    tags = (await session.execute(select(DeckTag).where(DeckTag.deck_id == deck.id))).scalars().all()

    return {
        "id": deck.id,
        "name": deck.name,
        "format": deck.format,
        "format_info": get_format(deck.format),
        "commander_oracle_id": deck.commander_oracle_id,
        "color_identity": deck.color_identity,
        "description": deck.description,
        "deck_art_oracle_id": deck.deck_art_oracle_id,
        "visibility": deck.visibility,
        "share_token": deck.share_token,
        "created_at": deck.created_at.isoformat() if deck.created_at else None,
        "updated_at": deck.updated_at.isoformat() if deck.updated_at else None,
        "legality": legality,
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "position": c.position,
                "target_min": c.target_min,
                "target_max": c.target_max,
                "color_tag": c.color_tag,
                "source": c.source,
            }
            for c in cats
        ],
        "cards": [
            {
                "id": dc.id,
                "oracle_id": dc.oracle_id,
                "board": dc.board,
                "quantity": dc.quantity,
                "printing_id": dc.printing_id,
                "finish": dc.finish,
                "category_id": dc.category_id,
                "card": _card_summary(
                    cmap.get(dc.oracle_id),
                    pmap.get(dc.printing_id) if dc.printing_id else None,
                ),
                "issues": _card_issues(deck, fmt, dc, cmap.get(dc.oracle_id)),
            }
            for dc in cards
        ],
        "tags": [{"tag": t.tag, "source": t.source} for t in tags],
    }


# ------------------------------ endpoints ---------------------------------- #
@router.get("/formats")
async def formats_catalog() -> dict:
    """The format catalog (config, PLAN §6) — drives the New-Deck picker.
    Each format also carries its default deckbuilding template (or null) so
    the New-Deck toggle can preview the skeleton buckets.
    """
    out = {}
    for key, fmt in FORMATS.items():
        tmpl = template_for_format(key)
        out[key] = {**fmt, "template": tmpl}
    return {"default": DEFAULT_FORMAT, "formats": out}


@router.get("/decks/random-name")
async def deck_random_name() -> dict:
    """A randomized MTG-flavored deck name for the New-Deck 🎲 re-roll (PLAN §12).
    Declared before /decks/{deck_id} so the literal path wins.
    """
    return {"name": random_deck_name()}


@router.post("/decks", status_code=status.HTTP_201_CREATED)
async def create_deck(
    body: CreateDeckBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if body.format not in FORMATS:
        raise HTTPException(status_code=400, detail="unknown format")
    deck = Deck(
        user_id=user.id,
        name=(body.name or "").strip() or random_deck_name(),
        format=body.format,
        visibility="shared" if body.visibility == "shared" else "private",
        description=body.description,
    )
    if deck.visibility == "shared":
        deck.share_token = secrets.token_urlsafe(16)
    session.add(deck)
    await session.flush()

    # seed template categories
    if body.use_template:
        tmpl = template_for_format(body.format)
        if tmpl:
            for pos, cat in enumerate(tmpl["categories"]):
                session.add(
                    DeckCategory(
                        deck_id=deck.id,
                        name=cat["name"],
                        position=pos,
                        target_min=cat.get("target_min"),
                        target_max=cat.get("target_max"),
                        source="template",
                    )
                )

    if body.commander_oracle_id:
        await _apply_commander(session, deck, body.commander_oracle_id)

    await _refresh_deck_state(session, deck)
    await session.commit()
    return await _serialize_full(session, deck)


@router.get("/decks")
async def list_decks(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    decks = (
        await session.execute(select(Deck).where(Deck.user_id == user.id).order_by(Deck.updated_at.desc()))
    ).scalars().all()
    ids = [d.id for d in decks]
    counts: dict[str, int] = {}
    tags: dict[str, list[str]] = {}
    art: dict[str, str] = {}
    if ids:
        rows = await session.execute(
            select(DeckCard.deck_id, func.coalesce(func.sum(DeckCard.quantity), 0))
            .where(DeckCard.deck_id.in_(ids), DeckCard.board.in_(("main", "command")))
            .group_by(DeckCard.deck_id)
        )
        counts = {d: int(n) for d, n in rows.all()}
        trows = await session.execute(select(DeckTag).where(DeckTag.deck_id.in_(ids)))
        for t in trows.scalars():
            tags.setdefault(t.deck_id, []).append(t.tag)
        # dashboard tile art: deck art wins, else commander; art_crop preferred
        art_ids = {d.deck_art_oracle_id or d.commander_oracle_id for d in decks} - {None}
        cmap = await _card_map(session, art_ids)  # type: ignore[arg-type]
        for d in decks:
            card = cmap.get(d.deck_art_oracle_id or d.commander_oracle_id or "")
            if card and card.image_uris:
                url = card.image_uris.get("art_crop") or card.image_uris.get("normal")
                if url:
                    art[d.id] = url
    return [
        {
            "id": d.id,
            "name": d.name,
            "format": d.format,
            "color_identity": d.color_identity,
            "commander_oracle_id": d.commander_oracle_id,
            "deck_art_oracle_id": d.deck_art_oracle_id,
            "visibility": d.visibility,
            "size": counts.get(d.id, 0),
            "tags": tags.get(d.id, []),
            "art": art.get(d.id),
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
        }
        for d in decks
    ]


@router.get("/decks/{deck_id}")
async def get_deck(
    deck_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    deck = await _load_owned(session, deck_id, user)
    return await _serialize_full(session, deck)


@router.patch("/decks/{deck_id}")
async def update_deck(
    deck_id: str,
    body: UpdateDeckBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    deck = await _load_owned(session, deck_id, user)
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        deck.name = data["name"].strip()
    if "description" in data:
        deck.description = data["description"]
    if "format" in data and data["format"]:
        deck.format = data["format"]
    if "deck_art_oracle_id" in data:
        deck.deck_art_oracle_id = data["deck_art_oracle_id"]
    if "commander_oracle_id" in data:
        await _apply_commander(session, deck, data["commander_oracle_id"])
    await _refresh_deck_state(session, deck)
    await session.commit()
    return await _serialize_full(session, deck)


@router.delete("/decks/{deck_id}")
async def delete_deck(
    deck_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    deck = await _load_owned(session, deck_id, user)
    await session.delete(deck)
    await session.commit()
    return {"ok": True}


@router.post("/decks/{deck_id}/clone", status_code=status.HTTP_201_CREATED)
async def clone_deck(
    deck_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    src = await session.get(Deck, deck_id)
    if src is None:
        raise HTTPException(status_code=404, detail="deck not found")
    # own deck OR a shared deck (clone-from-shared is the friend-sharing loop)
    if src.user_id != user.id and src.visibility != "shared":
        raise HTTPException(status_code=403, detail="deck not available to clone")

    clone = Deck(
        user_id=user.id,
        name=f"{src.name} (copy)",
        format=src.format,
        commander_oracle_id=src.commander_oracle_id,
        color_identity=list(src.color_identity or []),
        description=src.description,
        deck_art_oracle_id=src.deck_art_oracle_id,
        visibility="private",
    )
    session.add(clone)
    await session.flush()

    cat_map: dict[str, str] = {}
    src_cats = (await session.execute(select(DeckCategory).where(DeckCategory.deck_id == src.id))).scalars().all()
    for c in src_cats:
        nc = DeckCategory(
            deck_id=clone.id, name=c.name, position=c.position,
            target_min=c.target_min, target_max=c.target_max, color_tag=c.color_tag, source=c.source,
        )
        session.add(nc)
        await session.flush()
        cat_map[c.id] = nc.id

    for dc in await _deck_cards(session, src.id):
        session.add(
            DeckCard(
                deck_id=clone.id, oracle_id=dc.oracle_id, board=dc.board, quantity=dc.quantity,
                printing_id=dc.printing_id, finish=dc.finish,
                category_id=cat_map.get(dc.category_id) if dc.category_id else None,
            )
        )
    for t in (await session.execute(
        select(DeckTag).where(DeckTag.deck_id == src.id, DeckTag.source == "user")
    )).scalars():
        session.add(DeckTag(deck_id=clone.id, tag=t.tag, source="user"))

    await _refresh_deck_state(session, clone)
    await session.commit()
    return await _serialize_full(session, clone)


# ------------------------------ cards -------------------------------------- #
@router.post("/decks/{deck_id}/cards")
async def add_card(
    deck_id: str,
    body: AddCardBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    deck = await _load_owned(session, deck_id, user)
    if body.board not in BOARDS:
        raise HTTPException(status_code=400, detail="invalid board")
    card = await session.get(Card, body.oracle_id)
    if card is None:
        raise HTTPException(status_code=400, detail="unknown card")
    # singleton formats cap non-exempt cards at quantity 1 (basics etc. exempt)
    singleton_capped = get_format(deck.format)["singleton"] and not allows_any_number(card)
    quantity = 1 if singleton_capped else body.quantity
    # merge: same oracle+board+printing -> sum quantities
    existing = (
        await session.execute(
            select(DeckCard).where(
                DeckCard.deck_id == deck.id,
                DeckCard.oracle_id == body.oracle_id,
                DeckCard.board == body.board,
                DeckCard.printing_id.is_(body.printing_id) if body.printing_id is None else DeckCard.printing_id == body.printing_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        existing.quantity = 1 if singleton_capped else existing.quantity + quantity
        if body.category_id is not None:
            existing.category_id = body.category_id
    else:
        session.add(
            DeckCard(
                deck_id=deck.id, oracle_id=body.oracle_id, board=body.board,
                quantity=quantity, printing_id=body.printing_id,
                finish=body.finish, category_id=body.category_id,
            )
        )
    await _refresh_deck_state(session, deck)
    await session.commit()
    return await _serialize_full(session, deck)


@router.patch("/decks/{deck_id}/cards/{card_row_id}")
async def update_card(
    deck_id: str,
    card_row_id: str,
    body: UpdateCardBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    deck = await _load_owned(session, deck_id, user)
    dc = await session.get(DeckCard, card_row_id)
    if dc is None or dc.deck_id != deck.id:
        raise HTTPException(status_code=404, detail="card not in deck")
    data = body.model_dump(exclude_unset=True)
    if "board" in data and data["board"]:
        if data["board"] not in BOARDS:
            raise HTTPException(status_code=400, detail="invalid board")
        dc.board = data["board"]
    if "quantity" in data and data["quantity"]:
        qty = data["quantity"]
        card = await session.get(Card, dc.oracle_id)
        if (
            qty > 1
            and card is not None
            and get_format(deck.format)["singleton"]
            and not allows_any_number(card)
        ):
            qty = 1  # singleton cap (non-exempt cards)
        dc.quantity = qty
    if "printing_id" in data:
        dc.printing_id = data["printing_id"]
    if "finish" in data:
        dc.finish = data["finish"]
    if "category_id" in data:
        dc.category_id = data["category_id"]
    await _refresh_deck_state(session, deck)
    await session.commit()
    return await _serialize_full(session, deck)


@router.delete("/decks/{deck_id}/cards/{card_row_id}")
async def remove_card(
    deck_id: str,
    card_row_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    deck = await _load_owned(session, deck_id, user)
    dc = await session.get(DeckCard, card_row_id)
    if dc is None or dc.deck_id != deck.id:
        raise HTTPException(status_code=404, detail="card not in deck")
    await session.delete(dc)
    await _refresh_deck_state(session, deck)
    await session.commit()
    return await _serialize_full(session, deck)


# ---------------------------- categories ----------------------------------- #
@router.post("/decks/{deck_id}/categories")
async def add_category(
    deck_id: str,
    body: CategoryBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    deck = await _load_owned(session, deck_id, user)
    pos = body.position
    if pos is None:
        pos = (await session.scalar(
            select(func.coalesce(func.max(DeckCategory.position), -1)).where(DeckCategory.deck_id == deck.id)
        )) + 1
    session.add(
        DeckCategory(
            deck_id=deck.id, name=body.name, position=pos,
            target_min=body.target_min, target_max=body.target_max,
            color_tag=body.color_tag, source="user",
        )
    )
    deck.updated_at = _now()
    await session.commit()
    return await _serialize_full(session, deck)


@router.patch("/decks/{deck_id}/categories/{category_id}")
async def update_category(
    deck_id: str,
    category_id: str,
    body: CategoryBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    deck = await _load_owned(session, deck_id, user)
    cat = await session.get(DeckCategory, category_id)
    if cat is None or cat.deck_id != deck.id:
        raise HTTPException(status_code=404, detail="category not found")
    cat.name = body.name
    cat.target_min = body.target_min
    cat.target_max = body.target_max
    cat.color_tag = body.color_tag
    if body.position is not None:
        cat.position = body.position
    deck.updated_at = _now()
    await session.commit()
    return await _serialize_full(session, deck)


@router.delete("/decks/{deck_id}/categories/{category_id}")
async def delete_category(
    deck_id: str,
    category_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    deck = await _load_owned(session, deck_id, user)
    cat = await session.get(DeckCategory, category_id)
    if cat is None or cat.deck_id != deck.id:
        raise HTTPException(status_code=404, detail="category not found")
    await session.delete(cat)  # deck_cards.category_id -> SET NULL via FK
    deck.updated_at = _now()
    await session.commit()
    return await _serialize_full(session, deck)


@router.post("/decks/{deck_id}/categories/reorder")
async def reorder_categories(
    deck_id: str,
    body: CategoryOrderBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Drag-reorder: position = index in `order`; ids not listed keep their
    relative order after the listed ones."""
    deck = await _load_owned(session, deck_id, user)
    cats = (
        await session.execute(
            select(DeckCategory).where(DeckCategory.deck_id == deck.id).order_by(DeckCategory.position)
        )
    ).scalars().all()
    by_id = {c.id: c for c in cats}
    pos = 0
    for cid in body.order:
        cat = by_id.pop(cid, None)
        if cat is not None:
            cat.position = pos
            pos += 1
    for cat in by_id.values():  # anything the client didn't mention
        cat.position = pos
        pos += 1
    deck.updated_at = _now()
    await session.commit()
    return await _serialize_full(session, deck)


# ------------------------------ tags --------------------------------------- #
@router.post("/decks/{deck_id}/tags")
async def add_tag(
    deck_id: str,
    body: TagBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    deck = await _load_owned(session, deck_id, user)
    tag = body.tag.strip()[:48]
    if not tag:
        raise HTTPException(status_code=400, detail="empty tag")
    if not await session.get(DeckTag, (deck.id, tag)):
        session.add(DeckTag(deck_id=deck.id, tag=tag, source="user"))
        await session.commit()
    return await _serialize_full(session, deck)


@router.delete("/decks/{deck_id}/tags/{tag}")
async def remove_tag(
    deck_id: str,
    tag: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    deck = await _load_owned(session, deck_id, user)
    await session.execute(
        delete(DeckTag).where(DeckTag.deck_id == deck.id, DeckTag.tag == tag, DeckTag.source == "user")
    )
    await session.commit()
    return await _serialize_full(session, deck)


# --------------------------- visibility / share ---------------------------- #
@router.post("/decks/{deck_id}/visibility")
async def set_visibility(
    deck_id: str,
    body: VisibilityBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    deck = await _load_owned(session, deck_id, user)
    if body.visibility == "shared":
        deck.visibility = "shared"
        if not deck.share_token:
            deck.share_token = secrets.token_urlsafe(16)
    else:
        deck.visibility = "private"
        deck.share_token = None
    deck.updated_at = _now()
    await session.commit()
    return {"visibility": deck.visibility, "share_token": deck.share_token}


@router.get("/shared/{token}")
async def shared_deck(token: str, session: AsyncSession = Depends(get_session)) -> dict:
    deck = (await session.execute(select(Deck).where(Deck.share_token == token))).scalar_one_or_none()
    if deck is None or deck.visibility != "shared":
        raise HTTPException(status_code=404, detail="shared deck not found")
    data = await _serialize_full(session, deck)
    # read-only public view: strip nothing sensitive (private decks never reach here)
    return data
