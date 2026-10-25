"""Add unmasked account_number and folio columns.

Revision ID: 011
Revises: 010
Create Date: 2026-10-25 22:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "011"
down_revision: str | None = "010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if insp.has_table("loans"):
        columns = [c["name"] for c in insp.get_columns("loans")]
        if "account_number" not in columns:
            op.add_column(
                "loans",
                sa.Column("account_number", sa.String(64), nullable=True),
            )

    if insp.has_table("bank_accounts"):
        columns = [c["name"] for c in insp.get_columns("bank_accounts")]
        if "account_number" not in columns:
            op.add_column(
                "bank_accounts",
                sa.Column("account_number", sa.String(64), nullable=True),
            )

    if insp.has_table("mutual_fund_holdings"):
        columns = [c["name"] for c in insp.get_columns("mutual_fund_holdings")]
        if "folio" not in columns:
            op.add_column(
                "mutual_fund_holdings",
                sa.Column("folio", sa.String(64), nullable=True),
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if insp.has_table("mutual_fund_holdings"):
        columns = [c["name"] for c in insp.get_columns("mutual_fund_holdings")]
        if "folio" in columns:
            op.drop_column("mutual_fund_holdings", "folio")

    if insp.has_table("bank_accounts"):
        columns = [c["name"] for c in insp.get_columns("bank_accounts")]
        if "account_number" in columns:
            op.drop_column("bank_accounts", "account_number")

    if insp.has_table("loans"):
        columns = [c["name"] for c in insp.get_columns("loans")]
        if "account_number" in columns:
            op.drop_column("loans", "account_number")
