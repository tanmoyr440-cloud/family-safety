"""Delivery notifications log and dispatch router conforming to api-contract.md."""

import hashlib
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select

from app.application.ports.notification_channel import EmailAttachment, OutboundMessage
from app.application.ports.unit_of_work import UnitOfWork
from app.config import settings
from app.domain.entities.owner import Owner
from app.domain.policies.escalation_policy import ChannelKind
from app.infrastructure.persistence.models import (
    DocumentModel,
    NomineeGuidanceModel,
    OutboxModel,
    PacketShareModel,
)
from app.infrastructure.security.audit_logger import record_audit_event
from app.infrastructure.storage.encrypted_document_store import EncryptedDocumentStore
from app.interfaces.api.security import create_packet_share_token
from app.interfaces.api.dependencies import (
    get_current_owner,
    get_session_factory,
    get_uow,
)
from app.interfaces.api.errors import (
    BadRequestException,
    NotFoundException,
    ValidationException,
)
from app.interfaces.api.schemas import (
    NotificationLogItemResponse,
    SendEmergencyAlertRequest,
    SendEmergencyAlertResponse,
)
from app.interfaces.worker.service import create_default_channels

logger = logging.getLogger(__name__)
router = APIRouter(tags=["notifications"])


@router.get(
    "/notifications",
    response_model=list[NotificationLogItemResponse],
    operation_id="listNotifications",
    summary="List delivery notification log",
)
async def list_notifications(
    status: str | None = Query(default=None, description="Filter by delivery status"),
    channel: str | None = Query(default=None, description="Filter by channel: SMS, EMAIL"),
    since: datetime | None = Query(default=None, description="Filter messages since timestamp"),
    _current_owner: Owner = Depends(get_current_owner),
) -> list[NotificationLogItemResponse]:
    """Retrieve message delivery audit trail and status."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(OutboxModel).order_by(OutboxModel.created_at.desc()).limit(100)
        if status:
            stmt = stmt.where(OutboxModel.status == status.upper())
        if channel:
            stmt = stmt.where(OutboxModel.channel == channel.upper())
        if since:
            stmt = stmt.where(OutboxModel.created_at >= since)

        rows = (await session.execute(stmt)).scalars().all()

    return [
        NotificationLogItemResponse(
            id=row.id,
            channel=row.channel,
            recipient_label=row.recipient,
            template=row.template_id,
            status=row.status,
            attempts=row.attempts,
            queued_at=row.created_at,
            sent_at=row.sent_at,
            error_code=row.last_error,
        )
        for row in rows
    ]


@router.post(
    "/notifications/send-emergency-alert",
    response_model=SendEmergencyAlertResponse,
    status_code=status.HTTP_200_OK,
    operation_id="sendEmergencyAlert",
    summary="Send emergency alert email to trusted contact with attachments",
)
async def send_emergency_alert(
    request: Request,
    body: SendEmergencyAlertRequest = SendEmergencyAlertRequest(),
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> SendEmergencyAlertResponse:
    """Dispatches emergency email with portfolio details and decrypted documents."""
    now_utc = datetime.now(UTC)

    # 1. Identify target contact and load financial assets
    async with uow:
        if body.contact_id:
            contact = await uow.contacts.get_by_id(body.contact_id)
            if not contact or contact.owner_id != current_owner.id:
                raise NotFoundException("Specified trusted contact not found.")
            target_contact = contact
        else:
            contacts = await uow.contacts.get_contacts_for_owner(current_owner.id)
            if not contacts:
                raise ValidationException(
                    "No emergency contacts found. Please add a trusted contact first."
                )
            verified = [c for c in contacts if c.consent_verified_at is not None]
            target_contact = verified[0] if verified else contacts[0]

        try:
            from app.application.ports.clock import Clock
            from app.application.use_cases.manage_mutual_funds import ManageMutualFunds
            from app.infrastructure.market_data.stock_quote_adapter import StockQuoteAdapter
            from app.infrastructure.mutual_funds.sebi_amfi_adapter import SebiAmfiMutualFundAdapter

            class _AlertClock(Clock):
                def now(self) -> datetime:
                    return datetime.now(UTC)

            use_case = ManageMutualFunds(
                uow=uow,
                source=SebiAmfiMutualFundAdapter(),
                clock=_AlertClock(),
                stock_source=StockQuoteAdapter(),
            )
            mf_holdings = await use_case.get_holdings_with_valuations(current_owner.id)
        except Exception as exc:
            logger.warning("Could not calculate live valuations for alert, using stored holdings: %s", exc)
            mf_holdings = await uow.mutual_funds.get_holdings_for_owner(current_owner.id)

        loans = await uow.loans.get_loans_for_owner(current_owner.id)
        bank_accounts = await uow.bank_accounts.get_accounts_for_owner(current_owner.id)
        monitor = await uow.monitors.get_for_owner(current_owner.id)

    # 2. Query available encrypted documents and nominee guidance
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = (
            select(DocumentModel)
            .where(DocumentModel.owner_id == current_owner.id)
            .order_by(DocumentModel.created_at.desc())
        )
        docs = (await session.execute(stmt)).scalars().all()

        guidance_stmt = (
            select(NomineeGuidanceModel)
            .where(NomineeGuidanceModel.owner_id == current_owner.id)
        )
        guidance = (await session.execute(guidance_stmt)).scalar_one_or_none()

    # 3. Decrypt documents to attach to email
    doc_store = EncryptedDocumentStore()
    attachments: list[EmailAttachment] = []
    attached_names: list[str] = []
    doc_manifest: list[dict[str, Any]] = []

    for d in docs:
        size_str = (
            f"{d.size_bytes / 1024:.1f} KB"
            if d.size_bytes < 1024 * 1024
            else f"{d.size_bytes / (1024 * 1024):.1f} MB"
        )
        doc_manifest.append(
            {
                "id": d.id,
                "title": d.title,
                "category": d.category,
                "filename": d.filename,
                "size_formatted": size_str,
            }
        )
        try:
            content = doc_store.read_decrypted(d.storage_path, d.sha256_hash)
            attachments.append(
                EmailAttachment(
                    filename=d.filename,
                    content=content,
                    content_type=d.content_type or "application/octet-stream",
                )
            )
            attached_names.append(d.filename)
        except Exception as exc:
            logger.warning("Could not decrypt document %s: %s", d.id, exc)

    # 4. Format all asset details for templating (UNMASKED for emergency contacts)
    holdings_data = [
        {
            "scheme_name": h.scheme_name,
            "fund_house": h.fund_house,
            "units": h.units,
            "folio": getattr(h, "folio", None) or getattr(h, "folio_masked", None) or "Recorded with AMC",
            "folio_masked": h.folio_masked,
            "value_inr": (
                f"{getattr(h, 'value_paise', None) / 100:,.2f}"
                if getattr(h, "value_paise", None) is not None
                else None
            ),
        }
        for h in mf_holdings
    ]
    total_mf_paise = sum(getattr(h, "value_paise", None) or 0 for h in mf_holdings)
    total_mf_val_str = f"{total_mf_paise / 100:,.2f}" if total_mf_paise > 0 else None

    loans_data = [
        {
            "lender": loan.lender,
            "account_number": getattr(loan, "account_number", None) or getattr(loan, "account_masked", None) or "Recorded with Lender",
            "account_masked": loan.account_masked,
            "emi_inr": f"{loan.emi.paise / 100:,.2f}",
            "due_day": loan.due_day.value,
            "grace_days": loan.grace_days,
        }
        for loan in loans
    ]

    bank_accounts_data = [
        {
            "bank_name": b.bank_name,
            "account_number": getattr(b, "account_number", None) or getattr(b, "account_number_masked", None) or "Recorded with Bank",
            "account_number_masked": b.account_number_masked,
            "ifsc_code": b.ifsc_code,
            "branch_name": b.branch_name,
            "account_type": b.account_type,
        }
        for b in bank_accounts
    ]

    days_idle = (
        (now_utc - monitor.last_activity_at).days
        if monitor and monitor.last_activity_at
        else 90
    )
    subject = body.subject or f"Emergency Alert & Verified Financial Dossier: {current_owner.name}"

    # Determine real base URL from request origin/referer or config
    base_url = settings.portal_base_url.rstrip("/")
    if request:
        origin = request.headers.get("origin") or request.headers.get("referer")
        if origin:
            from urllib.parse import urlparse
            parsed = urlparse(origin)
            if parsed.scheme and parsed.netloc and not ("localhost:8000" in parsed.netloc or "127.0.0.1:8000" in parsed.netloc):
                base_url = f"{parsed.scheme}://{parsed.netloc}"

    # Generate genuine signed emergency packet share link for target contact
    share_id = str(uuid.uuid4())
    share_expires_at = now_utc + timedelta(days=7)
    share_token = create_packet_share_token(share_id, share_expires_at)
    share_token_hash = hashlib.sha256(share_token.encode("utf-8")).hexdigest()

    share_model = PacketShareModel(
        id=share_id,
        owner_id=current_owner.id,
        contact_id=target_contact.id,
        token_hash=share_token_hash,
        expires_at=share_expires_at,
        created_at=now_utc,
    )
    async with session_factory() as session:
        session.add(share_model)
        await session.commit()

    packet_url = f"{base_url}/p/{share_token}"

    payload = {
        "owner_name": current_owner.name,
        "recipient_name": target_contact.name,
        "packet_url": packet_url,
        "holdings": holdings_data,
        "total_mf_value_inr": total_mf_val_str,
        "loans": loans_data,
        "bank_accounts": bank_accounts_data,
        "documents": doc_manifest,
        "nominee_notes": (
            guidance.notes
            if (guidance and guidance.notes)
            else (
                "Mutual fund investments are registered across AMCs and RTAs (CAMS & KFintech). "
                "In case of emergency, contact the respective fund houses or CAMS/KFintech with PAN, "
                "death certificate, and nominee claim forms. Folio details in emergency packet."
            )
        ),
        "days_idle": max(0, days_idle),
        "subject": subject,
    }

    # 5. Dispatch via configured email channel
    channels = create_default_channels()
    email_channel = next((c for c in channels if c.kind == ChannelKind.EMAIL), None)
    if not email_channel:
        raise ValidationException("No email channel configured on system.")

    recipient_email = (
        target_contact.email.value
        if hasattr(target_contact.email, "value")
        else str(target_contact.email)
    )

    msg_id = str(uuid.uuid4())
    outbound = OutboundMessage(
        id=msg_id,
        channel=ChannelKind.EMAIL,
        recipient=recipient_email,
        template_id="inactivity_notify_parents_email",
        payload=payload,
        attachments=attachments,
    )

    try:
        result = await email_channel.send(outbound)
    except Exception as exc:
        logger.error(
            "Emergency alert email dispatch to %s failed via %s: %s",
            recipient_email,
            email_channel.__class__.__name__,
            exc,
            exc_info=True,
        )
        async with session_factory() as session:
            outbox_record = OutboxModel(
                id=msg_id,
                dedupe_key=f"manual_alert:{current_owner.id}:{target_contact.id}:{int(now_utc.timestamp())}",
                channel="EMAIL",
                recipient=recipient_email,
                template_id="inactivity_notify_parents_email",
                payload=payload,
                status="FAILED",
                attempts=1,
                last_error=str(exc),
                next_attempt_at=now_utc,
                sent_at=None,
            )
            session.add(outbox_record)
            await record_audit_event(
                session=session,
                actor_type="OWNER",
                actor_id=current_owner.id,
                action="EMERGENCY_ALERT_FAILED",
                subject_type="CONTACT",
                subject_id=target_contact.id,
                metadata={
                    "recipient": recipient_email,
                    "error": str(exc),
                },
            )
            await session.commit()

        err_str = str(exc)
        if "resend" in err_str.lower() and (
            "domain" in err_str.lower()
            or "403" in err_str
            or "testing emails" in err_str.lower()
            or "only send" in err_str.lower()
        ):
            detail = (
                f"Failed to dispatch emergency alert email via Resend ({exc}). "
                "Resend's free testing domain ('onboarding@resend.dev') only allows sending to the email address you signed up with at resend.com. "
                "To send to any contact: (1) Verify your custom domain at https://resend.com/domains, "
                "(2) Change your contact's email in the app to your Resend account email for testing, or "
                "(3) Set DRY_RUN=true in your Render environment variables."
            )
        elif "timed out" in err_str.lower() or "timeout" in err_str.lower():
            detail = (
                f"Failed to dispatch emergency alert email: SMTP connection timed out ({exc}). "
                "Cloud platforms (including Render free/starter tiers) block outbound SMTP ports (25, 465, and 587) to prevent spam. "
                "If you added RESEND_API_KEY, please verify: "
                "(1) Render has completed redeploying the new build (check the 'Deploys' tab in your Render dashboard), and "
                "(2) The key starts with 're_' without quotes or whitespace. "
                "Alternatively, set DRY_RUN=true for testing without real email dispatch."
            )
        else:
            detail = (
                f"Failed to dispatch emergency alert email: {exc}. "
                "Please verify your email credentials or set RESEND_API_KEY in your environment variables for reliable HTTPS-based delivery without SMTP firewall blocks."
            )
        raise BadRequestException(detail)

    # 6. Record outbox entry and audit trail
    async with session_factory() as session:
        outbox_record = OutboxModel(
            id=msg_id,
            dedupe_key=f"manual_alert:{current_owner.id}:{target_contact.id}:{int(now_utc.timestamp())}",
            channel="EMAIL",
            recipient=recipient_email,
            template_id="inactivity_notify_parents_email",
            payload=payload,
            status="SENT",
            attempts=1,
            next_attempt_at=now_utc,
            sent_at=result.delivered_at,
        )
        session.add(outbox_record)
        await record_audit_event(
            session=session,
            actor_type="OWNER",
            actor_id=current_owner.id,
            action="EMERGENCY_ALERT_DISPATCHED",
            subject_type="CONTACT",
            subject_id=target_contact.id,
            metadata={
                "recipient": recipient_email,
                "attachments_count": len(attachments),
                "attached_documents": attached_names,
                "provider_message_id": result.provider_message_id,
            },
        )
        await session.commit()

    return SendEmergencyAlertResponse(
        status="SENT",
        recipient=recipient_email,
        channel="EMAIL",
        subject=subject,
        message_id=result.provider_message_id,
        attached_documents=attached_names,
        total_holdings=len(mf_holdings),
        total_loans=len(loans),
        total_bank_accounts=len(bank_accounts),
        packet_url=packet_url,
        sent_at=result.delivered_at,
    )
