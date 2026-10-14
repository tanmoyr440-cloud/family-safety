"""Add nominees_json column to nominee_guidance table.

Revision ID: 009
Revises: 008
Create Date: 2026-10-15 00:10:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "009"
down_revision: str | None = "008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table("nominee_guidance"):
        columns = [c["name"] for c in insp.get_columns("nominee_guidance")]
        if "nominees_json" not in columns:
            op.add_column(
                "nominee_guidance",
                sa.Column("nominees_json", sa.JSON(), nullable=True),
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table("nominee_guidance"):
        columns = [c["name"] for c in insp.get_columns("nominee_guidance")]
        if "nominees_json" in columns:
            op.drop_column("nominee_guidance", "nominees_json")
