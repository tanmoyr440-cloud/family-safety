import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator


class AwareDateTime(TypeDecorator[datetime]):
    """DateTime type that ensures all loaded values are timezone-aware UTC."""

    impl = DateTime
    cache_ok = True

    def __init__(self, timezone: bool = True, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.impl = DateTime(timezone=timezone)

    def process_result_value(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value


class Base(DeclarativeBase):
    """Base declarative class."""


class OwnerModel(Base):
    """Owner persistence model."""

    __tablename__ = "owners"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata", nullable=False)
    monitoring_paused_until: Mapped[datetime | None] = mapped_column(
        AwareDateTime(timezone=True), nullable=True
    )
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mfa_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    contacts: Mapped[list["ContactModel"]] = relationship(
        "ContactModel", back_populates="owner", cascade="all, delete-orphan"
    )
    monitor: Mapped["InactivityMonitorModel | None"] = relationship(
        "InactivityMonitorModel",
        back_populates="owner",
        uselist=False,
        cascade="all, delete-orphan",
    )
    loans: Mapped[list["LoanModel"]] = relationship(
        "LoanModel", back_populates="owner", cascade="all, delete-orphan"
    )
    mutual_fund_holdings: Mapped[list["MutualFundHoldingModel"]] = relationship(
        "MutualFundHoldingModel", back_populates="owner", cascade="all, delete-orphan"
    )
    bank_accounts: Mapped[list["BankAccountModel"]] = relationship(
        "BankAccountModel", back_populates="owner", cascade="all, delete-orphan"
    )
    nominee_guidance: Mapped["NomineeGuidanceModel | None"] = relationship(
        "NomineeGuidanceModel",
        back_populates="owner",
        uselist=False,
        cascade="all, delete-orphan",
    )


class ContactModel(Base):
    """Trusted contact persistence model."""

    __tablename__ = "contacts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("owners.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    relation: Mapped[str] = mapped_column(String(64), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    locale: Mapped[str] = mapped_column(String(16), nullable=False, default="en")
    consent_verified_at: Mapped[datetime | None] = mapped_column(
        AwareDateTime(timezone=True), nullable=True
    )

    owner: Mapped[OwnerModel] = relationship("OwnerModel", back_populates="contacts")


class ContactOtpModel(Base):
    """Stores one-time verification codes for trusted contact consent."""

    __tablename__ = "contact_otps"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    contact_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    otp_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)

    contact: Mapped[ContactModel] = relationship("ContactModel")


class InactivityMonitorModel(Base):
    """Inactivity monitor aggregate persistence model."""

    __tablename__ = "inactivity_monitors"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("owners.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    started_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)
    last_activity_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)
    threshold_days: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    warning_days: Mapped[list[int]] = mapped_column(JSONB, default=[60, 80], nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="OK", nullable=False)
    episode_id: Mapped[str] = mapped_column(String(64), nullable=False)
    paused_until: Mapped[datetime | None] = mapped_column(AwareDateTime(timezone=True), nullable=True)

    owner: Mapped[OwnerModel] = relationship("OwnerModel", back_populates="monitor")


class LoanModel(Base):
    """Loan persistence model."""

    __tablename__ = "loans"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("owners.id", ondelete="CASCADE"), nullable=False
    )
    lender: Mapped[str] = mapped_column(String(255), nullable=False)
    account_masked: Mapped[str] = mapped_column(String(64), nullable=False)
    emi_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    due_day: Mapped[int] = mapped_column(Integer, nullable=False)
    grace_days: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    first_installment_month: Mapped[str] = mapped_column(
        String(7), default="2026-01", nullable=False
    )
    last_installment_month: Mapped[str] = mapped_column(
        String(7), default="2026-12", nullable=False
    )
    reminder_days_before: Mapped[list[int]] = mapped_column(
        JSONB, default=[3, 1, 0], nullable=False
    )
    parent_repeat_every_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)

    owner: Mapped[OwnerModel] = relationship("OwnerModel", back_populates="loans")
    installments: Mapped[list["InstallmentModel"]] = relationship(
        "InstallmentModel", back_populates="loan", cascade="all, delete-orphan"
    )


class InstallmentModel(Base):
    """Installment persistence model."""

    __tablename__ = "installments"
    __table_args__ = (UniqueConstraint("loan_id", "year_month", name="uq_installment_loan_month"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    loan_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("loans.id", ondelete="CASCADE"), nullable=False
    )
    year_month: Mapped[str] = mapped_column(String(7), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="UPCOMING", nullable=False)
    paid_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    parent_notified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_notified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    loan: Mapped[LoanModel] = relationship("LoanModel", back_populates="installments")


class OutboxModel(Base):
    """Transactional Outbox persistence model."""

    __tablename__ = "outbox_messages"
    __table_args__ = (
        UniqueConstraint("dedupe_key", name="uq_outbox_dedupe_key"),
        Index("idx_outbox_pending_due", "status", "next_attempt_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    dedupe_key: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    template_id: Mapped[str] = mapped_column(String(128), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    next_attempt_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(AwareDateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        AwareDateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class RefreshTokenModel(Base):
    """Hashed refresh token persistence model."""

    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("owners.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(AwareDateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)


class AuditEventModel(Base):
    """Append-only audit event persistence model."""

    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False, index=True)
    actor_type: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    subject_type: Mapped[str] = mapped_column(String(64), nullable=False)
    subject_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


class SchedulerHeartbeatModel(Base):
    """Scheduler worker heartbeat persistence model."""

    __tablename__ = "scheduler_heartbeats"

    job_name: Mapped[str] = mapped_column(String(64), primary_key=True)
    last_run_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)
    last_success_at: Mapped[datetime | None] = mapped_column(AwareDateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)


class DocumentModel(Base):
    """Encrypted uploaded document metadata model."""

    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("owners.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="general", nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(
        String(128), default="application/pdf", nullable=False
    )
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)


class PacketShareModel(Base):
    """Emergency packet share link and access state model."""

    __tablename__ = "packet_shares"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("owners.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contact_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    otp_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    otp_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    otp_locked_until: Mapped[datetime | None] = mapped_column(
        AwareDateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(AwareDateTime(timezone=True), nullable=True)
    first_accessed_at: Mapped[datetime | None] = mapped_column(
        AwareDateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)


class MutualFundHoldingModel(Base):
    """Owner's mutual fund investment holding persistence model."""

    __tablename__ = "mutual_fund_holdings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("owners.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scheme_code: Mapped[int] = mapped_column(Integer, nullable=False)
    scheme_name: Mapped[str] = mapped_column(String(255), nullable=False)
    fund_house: Mapped[str] = mapped_column(String(255), nullable=False)
    units: Mapped[float] = mapped_column(Float, nullable=False)
    folio_masked: Mapped[str | None] = mapped_column(String(64), nullable=True)
    asset_type: Mapped[str] = mapped_column(String(32), default="MUTUAL_FUND", nullable=False)
    isin: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)

    owner: Mapped[OwnerModel] = relationship("OwnerModel", back_populates="mutual_fund_holdings")


class BankAccountModel(Base):
    """Owner's registered bank account persistence model."""

    __tablename__ = "bank_accounts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("owners.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bank_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_number_masked: Mapped[str] = mapped_column(String(64), nullable=False)
    ifsc_code: Mapped[str] = mapped_column(String(16), nullable=False)
    branch_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account_type: Mapped[str] = mapped_column(String(32), default="SAVINGS", nullable=False)
    holder_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)

    owner: Mapped[OwnerModel] = relationship("OwnerModel", back_populates="bank_accounts")


class NomineeGuidanceModel(Base):
    """Owner's nominee and emergency guidance persistence model."""

    __tablename__ = "nominee_guidance"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("owners.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    nominees_json: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True, default=list)
    nominee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nominee_relation: Mapped[str | None] = mapped_column(String(64), nullable=True)
    nominee_share: Mapped[str | None] = mapped_column(String(32), default="100%", nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(AwareDateTime(timezone=True), nullable=False)

    owner: Mapped[OwnerModel] = relationship("OwnerModel", back_populates="nominee_guidance")
