"""Add insurance_policies table.

Revision ID: 012
Revises: 011
Create Date: 2026-11-12 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "012"
down_revision: str | None = "011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if not insp.has_table("insurance_policies"):
        op.create_table(
            "insurance_policies",
            sa.Column("id", sa.String(length=64), nullable=False),
            sa.Column("owner_id", sa.String(length=64), nullable=False),
            sa.Column("policy_name", sa.String(length=255), nullable=False),
            sa.Column("policy_type", sa.String(length=32), nullable=False, server_default="HEALTH"),
            sa.Column("policy_number", sa.String(length=128), nullable=False),
            sa.Column("policy_number_masked", sa.String(length=64), nullable=False),
            sa.Column("insurer_name", sa.String(length=255), nullable=False),
            sa.Column("sum_insured_paise", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("premium_amount_paise", sa.Integer(), nullable=True),
            sa.Column("premium_due_date", sa.Date(), nullable=True),
            sa.Column("cashless_tpa_name", sa.String(length=255), nullable=True),
            sa.Column("tpa_id_number", sa.String(length=128), nullable=True),
            sa.Column("emergency_helpline", sa.String(length=128), nullable=True),
            sa.Column("claim_email", sa.String(length=255), nullable=True),
            sa.Column("nominee_name", sa.String(length=255), nullable=True),
            sa.Column("nominee_relation", sa.String(length=64), nullable=True),
            sa.Column("hospital_cashless_notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["owner_id"], ["owners.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_insurance_policies_owner_id", "insurance_policies", ["owner_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table("insurance_policies"):
        op.drop_table("insurance_policies")
