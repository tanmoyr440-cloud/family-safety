import hashlib
import hmac
import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy import select

from app.application.ports.clock import Clock
from app.application.ports.notification_channel import OutboundMessage
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.manage_contacts import ManageContacts
from app.config import settings
from app.domain.entities.contact import TrustedContact
from app.domain.entities.owner import Owner
from app.domain.policies.escalation_policy import ChannelKind
from app.domain.value_objects.email_address import EmailAddress
from app.domain.value_objects.phone_number import PhoneNumber
from app.infrastructure.persistence.models import ContactOtpModel
from app.infrastructure.security.audit_logger import record_audit_event
from app.interfaces.api.dependencies import (
    get_current_owner,
    get_session_factory,
    get_uow,
    rate_limit_otp,
)
from app.interfaces.api.errors import (
    NotFoundException,
    UnauthorizedException,
)
from app.interfaces.api.schemas import (
    ActionResponse,
    ContactResponse,
    CreateContactRequest,
    PublicOptOutRequest,
    PublicVerifyContactRequest,
    UpdateContactRequest,
)
from app.interfaces.worker.service import create_default_channels


class SystemClock(Clock):
    """System clock provider."""

    def now(self) -> datetime:
        return datetime.now(UTC)


clock = SystemClock()
router = APIRouter(tags=["contacts"])
logger = logging.getLogger(__name__)


def _map_contact(c: TrustedContact) -> ContactResponse:
    """Map domain TrustedContact to ContactResponse DTO."""
    status_str = "VERIFIED" if c.consent_verified_at else "PENDING"
    return ContactResponse(
        id=c.id,
        name=c.name,
        relation=c.relation,
        phone=c.phone.value,
        email=c.email.value,
        priority=c.priority,
        consent=status_str,
        consent_verified_at=c.consent_verified_at,
    )


async def _dispatch_contact_otp_notification(
    contact: TrustedContact,
    owner_name: str,
    otp_code: str,
) -> None:
    """Send real OTP via configured SMS and Email notification channels."""
    try:
        channels = create_default_channels()
        verify_url = f"{settings.portal_base_url.rstrip('/')}/verify-contact/{contact.id}"

        for ch in channels:
            try:
                if ch.kind == ChannelKind.SMS and contact.phone:
                    await ch.send(
                        OutboundMessage(
                            id=str(uuid.uuid4()),
                            channel=ChannelKind.SMS,
                            recipient=contact.phone.value,
                            template_id="contact_verification_otp_sms.txt",
                            payload={
                                "otp": otp_code,
                                "owner_name": owner_name,
                                "contact_name": contact.name,
                            },
                        )
                    )
                elif ch.kind == ChannelKind.EMAIL and contact.email:
                    await ch.send(
                        OutboundMessage(
                            id=str(uuid.uuid4()),
                            channel=ChannelKind.EMAIL,
                            recipient=contact.email.value,
                            template_id="contact_verification_otp_email.txt",
                            payload={
                                "otp": otp_code,
                                "owner_name": owner_name,
                                "contact_name": contact.name,
                                "verify_url": verify_url,
                            },
                        )
                    )
            except Exception as channel_err:
                logger.warning("Failed to dispatch OTP via channel %s: %s", getattr(ch, "kind", ch), channel_err)
    except Exception as exc:
        logger.warning("Error dispatching contact OTP notification: %s", exc)


@router.get(
    "/contacts",
    response_model=list[ContactResponse],
    operation_id="listContacts",
    summary="List all trusted contacts",
)
async def list_contacts(
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> list[ContactResponse]:
    """Retrieve all trusted contacts registered for current owner."""
    async with uow:
        contacts = await uow.contacts.get_contacts_for_owner(current_owner.id)
    return [_map_contact(c) for c in contacts]


@router.post(
    "/contacts",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="createContact",
    summary="Add a new trusted contact",
)
async def create_contact(
    body: CreateContactRequest,
    _idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> ContactResponse:
    """Register a new trusted contact with consent pending and generate verification OTP."""
    use_case = ManageContacts(uow=uow, clock=clock)
    contact = await use_case.add_contact(
        owner_id=current_owner.id,
        name=body.name,
        relation=body.relation,
        phone=body.phone,
        email=body.email,
        priority=body.priority,
        locale=body.locale,
    )

    # Generate real OTP and store in database
    otp_code = f"{secrets.randbelow(1_000_000):06d}"
    otp_hash = hashlib.sha256(otp_code.encode("utf-8")).hexdigest()
    now = clock.now()
    expires_at = now + timedelta(minutes=15)

    session_factory = get_session_factory()
    async with session_factory() as session:
        otp_row = ContactOtpModel(
            id=str(uuid.uuid4()),
            contact_id=contact.id,
            otp_hash=otp_hash,
            attempts=0,
            expires_at=expires_at,
            created_at=now,
        )
        session.add(otp_row)
        await session.commit()

    # Dispatch via SMS and Email channels
    await _dispatch_contact_otp_notification(contact, current_owner.name, otp_code)
    logger.info(
        "Real contact verification OTP generated for '%s' (%s): %s",
        contact.name,
        contact.phone.value,
        otp_code,
    )
    return _map_contact(contact)


@router.patch(
    "/contacts/{id}",
    response_model=ContactResponse,
    operation_id="updateContact",
    summary="Update contact details",
)
async def update_contact(
    id: str,
    body: UpdateContactRequest,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> ContactResponse:
    """Update contact attributes."""
    async with uow:
        contact = await uow.contacts.get_by_id(id)
        if not contact or contact.owner_id != current_owner.id:
            raise NotFoundException("Contact not found.")

        if body.name is not None:
            contact.name = body.name
        if body.relation is not None:
            contact.relation = body.relation
        if body.phone is not None:
            contact.phone = PhoneNumber(body.phone)
            contact.consent_verified_at = None  # Re-require consent on phone change
        if body.email is not None:
            contact.email = EmailAddress(body.email)
        if body.priority is not None:
            contact.priority = body.priority
        if body.locale is not None:
            contact.locale = body.locale

        await uow.contacts.save(contact)
        await uow.commit()

    return _map_contact(contact)


@router.delete(
    "/contacts/{id}",
    response_model=ActionResponse,
    operation_id="deleteContact",
    summary="Delete trusted contact",
)
async def delete_contact(
    id: str,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> ActionResponse:
    """Remove a trusted contact."""
    async with uow:
        contact = await uow.contacts.get_by_id(id)
        if not contact or contact.owner_id != current_owner.id:
            raise NotFoundException("Contact not found.")

    use_case = ManageContacts(uow=uow, clock=clock)
    await use_case.delete_contact(id)
    return ActionResponse(message="Contact removed successfully.")


@router.post(
    "/contacts/{id}/verify/send",
    response_model=ActionResponse,
    operation_id="sendContactVerificationOtp",
    summary="Send or resend consent verification OTP",
    dependencies=[Depends(rate_limit_otp)],
)
async def send_contact_verification_otp(
    id: str,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> ActionResponse:
    """Send an invitation and verification OTP to contact's phone and email."""
    async with uow:
        contact = await uow.contacts.get_by_id(id)
        if not contact or contact.owner_id != current_owner.id:
            raise NotFoundException("Contact not found.")

    otp_code = f"{secrets.randbelow(1_000_000):06d}"
    otp_hash = hashlib.sha256(otp_code.encode("utf-8")).hexdigest()
    now = clock.now()
    expires_at = now + timedelta(minutes=15)

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(ContactOtpModel).where(ContactOtpModel.contact_id == contact.id)
        otp_row = (await session.execute(stmt)).scalar_one_or_none()
        if otp_row:
            otp_row.otp_hash = otp_hash
            otp_row.attempts = 0
            otp_row.expires_at = expires_at
            otp_row.created_at = now
        else:
            otp_row = ContactOtpModel(
                id=str(uuid.uuid4()),
                contact_id=contact.id,
                otp_hash=otp_hash,
                attempts=0,
                expires_at=expires_at,
                created_at=now,
            )
            session.add(otp_row)

        await record_audit_event(
            session=session,
            actor_type="OWNER",
            actor_id=current_owner.id,
            action="CONTACT_CONSENT_REQUESTED",
            subject_type="CONTACT",
            subject_id=contact.id,
            metadata={"phone": contact.phone.value},
        )
        await session.commit()

    await _dispatch_contact_otp_notification(contact, current_owner.name, otp_code)

    logger.info(
        "Real contact consent verification OTP generated for '%s' (%s): %s",
        contact.name,
        contact.phone.value,
        otp_code,
    )

    if settings.environment != "production":
        msg = f"Consent verification OTP sent to {contact.phone.value}. (Dev OTP: {otp_code} | Token: {contact.id})"
    else:
        msg = f"Consent verification OTP has been sent to {contact.phone.value}."

    return ActionResponse(message=msg)


@router.post(
    "/public/contacts/verify",
    response_model=ActionResponse,
    operation_id="verifyContactPublic",
    summary="Verify contact consent via OTP (Public)",
    dependencies=[Depends(rate_limit_otp)],
)
async def public_verify_contact(
    body: PublicVerifyContactRequest,
    uow: UnitOfWork = Depends(get_uow),
) -> ActionResponse:
    """Public endpoint for contacts to confirm consent using real OTP token."""
    contact_id = body.token
    submitted_otp = body.otp.strip()

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(ContactOtpModel).where(ContactOtpModel.contact_id == contact_id)
        otp_row = (await session.execute(stmt)).scalar_one_or_none()
        if not otp_row:
            raise UnauthorizedException("No pending verification found or OTP expired. Please request a new code.")

        now = clock.now()
        if otp_row.expires_at < now:
            await session.delete(otp_row)
            await session.commit()
            raise UnauthorizedException("Verification code has expired. Please request a new OTP.")

        if otp_row.attempts >= 5:
            await session.delete(otp_row)
            await session.commit()
            raise UnauthorizedException("Too many invalid attempts. Please request a new OTP.")

        input_hash = hashlib.sha256(submitted_otp.encode("utf-8")).hexdigest()
        if not hmac.compare_digest(input_hash, otp_row.otp_hash):
            otp_row.attempts += 1
            await session.commit()
            raise UnauthorizedException("Invalid verification code. Please check and try again.")

        # OTP is valid! Delete used OTP row
        await session.delete(otp_row)
        await session.commit()

    use_case = ManageContacts(uow=uow, clock=clock)
    try:
        await use_case.verify_consent(contact_id)
    except Exception as err:
        raise NotFoundException("Invalid or expired verification request.") from err

    async with session_factory() as session:
        await record_audit_event(
            session=session,
            actor_type="CONTACT",
            actor_id=contact_id,
            action="CONTACT_CONSENT_VERIFIED",
            subject_type="CONTACT",
            subject_id=contact_id,
        )
        await session.commit()

    logger.info("Contact consent verified successfully for contact ID: %s", contact_id)
    return ActionResponse(message="Consent verified successfully.")


@router.post(
    "/public/contacts/opt-out",
    response_model=ActionResponse,
    operation_id="optOutContactPublic",
    summary="Opt-out from being a contact (Public)",
)
async def public_opt_out_contact(
    body: PublicOptOutRequest,
    uow: UnitOfWork = Depends(get_uow),
) -> ActionResponse:
    """Public endpoint for contacts to opt out from alerts."""
    contact_id = body.token
    async with uow:
        contact = await uow.contacts.get_by_id(contact_id)
        if contact:
            contact.consent_verified_at = None
            await uow.contacts.save(contact)
            await uow.commit()

    if contact:
        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = select(ContactOtpModel).where(ContactOtpModel.contact_id == contact_id)
            otp_row = (await session.execute(stmt)).scalar_one_or_none()
            if otp_row:
                await session.delete(otp_row)

            await record_audit_event(
                session=session,
                actor_type="CONTACT",
                actor_id=contact_id,
                action="CONTACT_OPTED_OUT",
                subject_type="CONTACT",
                subject_id=contact_id,
                metadata={"owner_id": contact.owner_id},
            )
            await session.commit()

    return ActionResponse(message="You have been successfully unsubscribed.")
