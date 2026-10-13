"""Add bank accounts table.

Revision ID: 006
Revises: 005
Create Date: 2026-10-13 18:35:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "006"
down_revision: str | None = "005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if not insp.has_table("bank_accounts"):
        op.create_table(
            "bank_accounts",
            sa.Column("id", sa.String(length=64), nullable=False),
            sa.Column("owner_id", sa.String(length=64), nullable=False),
            sa.Column("bank_name", sa.String(length=255), nullable=False),
            sa.Column("account_number_masked", sa.String(length=64), nullable=False),
            sa.Column("ifsc_code", sa.String(length=16), nullable=False),
            sa.Column("branch_name", sa.String(length=255), nullable=True),
            sa.Column("account_type", sa.String(length=32), nullable=False, server_default="SAVINGS"),
            sa.Column("holder_name", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["owner_id"], ["owners.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_bank_accounts_owner_id", "bank_accounts", ["owner_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table("bank_accounts"):
        op.drop_table("bank_accounts")
