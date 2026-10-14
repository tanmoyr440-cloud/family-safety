"""Add asset_type and isin columns to mutual_fund_holdings table.

Revision ID: 010
Revises: 009
Create Date: 2026-10-15 01:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "010"
down_revision: str | None = "009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table("mutual_fund_holdings"):
        columns = [c["name"] for c in insp.get_columns("mutual_fund_holdings")]
        if "asset_type" not in columns:
            op.add_column(
                "mutual_fund_holdings",
                sa.Column("asset_type", sa.String(32), server_default="MUTUAL_FUND", nullable=False),
            )
        if "isin" not in columns:
            op.add_column(
                "mutual_fund_holdings",
                sa.Column("isin", sa.String(32), nullable=True),
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table("mutual_fund_holdings"):
        columns = [c["name"] for c in insp.get_columns("mutual_fund_holdings")]
        if "isin" in columns:
            op.drop_column("mutual_fund_holdings", "isin")
        if "asset_type" in columns:
            op.drop_column("mutual_fund_holdings", "asset_type")
