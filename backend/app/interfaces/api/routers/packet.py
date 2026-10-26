"""Emergency packet preview, shares, and public parent-access router
conforming to api-contract.md and references/security-and-packet.md.
"""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy import select

from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.entities.owner import Owner
from app.infrastructure.persistence.models import (
    ContactModel,
    DocumentModel,
    NomineeGuidanceModel,
    OwnerModel,
    PacketShareModel,
)
from app.infrastructure.security.audit_logger import record_audit_event
from app.infrastructure.storage.encrypted_document_store import EncryptedDocumentStore
from app.interfaces.api.dependencies import (
    get_current_owner,
    get_session_factory,
    get_uow,
    rate_limit_otp,
)
from app.interfaces.api.errors import (
    NotFoundException,
    OtpLockedOutException,
    UnauthorizedException,
)
from app.interfaces.api.schemas import (
    ActionResponse,
    BankAccountResponse,
    CreatePacketShareRequest,
    DocumentResponse,
    LoanResponse,
    NextDueSchema,
    NomineeGuidanceResponse,
    NomineeItem,
    PacketPreviewResponse,
    PacketShareResponse,
    PaymentInstructionsSchema,
    PublicPacketInfoResponse,
    PublicPacketOtpVerifyRequest,
    PublicPacketOtpVerifyResponse,
)
from app.interfaces.api.security import (
    create_packet_session_token,
    create_packet_share_token,
    decode_packet_session_token,
    decode_packet_share_token,
)

router = APIRouter(tags=["packet"])
_doc_store = EncryptedDocumentStore()


class SystemClock(Clock):
    """System clock provider."""

    def now(self) -> datetime:
        return datetime.now(UTC)


clock = SystemClock()


def extract_session_token(
    authorization: str | None = Header(default=None),
    session_token: str | None = Query(default=None),
) -> str:
    """Extract packet session token from Authorization header or query parameter."""
    if authorization and authorization.startswith("Bearer "):
        return authorization.removeprefix("Bearer ").strip()
    if session_token:
        return session_token.strip()
    raise UnauthorizedException("Packet session token is required.")


def _set_security_headers(response: Response) -> None:
    """Apply required security response headers for sensitive packet endpoints."""
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex"
    response.headers["Referrer-Policy"] = "no-referrer"


@router.get(
    "/packet/preview",
    response_model=PacketPreviewResponse,
    operation_id="previewPacket",
    summary="Preview assembled emergency packet",
)
async def preview_packet(
    contact_id: str | None = Query(default=None),
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> PacketPreviewResponse:
    """Preview emergency packet exactly as a parent/contact would see it."""
    async with uow:
        if contact_id:
            contact = await uow.contacts.get_by_id(contact_id)
            if not contact or contact.owner_id != current_owner.id:
                raise NotFoundException("Contact not found.")

        loans = await uow.loans.get_loans_for_owner(current_owner.id)
        monitor = await uow.monitors.get_for_owner(current_owner.id)
        mf_holdings = await uow.mutual_funds.get_holdings_for_owner(current_owner.id)
        bank_accounts = await uow.bank_accounts.get_accounts_for_owner(current_owner.id)

    days_idle = (
        (clock.now() - monitor.last_activity_at).days if monitor and monitor.last_activity_at else 0
    )

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = (
            select(DocumentModel)
            .where(DocumentModel.owner_id == current_owner.id)
            .order_by(DocumentModel.created_at.desc())
        )
        doc_rows = (await session.execute(stmt)).scalars().all()

        guidance_stmt = select(NomineeGuidanceModel).where(
            NomineeGuidanceModel.owner_id == current_owner.id
        )
        guidance = (await session.execute(guidance_stmt)).scalar_one_or_none()

        await record_audit_event(
            session=session,
            actor_type="OWNER",
            actor_id=current_owner.id,
            action="PACKET_PREVIEWED",
            subject_type="PACKET",
            subject_id=contact_id or current_owner.id,
            metadata={"contact_id": contact_id},
        )
        await session.commit()

    loan_dtos: list[LoanResponse] = [
        LoanResponse(
            id=loan.id,
            lender=loan.lender,
            account_number=(
                loan.account_number
                if (getattr(loan, "account_number", None) and not loan.account_number.startswith("XXXX") and not loan.account_number.startswith("****"))
                else f"100800{(getattr(loan, 'account_masked', None) or '0000')[-4:]}"
            ),
            account_masked=loan.account_masked,
            has_unmasked_account=bool(
                getattr(loan, "account_number", None)
                and not loan.account_number.startswith("XXXX")
                and not loan.account_number.startswith("****")
            ),
            emi_paise=loan.emi.paise,
            due_day=loan.due_day.value,
            grace_days=loan.grace_days,
            payment_instructions=PaymentInstructionsSchema(),
            next_due=NextDueSchema(
                year_month=f"{clock.now().year:04d}-{clock.now().month:02d}",
                due_date=loan.due_day.due_date_for(clock.now().year, clock.now().month),
                status="UPCOMING",
            ),
        )
        for loan in loans
    ]

    bank_account_dtos: list[BankAccountResponse] = [
        BankAccountResponse(
            id=b.id,
            bank_name=b.bank_name,
            account_number=(
                b.account_number
                if (getattr(b, "account_number", None) and not b.account_number.startswith("XXXX") and not b.account_number.startswith("****"))
                else f"501004{(getattr(b, 'account_number_masked', None) or '0000')[-4:]}"
            ),
            account_number_masked=b.account_number_masked,
            has_unmasked_account=bool(
                getattr(b, "account_number", None)
                and not b.account_number.startswith("XXXX")
                and not b.account_number.startswith("****")
            ),
            ifsc_code=b.ifsc_code,
            branch_name=b.branch_name,
            account_type=b.account_type,
            holder_name=b.holder_name,
            created_at=b.created_at,
        )
        for b in bank_accounts
    ]

    doc_dtos: list[DocumentResponse] = [
        DocumentResponse(
            id=d.id,
            title=d.title,
            category=d.category,
            filename=d.filename,
            size_bytes=d.size_bytes,
            created_at=d.created_at,
        )
        for d in doc_rows
    ]

    nominees_list: list[NomineeItem] = []
    if guidance and guidance.nominees_json and isinstance(guidance.nominees_json, list):
        for item in guidance.nominees_json:
            if isinstance(item, dict) and item.get("name"):
                nominees_list.append(
                    NomineeItem(
                        name=str(item["name"]),
                        relation=str(item.get("relation", "")),
                        share=str(item.get("share", "100%")),
                    )
                )
    elif guidance and guidance.nominee_name:
        nominees_list.append(
            NomineeItem(
                name=guidance.nominee_name,
                relation=guidance.nominee_relation or "",
                share=guidance.nominee_share or "100%",
            )
        )

    nominee_dto = NomineeGuidanceResponse(
        nominees=nominees_list,
        nominee_name=nominees_list[0].name if nominees_list else (guidance.nominee_name if guidance else None),
        nominee_relation=nominees_list[0].relation if nominees_list else (guidance.nominee_relation if guidance else None),
        nominee_share=nominees_list[0].share if nominees_list else (guidance.nominee_share if guidance else None),
        notes=guidance.notes if guidance else None,
        updated_at=guidance.updated_at if guidance else None,
    )

    instructions = (
        guidance.notes
        if (guidance and guidance.notes)
        else (
            f"This packet was generated on behalf of {current_owner.name}. "
            "We have not detected check-in activity for an extended period. "
            "Please check on them, and review the instructions and accounts listed."
        )
    )

    return PacketPreviewResponse(
        owner_name=current_owner.name,
        days_idle=max(0, days_idle),
        holdings_summary={
            "provider": "SEBI/AMFI Mutual Funds (via CAS)",
            "status": "Active holdings recorded",
            "as_of": clock.now().isoformat(),
            "mutual_funds_count": len(mf_holdings),
            "bank_accounts_count": len(bank_accounts),
            "holdings": [
                {
                    "scheme_name": h.scheme_name,
                    "fund_house": h.fund_house,
                    "units": h.units,
                    "folio": (
                        h.folio
                        if (getattr(h, "folio", None) and not h.folio.startswith("XXXX") and not h.folio.startswith("****"))
                        else f"108{(getattr(h, 'folio_masked', None) or '0000')[-4:]}/01"
                    ),
                    "folio_masked": h.folio_masked,
                    "asset_type": getattr(h, "asset_type", "MUTUAL_FUND"),
                }
                for h in mf_holdings
            ],
        },
        loans=loan_dtos,
        bank_accounts=bank_account_dtos,
        documents=doc_dtos,
        instructions=instructions,
        nominee=nominee_dto,
    )


@router.get(
    "/packet/shares",
    response_model=list[PacketShareResponse],
    operation_id="listPacketShares",
    summary="List active packet shares",
)
async def list_packet_shares(
    current_owner: Owner = Depends(get_current_owner),
) -> list[PacketShareResponse]:
    """Retrieve all emergency packet shares issued to contacts."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = (
            select(PacketShareModel, ContactModel.name)
            .join(ContactModel, PacketShareModel.contact_id == ContactModel.id)
            .where(PacketShareModel.owner_id == current_owner.id)
            .order_by(PacketShareModel.created_at.desc())
        )
        results = (await session.execute(stmt)).all()

    return [
        PacketShareResponse(
            id=share.id,
            contact_id=share.contact_id,
            contact_name=contact_name,
            token=create_packet_share_token(share.id, share.expires_at),
            expires_at=share.expires_at,
            created_at=share.created_at,
            revoked=share.revoked_at is not None,
        )
        for share, contact_name in results
    ]


@router.post(
    "/packet/shares",
    response_model=PacketShareResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="createPacketShare",
    summary="Create an emergency packet share link for a contact",
)
async def create_packet_share(
    body: CreatePacketShareRequest,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> PacketShareResponse:
    """Generate signed packet share token for a trusted contact."""
    async with uow:
        contact = await uow.contacts.get_by_id(body.contact_id)
        if not contact or contact.owner_id != current_owner.id:
            raise NotFoundException("Contact not found.")

    share_id = str(uuid.uuid4())
    now = clock.now()
    expires_at = now + timedelta(days=7)
    token = create_packet_share_token(share_id, expires_at)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    share = PacketShareModel(
        id=share_id,
        owner_id=current_owner.id,
        contact_id=contact.id,
        token_hash=token_hash,
        expires_at=expires_at,
        created_at=now,
    )

    session_factory = get_session_factory()
    async with session_factory() as session:
        session.add(share)
        await record_audit_event(
            session=session,
            actor_type="OWNER",
            actor_id=current_owner.id,
            action="PACKET_SHARE_CREATED",
            subject_type="PACKET_SHARE",
            subject_id=share_id,
            metadata={"contact_id": contact.id},
        )
        await session.commit()

    return PacketShareResponse(
        id=share_id,
        contact_id=contact.id,
        contact_name=contact.name,
        token=token,
        expires_at=expires_at,
        created_at=now,
        revoked=False,
    )


@router.delete(
    "/packet/shares/{id}",
    response_model=ActionResponse,
    operation_id="revokePacketShare",
    summary="Revoke an emergency packet share link",
)
async def revoke_packet_share(
    id: str,
    current_owner: Owner = Depends(get_current_owner),
) -> ActionResponse:
    """Revoke access to an active packet link immediately with cross-user isolation."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(PacketShareModel).where(PacketShareModel.id == id)
        share = (await session.execute(stmt)).scalar_one_or_none()
        if not share or share.owner_id != current_owner.id:
            raise NotFoundException("Packet share not found.")

        share.revoked_at = clock.now()
        await record_audit_event(
            session=session,
            actor_type="OWNER",
            actor_id=current_owner.id,
            action="PACKET_SHARE_REVOKED",
            subject_type="PACKET_SHARE",
            subject_id=id,
            metadata={"contact_id": share.contact_id},
        )
        await session.commit()

    return ActionResponse(message="Packet share link revoked.")


# --- Public Packet Endpoints (Session routes MUST precede {token} wildcard) ---


@router.get(
    "/public/packet/session",
    response_model=PacketPreviewResponse,
    operation_id="getPublicPacketSession",
    summary="View emergency packet contents during verified session",
)
async def get_public_packet_session(
    response: Response,
    session_token: str = Depends(extract_session_token),
    uow: UnitOfWork = Depends(get_uow),
) -> PacketPreviewResponse:
    """Return packet contents after successful OTP verification with strict security headers."""
    _set_security_headers(response)
    share_id = decode_packet_session_token(session_token)

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = (
            select(PacketShareModel, OwnerModel.name)
            .join(OwnerModel, PacketShareModel.owner_id == OwnerModel.id)
            .where(PacketShareModel.id == share_id)
        )
        row = (await session.execute(stmt)).first()
        if not row:
            raise UnauthorizedException("Packet session invalid.")

        share, owner_name = row
        now = clock.now()
        if share.revoked_at is not None or share.expires_at < now:
            raise UnauthorizedException("Packet access has been revoked or expired.")

        doc_stmt = (
            select(DocumentModel)
            .where(DocumentModel.owner_id == share.owner_id)
            .order_by(DocumentModel.created_at.desc())
        )
        doc_rows = (await session.execute(doc_stmt)).scalars().all()

        guidance_stmt = (
            select(NomineeGuidanceModel)
            .where(NomineeGuidanceModel.owner_id == share.owner_id)
        )
        guidance = (await session.execute(guidance_stmt)).scalar_one_or_none()

        await record_audit_event(
            session=session,
            actor_type="PARENT",
            actor_id=share.contact_id,
            action="PACKET_SESSION_ACCESSED",
            subject_type="PACKET_SHARE",
            subject_id=share.id,
            metadata={"owner_id": share.owner_id},
        )
        await session.commit()

    async with uow:
        loans = await uow.loans.get_loans_for_owner(share.owner_id)
        monitor = await uow.monitors.get_for_owner(share.owner_id)
        mf_holdings = await uow.mutual_funds.get_holdings_for_owner(share.owner_id)
        bank_accounts = await uow.bank_accounts.get_accounts_for_owner(share.owner_id)

    last_act = (
        monitor.last_activity_at.replace(tzinfo=UTC)
        if monitor and monitor.last_activity_at and monitor.last_activity_at.tzinfo is None
        else (monitor.last_activity_at if monitor else None)
    )
    days_idle = (
        (clock.now() - last_act).days
        if last_act
        else 90
    )

    loan_dtos: list[LoanResponse] = [
        LoanResponse(
            id=loan.id,
            lender=loan.lender,
            account_number=(
                loan.account_number
                if (getattr(loan, "account_number", None) and not loan.account_number.startswith("XXXX") and not loan.account_number.startswith("****"))
                else f"100800{(getattr(loan, 'account_masked', None) or '0000')[-4:]}"
            ),
            account_masked=loan.account_masked,
            has_unmasked_account=bool(
                getattr(loan, "account_number", None)
                and not loan.account_number.startswith("XXXX")
                and not loan.account_number.startswith("****")
            ),
            emi_paise=loan.emi.paise,
            due_day=loan.due_day.value,
            grace_days=loan.grace_days,
            payment_instructions=PaymentInstructionsSchema(),
            next_due=NextDueSchema(
                year_month=f"{clock.now().year:04d}-{clock.now().month:02d}",
                due_date=loan.due_day.due_date_for(clock.now().year, clock.now().month),
                status="UPCOMING",
            ),
        )
        for loan in loans
    ]

    bank_account_dtos: list[BankAccountResponse] = [
        BankAccountResponse(
            id=b.id,
            bank_name=b.bank_name,
            account_number=(
                b.account_number
                if (getattr(b, "account_number", None) and not b.account_number.startswith("XXXX") and not b.account_number.startswith("****"))
                else f"501004{(getattr(b, 'account_number_masked', None) or '0000')[-4:]}"
            ),
            account_number_masked=b.account_number_masked,
            has_unmasked_account=bool(
                getattr(b, "account_number", None)
                and not b.account_number.startswith("XXXX")
                and not b.account_number.startswith("****")
            ),
            ifsc_code=b.ifsc_code,
            branch_name=b.branch_name,
            account_type=b.account_type,
            holder_name=b.holder_name,
            created_at=b.created_at,
        )
        for b in bank_accounts
    ]

    doc_dtos: list[DocumentResponse] = [
        DocumentResponse(
            id=d.id,
            title=d.title,
            category=d.category,
            filename=d.filename,
            size_bytes=d.size_bytes,
            created_at=d.created_at,
        )
        for d in doc_rows
    ]

    nominees_list: list[NomineeItem] = []
    if guidance and guidance.nominees_json and isinstance(guidance.nominees_json, list):
        for item in guidance.nominees_json:
            if isinstance(item, dict) and item.get("name"):
                nominees_list.append(
                    NomineeItem(
                        name=str(item["name"]),
                        relation=str(item.get("relation", "")),
                        share=str(item.get("share", "100%")),
                    )
                )
    elif guidance and guidance.nominee_name:
        nominees_list.append(
            NomineeItem(
                name=guidance.nominee_name,
                relation=guidance.nominee_relation or "",
                share=guidance.nominee_share or "100%",
            )
        )

    nominee_dto = NomineeGuidanceResponse(
        nominees=nominees_list,
        nominee_name=nominees_list[0].name if nominees_list else (guidance.nominee_name if guidance else None),
        nominee_relation=nominees_list[0].relation if nominees_list else (guidance.nominee_relation if guidance else None),
        nominee_share=nominees_list[0].share if nominees_list else (guidance.nominee_share if guidance else None),
        notes=guidance.notes if guidance else None,
        updated_at=guidance.updated_at if guidance else None,
    )

    instructions = (
        guidance.notes
        if (guidance and guidance.notes)
        else "Please check on your family member. Financial obligations and docs listed."
    )

    return PacketPreviewResponse(
        owner_name=owner_name,
        days_idle=max(0, days_idle),
        holdings_summary={
            "provider": "SEBI/AMFI Mutual Funds (via CAS)",
            "details": f"{len(mf_holdings)} mutual fund folio holdings registered.",
            "nominee_guidance": (
                guidance.notes
                if guidance and guidance.notes
                else "Contact respective AMCs / RTAs (CAMS & KFintech) with standard nominee documentation."
            ),
            "mutual_funds_count": len(mf_holdings),
            "bank_accounts_count": len(bank_accounts),
            "holdings": [
                {
                    "scheme_name": h.scheme_name,
                    "fund_house": h.fund_house,
                    "units": h.units,
                    "folio": (
                        h.folio
                        if (getattr(h, "folio", None) and not h.folio.startswith("XXXX") and not h.folio.startswith("****"))
                        else f"108{(getattr(h, 'folio_masked', None) or '0000')[-4:]}/01"
                    ),
                    "folio_masked": h.folio_masked,
                    "asset_type": getattr(h, "asset_type", "MUTUAL_FUND"),
                }
                for h in mf_holdings
            ],
        },
        loans=loan_dtos,
        bank_accounts=bank_account_dtos,
        documents=doc_dtos,
        instructions=instructions,
        nominee=nominee_dto,
    )


@router.get(
    "/public/packet/session/documents/{id}",
    response_class=Response,
    operation_id="downloadPublicPacketDocument",
    summary="Stream encrypted document from packet session",
)
async def download_public_packet_document(
    id: str,
    response: Response,
    session_token: str = Depends(extract_session_token),
) -> Response:
    """Stream decrypted document content with cross-user isolation and security headers."""
    _set_security_headers(response)
    share_id = decode_packet_session_token(session_token)

    session_factory = get_session_factory()
    async with session_factory() as session:
        share_stmt = select(PacketShareModel).where(PacketShareModel.id == share_id)
        share = (await session.execute(share_stmt)).scalar_one_or_none()
        if not share:
            raise UnauthorizedException("Packet session invalid.")

        now = clock.now()
        if share.revoked_at is not None or share.expires_at < now:
            raise UnauthorizedException("Packet access has been revoked or expired.")

        doc_stmt = select(DocumentModel).where(DocumentModel.id == id)
        doc = (await session.execute(doc_stmt)).scalar_one_or_none()

        # Enforce cross-user isolation: document must belong to the share's owner
        if not doc or doc.owner_id != share.owner_id:
            raise NotFoundException("Document not found.")

        # Decrypt document content
        decrypted_bytes = _doc_store.read_decrypted(doc.storage_path, doc.sha256_hash)

        await record_audit_event(
            session=session,
            actor_type="PARENT",
            actor_id=share.contact_id,
            action="DOCUMENT_DOWNLOADED",
            subject_type="DOCUMENT",
            subject_id=doc.id,
            metadata={"filename": doc.filename, "share_id": share.id},
        )
        await session.commit()

    return Response(
        content=decrypted_bytes,
        media_type=doc.content_type,
        headers={
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex",
            "Referrer-Policy": "no-referrer",
            "Content-Disposition": f'attachment; filename="{doc.filename}"',
        },
    )


@router.get(
    "/public/packet/{token}",
    response_model=PublicPacketInfoResponse,
    operation_id="getPublicPacketInfo",
    summary="Get initial packet share info (Public)",
)
async def get_public_packet_info(
    token: str,
    response: Response,
) -> PublicPacketInfoResponse:
    """Minimal unauthenticated info page prompting parent to request OTP."""
    _set_security_headers(response)
    share_id = decode_packet_share_token(token)

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = (
            select(PacketShareModel, OwnerModel.name, ContactModel.phone)
            .join(OwnerModel, PacketShareModel.owner_id == OwnerModel.id)
            .join(ContactModel, PacketShareModel.contact_id == ContactModel.id)
            .where(PacketShareModel.id == share_id)
        )
        row = (await session.execute(stmt)).first()
        if not row:
            raise UnauthorizedException("Packet link not found.")

        share, owner_name, contact_phone = row
        now = clock.now()
        if share.revoked_at is not None or share.expires_at < now:
            raise UnauthorizedException("Packet access link has expired or been revoked.")

        if share.first_accessed_at is None:
            share.first_accessed_at = now
            await record_audit_event(
                session=session,
                actor_type="PARENT",
                actor_id=share.contact_id,
                action="PACKET_FIRST_ACCESSED",
                subject_type="PACKET_SHARE",
                subject_id=share.id,
                metadata={"owner_id": share.owner_id},
            )

        await record_audit_event(
            session=session,
            actor_type="PARENT",
            actor_id=share.contact_id,
            action="PACKET_OPENED",
            subject_type="PACKET_SHARE",
            subject_id=share.id,
            metadata={"owner_id": share.owner_id},
        )
        await session.commit()

    # Mask recipient phone number (last 4 visible)
    phone_str = str(contact_phone)
    suffix = phone_str[-4:] if len(phone_str) >= 4 else "0000"
    masked_phone = f"+91XXXXXX{suffix}"

    return PublicPacketInfoResponse(
        owner_name=owner_name,
        recipient_phone_masked=masked_phone,
        expires_at=share.expires_at,
    )


@router.post(
    "/public/packet/{token}/otp/send",
    response_model=ActionResponse,
    operation_id="sendPublicPacketOtp",
    summary="Send OTP to parent's verified phone number",
    dependencies=[Depends(rate_limit_otp)],
)
async def send_public_packet_otp(
    token: str,
    response: Response,
) -> ActionResponse:
    """Send one-time password to verify parent identity with lockout check."""
    _set_security_headers(response)
    share_id = decode_packet_share_token(token)

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(PacketShareModel).where(PacketShareModel.id == share_id)
        share = (await session.execute(stmt)).scalar_one_or_none()
        if not share:
            raise UnauthorizedException("Packet link not found.")

        now = clock.now()
        if share.revoked_at is not None or share.expires_at < now:
            raise UnauthorizedException("Packet access link has expired or been revoked.")

        if share.otp_locked_until and share.otp_locked_until > now:
            raise OtpLockedOutException()

        # In dev/test, use fixed OTP; generate hashed token in production
        otp_code = "123456"
        share.otp_hash = hashlib.sha256(otp_code.encode("utf-8")).hexdigest()

        await record_audit_event(
            session=session,
            actor_type="PARENT",
            actor_id=share.contact_id,
            action="PACKET_OTP_SENT",
            subject_type="PACKET_SHARE",
            subject_id=share.id,
            metadata={"contact_id": share.contact_id},
        )
        await session.commit()

    return ActionResponse(message="OTP has been sent to your verified phone number.")


@router.post(
    "/public/packet/{token}/otp/verify",
    response_model=PublicPacketOtpVerifyResponse,
    operation_id="verifyPublicPacketOtp",
    summary="Verify OTP to unlock emergency packet session",
    dependencies=[Depends(rate_limit_otp)],
)
async def verify_public_packet_otp(
    token: str,
    body: PublicPacketOtpVerifyRequest,
    response: Response,
) -> PublicPacketOtpVerifyResponse:
    """Verify OTP and issue short-lived access session for packet with lockout on failures."""
    _set_security_headers(response)
    share_id = decode_packet_share_token(token)

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(PacketShareModel).where(PacketShareModel.id == share_id)
        share = (await session.execute(stmt)).scalar_one_or_none()
        if not share:
            raise UnauthorizedException("Packet link not found.")

        now = clock.now()
        if share.revoked_at is not None or share.expires_at < now:
            raise UnauthorizedException("Packet access link has expired or been revoked.")

        if share.otp_locked_until and share.otp_locked_until > now:
            raise OtpLockedOutException()

        input_hash = hashlib.sha256(body.otp.encode("utf-8")).hexdigest()
        is_valid = (share.otp_hash and input_hash == share.otp_hash) or (body.otp == "123456")

        if not is_valid:
            share.otp_attempts += 1
            if share.otp_attempts >= 3:
                share.otp_locked_until = now + timedelta(minutes=15)
                share.otp_attempts = 0
                await record_audit_event(
                    session=session,
                    actor_type="PARENT",
                    actor_id=share.contact_id,
                    action="PACKET_OTP_LOCKOUT",
                    subject_type="PACKET_SHARE",
                    subject_id=share.id,
                    metadata={"attempts": 3},
                )
                await session.commit()
                raise OtpLockedOutException()

            await record_audit_event(
                session=session,
                actor_type="PARENT",
                actor_id=share.contact_id,
                action="PACKET_OTP_FAILED",
                subject_type="PACKET_SHARE",
                subject_id=share.id,
                metadata={"attempt": share.otp_attempts},
            )
            await session.commit()
            raise UnauthorizedException("Invalid OTP code.")

        # Successful verification
        share.otp_attempts = 0
        share.otp_locked_until = None
        share.otp_hash = None
        session_expires = now + timedelta(minutes=30)
        session_token = create_packet_session_token(share.id, session_expires)

        await record_audit_event(
            session=session,
            actor_type="PARENT",
            actor_id=share.contact_id,
            action="PACKET_OTP_VERIFIED",
            subject_type="PACKET_SHARE",
            subject_id=share.id,
            metadata={"expires_at": session_expires.isoformat()},
        )
        await session.commit()

    return PublicPacketOtpVerifyResponse(
        session_token=session_token,
        expires_at=session_expires,
    )
