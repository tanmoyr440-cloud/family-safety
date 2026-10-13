"""API request and response schemas conforming to references/api-contract.md."""

from datetime import date, datetime
from typing import Any, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginatedResponse[T](BaseModel):
    """Generic cursor-paginated response container."""

    items: list[T]
    next_cursor: str | None = None


# --- Auth Schemas ---
class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, examples=["Tanmoy"])
    email: str = Field(..., max_length=255, examples=["tanmoy@example.com"])
    phone: str = Field(..., examples=["+919876543210"])
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(...)
    mfa_code: str | None = Field(default=None, max_length=6)


class OwnerResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    timezone: str = "Asia/Kolkata"
    mfa_enabled: bool = False
    monitoring_paused_until: datetime | None = None


class LoginResponse(BaseModel):
    owner: OwnerResponse
    csrf_token: str
    access_token: str | None = None
    refresh_token: str | None = None
    mfa_required: bool = False


class RefreshResponse(BaseModel):
    message: str = "Session refreshed successfully."
    csrf_token: str = ""
    access_token: str | None = None
    refresh_token: str | None = None


class MfaEnrollResponse(BaseModel):
    secret: str
    otpauth_url: str


class MfaVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class OwnerExportResponse(BaseModel):
    owner: OwnerResponse
    monitor: dict[str, Any] | None = None
    contacts: list[dict[str, Any]] = Field(default_factory=list)
    loans: list[dict[str, Any]] = Field(default_factory=list)
    documents: list[dict[str, Any]] = Field(default_factory=list)
    exported_at: datetime


# --- Monitor & Activity Schemas ---
class MonitorNextStage(BaseModel):
    stage: str
    at: date


class MonitorStatusResponse(BaseModel):
    status: str
    last_activity_at: datetime | None = None
    days_idle: int
    threshold_days: int
    warning_days: list[int]
    next_stage: MonitorNextStage | None = None
    paused_until: date | None = None
    scheduler_healthy: bool = True


class UpdateMonitorConfigRequest(BaseModel):
    threshold_days: int = Field(..., ge=1)
    warning_days: list[int] = Field(...)
    parent_repeat_every_days: int = Field(default=7, ge=1)


class PauseMonitorRequest(BaseModel):
    until: date


class CheckInResponse(BaseModel):
    success: bool = True
    recorded_at: datetime


# --- Contact Schemas ---
class CreateContactRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    relation: str = Field(..., min_length=1, max_length=64)
    phone: str = Field(..., examples=["+919876543210"])
    email: str = Field(..., examples=["parent@example.com"])
    priority: int = Field(default=1, ge=1)
    locale: str = Field(default="en", max_length=16)


class UpdateContactRequest(BaseModel):
    name: str | None = None
    relation: str | None = None
    phone: str | None = None
    email: str | None = None
    priority: int | None = Field(default=None, ge=1)
    locale: str | None = None


class ContactResponse(BaseModel):
    id: str
    name: str
    relation: str
    phone: str
    email: str
    priority: int
    consent: str
    consent_verified_at: datetime | None = None
    last_delivery: str | None = None


class PublicVerifyContactRequest(BaseModel):
    token: str
    otp: str = Field(..., min_length=4, max_length=8)


class PublicOptOutRequest(BaseModel):
    token: str


class ActionResponse(BaseModel):
    success: bool = True
    message: str = "Action completed successfully."


# --- Loans & Accounts Schemas ---
class PaymentInstructionsSchema(BaseModel):
    upi_id: str | None = None
    portal_url: str | None = None
    notes: str | None = None


class NextDueSchema(BaseModel):
    year_month: str
    due_date: date
    status: str


class LoanResponse(BaseModel):
    id: str
    lender: str
    account_masked: str
    emi_paise: int
    due_day: int
    grace_days: int
    payment_instructions: PaymentInstructionsSchema
    next_due: NextDueSchema | None = None


class CreateLoanRequest(BaseModel):
    lender: str = Field(..., min_length=1, max_length=255)
    account_number: str = Field(..., min_length=4, max_length=64)
    emi_paise: int = Field(..., gt=0)
    due_day: int = Field(..., ge=1, le=31)
    grace_days: int = Field(default=1, ge=0, le=10)
    payment_instructions: PaymentInstructionsSchema = Field(
        default_factory=PaymentInstructionsSchema
    )


class UpdateLoanRequest(BaseModel):
    lender: str | None = None
    emi_paise: int | None = Field(default=None, gt=0)
    due_day: int | None = Field(default=None, ge=1, le=31)
    grace_days: int | None = Field(default=None, ge=0, le=10)
    payment_instructions: PaymentInstructionsSchema | None = None


class InstallmentResponse(BaseModel):
    year_month: str
    due_date: date
    amount_paise: int
    status: str
    paid_at: datetime | None = None
    evidence: str | None = None


class MarkInstallmentPaidRequest(BaseModel):
    reference: str | None = None
    note: str | None = None


class GrowwAccountResponse(BaseModel):
    connected: bool
    masked_account: str | None = None
    last_synced_at: datetime | None = None
    holdings_count: int = 0


class UpdateGrowwAccountRequest(BaseModel):
    api_key: str | None = None
    api_secret: str | None = None


class NomineeGuidanceResponse(BaseModel):
    nominee_name: str | None = None
    nominee_relation: str | None = None
    nominee_share: str | None = "100%"
    notes: str | None = None
    updated_at: datetime | None = None


class UpdateNomineeGuidanceRequest(BaseModel):
    nominee_name: str | None = Field(default=None, max_length=255)
    nominee_relation: str | None = Field(default=None, max_length=64)
    nominee_share: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=4000)


# --- Documents & Emergency Packet Schemas ---
class DocumentResponse(BaseModel):
    id: str
    title: str
    category: str
    filename: str
    size_bytes: int
    created_at: datetime


class AddBankAccountRequest(BaseModel):
    bank_name: str = Field(..., min_length=2, max_length=255, examples=["State Bank of India", "HDFC Bank"])
    account_number: str = Field(..., min_length=4, max_length=34, examples=["123456789012"])
    ifsc_code: str = Field(..., min_length=11, max_length=11, examples=["SBIN0001234"])
    branch_name: str | None = Field(default=None, max_length=255)
    account_type: str = Field(default="SAVINGS", max_length=32)
    holder_name: str | None = Field(default=None, max_length=255)


class BankAccountResponse(BaseModel):
    id: str
    bank_name: str
    account_number_masked: str
    ifsc_code: str
    branch_name: str | None = None
    account_type: str = "SAVINGS"
    holder_name: str | None = None
    created_at: datetime | None = None


class PacketPreviewResponse(BaseModel):
    owner_name: str
    days_idle: int
    holdings_summary: dict[str, Any]
    loans: list[LoanResponse]
    bank_accounts: list[BankAccountResponse] = Field(default_factory=list)
    documents: list[DocumentResponse]
    instructions: str
    nominee: NomineeGuidanceResponse | None = None


class CreatePacketShareRequest(BaseModel):
    contact_id: str


class PacketShareResponse(BaseModel):
    id: str
    contact_id: str
    contact_name: str
    token: str
    expires_at: datetime
    created_at: datetime
    revoked: bool = False


class PublicPacketInfoResponse(BaseModel):
    owner_name: str
    recipient_phone_masked: str
    expires_at: datetime


class PublicPacketOtpVerifyRequest(BaseModel):
    otp: str = Field(..., min_length=4, max_length=8)


class PublicPacketOtpVerifyResponse(BaseModel):
    session_token: str
    expires_at: datetime


# --- Notification Schemas ---
class SendEmergencyAlertRequest(BaseModel):
    contact_id: str | None = None
    subject: str | None = None


class SendEmergencyAlertResponse(BaseModel):
    status: str
    recipient: str
    channel: str
    subject: str
    message_id: str
    attached_documents: list[str] = Field(default_factory=list)
    total_holdings: int = 0
    total_loans: int = 0
    total_bank_accounts: int = 0
    sent_at: datetime


class NotificationLogItemResponse(BaseModel):
    id: str
    channel: str
    recipient_label: str
    template: str
    status: str
    attempts: int
    queued_at: datetime
    sent_at: datetime | None = None
    error_code: str | None = None


# --- Mutual Fund Schemas ---
class MutualFundSchemeResponse(BaseModel):
    scheme_code: int
    scheme_name: str


class MutualFundNavResponse(BaseModel):
    scheme_code: int
    scheme_name: str
    fund_house: str
    scheme_type: str | None = None
    scheme_category: str | None = None
    isin_growth: str | None = None
    nav: float
    nav_date: str


class AddMutualFundHoldingRequest(BaseModel):
    scheme_code: int = Field(..., gt=0)
    units: float = Field(..., gt=0)
    folio_number: str | None = None


class MutualFundHoldingResponse(BaseModel):
    id: str
    scheme_code: int
    scheme_name: str
    fund_house: str
    units: float
    folio_masked: str | None = None
    latest_nav: float | None = None
    nav_date: str | None = None
    value_paise: int
    created_at: datetime | None = None


class CasImportResponse(BaseModel):
    imported_count: int
    total_value_paise: int = 0
    message: str = "CAS statement processed successfully."
    holdings: list[MutualFundHoldingResponse]



