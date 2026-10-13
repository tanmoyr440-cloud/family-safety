"""Add mutual fund holdings table.

Revision ID: 005
Revises: 004
Create Date: 2026-10-13 00:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: str | None = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if not insp.has_table("mutual_fund_holdings"):
        op.create_table(
            "mutual_fund_holdings",
            sa.Column("id", sa.String(length=64), nullable=False),
            sa.Column("owner_id", sa.String(length=64), nullable=False),
            sa.Column("scheme_code", sa.Integer(), nullable=False),
            sa.Column("scheme_name", sa.String(length=255), nullable=False),
            sa.Column("fund_house", sa.String(length=255), nullable=False),
            sa.Column("units", sa.Float(), nullable=False),
            sa.Column("folio_masked", sa.String(length=64), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["owner_id"], ["owners.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_mutual_fund_holdings_owner_id", "mutual_fund_holdings", ["owner_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table("mutual_fund_holdings"):
        op.drop_table("mutual_fund_holdings")

