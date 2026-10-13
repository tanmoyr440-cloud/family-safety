"""Initial database schema.

Revision ID: 001
Revises: None
Create Date: 2026-10-11 18:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Owners
    op.create_table(
        "owners",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("timezone", sa.String(length=64), server_default="Asia/Kolkata", nullable=False),
        sa.Column("monitoring_paused_until", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Contacts
    op.create_table(
        "contacts",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("relation", sa.String(length=64), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("priority", sa.Integer(), server_default="1", nullable=False),
        sa.Column("locale", sa.String(length=16), server_default="en", nullable=False),
        sa.Column("consent_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["owners.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Inactivity monitors
    op.create_table(
        "inactivity_monitors",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("threshold_days", sa.Integer(), server_default="90", nullable=False),
        sa.Column("warning_days", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="OK", nullable=False),
        sa.Column("episode_id", sa.String(length=64), nullable=False),
        sa.Column("paused_until", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["owners.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("owner_id"),
    )

    # Loans
    op.create_table(
        "loans",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("lender", sa.String(length=255), nullable=False),
        sa.Column("account_masked", sa.String(length=64), nullable=False),
        sa.Column("emi_paise", sa.Integer(), nullable=False),
        sa.Column("due_day", sa.Integer(), nullable=False),
        sa.Column("grace_days", sa.Integer(), server_default="1", nullable=False),
        sa.Column(
            "first_installment_month",
            sa.String(length=7),
            server_default="2026-01",
            nullable=False,
        ),
        sa.Column(
            "last_installment_month",
            sa.String(length=7),
            server_default="2026-12",
            nullable=False,
        ),
        sa.Column(
            "reminder_days_before",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("parent_repeat_every_days", sa.Integer(), server_default="7", nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["owners.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Installments
    op.create_table(
        "installments",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("loan_id", sa.String(length=64), nullable=False),
        sa.Column("year_month", sa.String(length=7), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="UPCOMING", nullable=False),
        sa.Column("paid_at", sa.Date(), nullable=True),
        sa.Column("parent_notified", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("resolved_notified", sa.Boolean(), server_default="false", nullable=False),
        sa.ForeignKeyConstraint(["loan_id"], ["loans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("loan_id", "year_month", name="uq_installment_loan_month"),
    )

    # Outbox messages
    op.create_table(
        "outbox_messages",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("dedupe_key", sa.String(length=255), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("recipient", sa.String(length=255), nullable=False),
        sa.Column("template_id", sa.String(length=128), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="PENDING", nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dedupe_key", name="uq_outbox_dedupe_key"),
    )
    op.create_index(
        "idx_outbox_pending_due",
        "outbox_messages",
        ["status", "next_attempt_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_outbox_pending_due", table_name="outbox_messages")
    op.drop_table("outbox_messages")
    op.drop_table("installments")
    op.drop_table("loans")
    op.drop_table("inactivity_monitors")
    op.drop_table("contacts")
    op.drop_table("owners")
