"""Delivery notifications log and dispatch router conforming to api-contract.md."""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select

from app.application.ports.notification_channel import EmailAttachment, OutboundMessage
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.entities.owner import Owner
from app.domain.policies.escalation_policy import ChannelKind
from app.infrastructure.persistence.models import (
    DocumentModel,
    NomineeGuidanceModel,
    OutboxModel,
)
from app.infrastructure.security.audit_logger import record_audit_event
from app.infrastructure.storage.encrypted_document_store import EncryptedDocumentStore
from app.interfaces.api.dependencies import (
    get_current_owner,
    get_session_factory,
    get_uow,
)
from app.interfaces.api.errors import NotFoundException, ValidationException
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

    # 4. Format all asset details for templating
    holdings_data = [
        {
            "scheme_name": h.scheme_name,
            "fund_house": h.fund_house,
            "units": h.units,
            "folio_masked": h.folio_masked,
            "value_inr": f"{h.value_paise / 100:,.2f}" if h.value_paise else None,
        }
        for h in mf_holdings
    ]
    total_mf_paise = sum(h.value_paise or 0 for h in mf_holdings)
    total_mf_val_str = f"{total_mf_paise / 100:,.2f}" if total_mf_paise > 0 else None

    loans_data = [
        {
            "lender": loan.lender,
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

    payload = {
        "owner_name": current_owner.name,
        "recipient_name": target_contact.name,
        "packet_url": "http://localhost:5173/public/packet",
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

    result = await email_channel.send(outbound)

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
        sent_at=result.delivered_at,
    )
