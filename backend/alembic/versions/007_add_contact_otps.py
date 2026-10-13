"""Add contact_otps table.

Revision ID: 007
Revises: 006
Create Date: 2026-10-14 01:50:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "007"
down_revision: str | None = "006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if not insp.has_table("contact_otps"):
        op.create_table(
            "contact_otps",
            sa.Column("id", sa.String(length=64), nullable=False),
            sa.Column("contact_id", sa.String(length=64), nullable=False),
            sa.Column("otp_hash", sa.String(length=255), nullable=False),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["contact_id"], ["contacts.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("contact_id", name="uq_contact_otps_contact_id"),
        )
        op.create_index("ix_contact_otps_contact_id", "contact_otps", ["contact_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table("contact_otps"):
        op.drop_table("contact_otps")
