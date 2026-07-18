"""decks, deck_categories, deck_cards, deck_tags

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "decks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("format", sa.String(32), nullable=False, server_default="commander"),
        sa.Column("commander_oracle_id", sa.String(36)),
        sa.Column("color_identity", postgresql.ARRAY(sa.String(1)), nullable=False, server_default="{}"),
        sa.Column("description", sa.Text()),
        sa.Column("deck_art_oracle_id", sa.String(36)),
        sa.Column("visibility", sa.String(16), nullable=False, server_default="private"),
        sa.Column("share_token", sa.String(64), unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("commandersalt_hash", sa.String(128)),
        sa.Column("grade_json", postgresql.JSONB()),
        sa.Column("graded_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_decks_user_id", "decks", ["user_id"])

    op.create_table(
        "deck_categories",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("deck_id", sa.String(36), sa.ForeignKey("decks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("target_min", sa.Integer()),
        sa.Column("target_max", sa.Integer()),
        sa.Column("color_tag", sa.String(16)),
        sa.Column("source", sa.String(16), nullable=False, server_default="user"),
    )
    op.create_index("ix_deck_categories_deck_id", "deck_categories", ["deck_id"])

    op.create_table(
        "deck_cards",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("deck_id", sa.String(36), sa.ForeignKey("decks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("oracle_id", sa.String(36), nullable=False),
        sa.Column("board", sa.String(16), nullable=False, server_default="main"),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("finish", sa.String(16)),
        sa.Column("printing_id", sa.String(36)),
        sa.Column(
            "category_id",
            sa.String(36),
            sa.ForeignKey("deck_categories.id", ondelete="SET NULL"),
        ),
    )
    op.create_index("ix_deck_cards_deck_id", "deck_cards", ["deck_id"])

    op.create_table(
        "deck_tags",
        sa.Column("deck_id", sa.String(36), sa.ForeignKey("decks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag", sa.String(48), primary_key=True),
        sa.Column("source", sa.String(16), nullable=False, server_default="user"),
    )


def downgrade() -> None:
    op.drop_table("deck_tags")
    op.drop_table("deck_cards")
    op.drop_table("deck_categories")
    op.drop_index("ix_decks_user_id", table_name="decks")
    op.drop_table("decks")
