"""SQLAlchemy models.

Phase 1: the Scryfall-backed card data — `cards` (oracle-unique, the gameplay
table) and `printings` (per-printing, off oracle_id, from the slimmed Default
Cards sync). Later phases add users / decks / etc. via new Alembic migrations.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Card(Base):
    """One row per gameplay-unique card (Scryfall Oracle Cards)."""

    __tablename__ = "cards"

    oracle_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    mana_cost: Mapped[str | None] = mapped_column(Text)
    cmc: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    type_line: Mapped[str | None] = mapped_column(Text)
    oracle_text: Mapped[str | None] = mapped_column(Text)
    power: Mapped[str | None] = mapped_column(String(8))
    toughness: Mapped[str | None] = mapped_column(String(8))
    loyalty: Mapped[str | None] = mapped_column(String(8))
    colors: Mapped[list[str] | None] = mapped_column(ARRAY(String(1)))
    color_identity: Mapped[list[str]] = mapped_column(ARRAY(String(1)), nullable=False, default=list)
    produced_mana: Mapped[list[str] | None] = mapped_column(ARRAY(String(2)))
    keywords: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    legalities: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    prices: Mapped[dict | None] = mapped_column(JSONB)
    image_uris: Mapped[dict | None] = mapped_column(JSONB)
    card_faces: Mapped[list | None] = mapped_column(JSONB)
    layout: Mapped[str | None] = mapped_column(String(32))
    edhrec_rank: Mapped[int | None] = mapped_column(Integer)
    reserved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    default_printing_id: Mapped[str | None] = mapped_column(String(36))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Printing(Base):
    """One row per card printing (Scryfall Default Cards), slimmed."""

    __tablename__ = "printings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # Scryfall card id
    oracle_id: Mapped[str] = mapped_column(String(36), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    set_code: Mapped[str] = mapped_column(String(16), nullable=False)
    set_name: Mapped[str | None] = mapped_column(Text)
    collector_number: Mapped[str | None] = mapped_column(String(16))
    rarity: Mapped[str | None] = mapped_column(String(16))
    finishes: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    image_uris: Mapped[dict | None] = mapped_column(JSONB)
    card_faces: Mapped[list | None] = mapped_column(JSONB)  # per-printing DFC faces
    released_at: Mapped[date | None] = mapped_column(Date)
    artist: Mapped[str | None] = mapped_column(Text)
    lang: Mapped[str] = mapped_column(String(8), nullable=False, default="en")
    prices: Mapped[dict | None] = mapped_column(JSONB)  # reserved until pricing ships


class ApiCache(Base):
    """Shared outbound-HTTP adapter cache (Scryfall search/rulings, later EDHREC etc.).

    Keyed by (provider, key_hash) where key_hash is a sha256 of the logical
    request key, so arbitrarily long queries stay within btree index limits.
    """

    __tablename__ = "api_cache"

    provider: Mapped[str] = mapped_column(String(32), primary_key=True)
    key_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    key_repr: Mapped[str | None] = mapped_column(Text)  # human-readable, not indexed
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class User(Base):
    """Login identity is `username` (email-free by design, PLAN §15 decision)."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(64))
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    theme_pref: Mapped[str] = mapped_column(String(16), nullable=False, default="dark")
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Invite(Base):
    """`code` IS the magic-link token (random urlsafe). Single-use, optional expiry."""

    __tablename__ = "invites"

    code: Mapped[str] = mapped_column(String(64), primary_key=True)
    created_by: Mapped[str] = mapped_column(String(36), nullable=False)
    used_by: Mapped[str | None] = mapped_column(String(36))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PasswordReset(Base):
    """Admin-minted one-time reset link (email-free reset flow, PLAN §15)."""

    __tablename__ = "password_resets"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Deck(Base):
    __tablename__ = "decks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    format: Mapped[str] = mapped_column(String(32), nullable=False, default="commander")
    commander_oracle_id: Mapped[str | None] = mapped_column(String(36))
    color_identity: Mapped[list[str]] = mapped_column(ARRAY(String(1)), nullable=False, default=list)
    description: Mapped[str | None] = mapped_column(Text)
    deck_art_oracle_id: Mapped[str | None] = mapped_column(String(36))
    visibility: Mapped[str] = mapped_column(String(16), nullable=False, default="private")
    share_token: Mapped[str | None] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Reserved grading hooks (inert until post-MVP, PLAN §6)
    commandersalt_hash: Mapped[str | None] = mapped_column(String(128))
    grade_json: Mapped[dict | None] = mapped_column(JSONB)
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DeckCategory(Base):
    __tablename__ = "deck_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    deck_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    target_min: Mapped[int | None] = mapped_column(Integer)
    target_max: Mapped[int | None] = mapped_column(Integer)
    color_tag: Mapped[str | None] = mapped_column(String(16))
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="user")  # template|user


class DeckCard(Base):
    __tablename__ = "deck_cards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    deck_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    oracle_id: Mapped[str] = mapped_column(String(36), nullable=False)
    board: Mapped[str] = mapped_column(String(16), nullable=False, default="main")  # main|side|maybe|command
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    finish: Mapped[str | None] = mapped_column(String(16))
    printing_id: Mapped[str | None] = mapped_column(String(36))
    category_id: Mapped[str | None] = mapped_column(String(36))


class DeckTag(Base):
    __tablename__ = "deck_tags"

    deck_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tag: Mapped[str] = mapped_column(String(48), primary_key=True)
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="user")  # user|system
