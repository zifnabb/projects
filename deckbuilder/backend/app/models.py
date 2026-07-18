"""SQLAlchemy models.

Phase 1: the Scryfall-backed card data — `cards` (oracle-unique, the gameplay
table) and `printings` (per-printing, off oracle_id, from the slimmed Default
Cards sync). Later phases add users / decks / etc. via new Alembic migrations.
"""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


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
    released_at: Mapped[date | None] = mapped_column(Date)
    artist: Mapped[str | None] = mapped_column(Text)
    lang: Mapped[str] = mapped_column(String(8), nullable=False, default="en")
    prices: Mapped[dict | None] = mapped_column(JSONB)  # reserved until pricing ships
