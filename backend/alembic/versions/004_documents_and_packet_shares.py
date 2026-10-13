"""Add documents and packet shares tables.

Revision ID: 004
Revises: 003
Create Date: 2026-10-11 21:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Documents
    op.create_table(
        "documents",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=64), server_default="general", nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column(
            "content_type",
            sa.String(length=128),
            server_default="application/pdf",
            nullable=False,
        ),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256_hash", sa.String(length=64), nullable=False),
        sa.Column("storage_path", sa.String(length=512), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["owners.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_documents_owner_id", "documents", ["owner_id"])

    # Packet Shares
    op.create_table(
        "packet_shares",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("contact_id", sa.String(length=64), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("otp_hash", sa.String(length=255), nullable=True),
        sa.Column("otp_attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("otp_locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_accessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["owners.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contact_id"], ["contacts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_packet_shares_owner_id", "packet_shares", ["owner_id"])
    op.create_index("ix_packet_shares_contact_id", "packet_shares", ["contact_id"])
    op.create_index("ix_packet_shares_token_hash", "packet_shares", ["token_hash"])


def downgrade() -> None:
    op.drop_index("ix_packet_shares_token_hash", table_name="packet_shares")
    op.drop_index("ix_packet_shares_contact_id", table_name="packet_shares")
    op.drop_index("ix_packet_shares_owner_id", table_name="packet_shares")
    op.drop_table("packet_shares")

    op.drop_index("ix_documents_owner_id", table_name="documents")
    op.drop_table("documents")
