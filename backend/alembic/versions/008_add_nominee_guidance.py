"""Add nominee_guidance table.

Revision ID: 008
Revises: 007
Create Date: 2026-10-14 02:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "008"
down_revision: str | None = "007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if not insp.has_table("nominee_guidance"):
        op.create_table(
            "nominee_guidance",
            sa.Column("id", sa.String(length=64), nullable=False),
            sa.Column("owner_id", sa.String(length=64), nullable=False),
            sa.Column("nominee_name", sa.String(length=255), nullable=True),
            sa.Column("nominee_relation", sa.String(length=64), nullable=True),
            sa.Column("nominee_share", sa.String(length=32), nullable=True, server_default="100%"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["owner_id"], ["owners.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("owner_id", name="uq_nominee_guidance_owner_id"),
        )
        op.create_index("ix_nominee_guidance_owner_id", "nominee_guidance", ["owner_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table("nominee_guidance"):
        op.drop_table("nominee_guidance")
