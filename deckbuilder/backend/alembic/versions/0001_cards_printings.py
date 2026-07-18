"""cards + printings (Scryfall card data)

Revision ID: 0001
Revises:
Create Date: 2026-07-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "cards",
        sa.Column("oracle_id", sa.String(36), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("mana_cost", sa.Text()),
        sa.Column("cmc", sa.Float(), nullable=False, server_default="0"),
        sa.Column("type_line", sa.Text()),
        sa.Column("oracle_text", sa.Text()),
        sa.Column("power", sa.String(8)),
        sa.Column("toughness", sa.String(8)),
        sa.Column("loyalty", sa.String(8)),
        sa.Column("colors", postgresql.ARRAY(sa.String(1))),
        sa.Column("color_identity", postgresql.ARRAY(sa.String(1)), nullable=False, server_default="{}"),
        sa.Column("produced_mana", postgresql.ARRAY(sa.String(2))),
        sa.Column("keywords", postgresql.ARRAY(sa.Text())),
        sa.Column("legalities", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("prices", postgresql.JSONB()),
        sa.Column("image_uris", postgresql.JSONB()),
        sa.Column("card_faces", postgresql.JSONB()),
        sa.Column("layout", sa.String(32)),
        sa.Column("edhrec_rank", sa.Integer()),
        sa.Column("reserved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("default_printing_id", sa.String(36)),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_cards_name", "cards", ["name"])
    op.create_index(
        "ix_cards_name_trgm",
        "cards",
        [sa.text("lower(name) gin_trgm_ops")],
        postgresql_using="gin",
    )
    op.create_index("ix_cards_cmc", "cards", ["cmc"])
    op.create_index("ix_cards_color_identity", "cards", ["color_identity"], postgresql_using="gin")

    op.create_table(
        "printings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("oracle_id", sa.String(36), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("set_code", sa.String(16), nullable=False),
        sa.Column("set_name", sa.Text()),
        sa.Column("collector_number", sa.String(16)),
        sa.Column("rarity", sa.String(16)),
        sa.Column("finishes", postgresql.ARRAY(sa.Text())),
        sa.Column("image_uris", postgresql.JSONB()),
        sa.Column("released_at", sa.Date()),
        sa.Column("artist", sa.Text()),
        sa.Column("lang", sa.String(8), nullable=False, server_default="en"),
        sa.Column("prices", postgresql.JSONB()),
    )
    op.create_index("ix_printings_oracle_id", "printings", ["oracle_id"])
    op.create_index("ix_printings_set_code", "printings", ["set_code"])


def downgrade() -> None:
    op.drop_table("printings")
    op.drop_table("cards")
