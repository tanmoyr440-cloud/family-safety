"""Authentication and account management router conforming to api-contract.md."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import select

from app.application.ports.unit_of_work import UnitOfWork
from app.config import settings
from app.domain.entities.owner import Owner
from app.infrastructure.persistence.models import (
    InactivityMonitorModel,
    OwnerModel,
    RefreshTokenModel,
)
from app.interfaces.api.dependencies import (
    get_current_owner,
    get_session_factory,
    get_uow,
    rate_limit_auth,
)
from app.interfaces.api.errors import (
    ConflictException,
    UnauthorizedException,
)
from app.interfaces.api.schemas import (
    ActionResponse,
    LoginRequest,
    LoginResponse,
    MfaEnrollResponse,
    MfaVerifyRequest,
    OwnerExportResponse,
    OwnerResponse,
    RefreshResponse,
    RegisterRequest,
)
from app.interfaces.api.security import (
    create_access_token,
    generate_csrf_token,
    generate_secure_token,
    generate_totp_secret,
    hash_password,
    hash_token,
    verify_password,
    verify_totp,
)

router = APIRouter(tags=["auth"])


def _is_cross_site_secure(request: Request | None) -> bool:
    if settings.environment == "production":
        return True
    if request is not None:
        scheme = request.url.scheme
        proto = request.headers.get("x-forwarded-proto")
        origin = request.headers.get("origin", "")
        host = request.headers.get("host", "")
        if scheme == "https" or proto == "https":
            return True
        if "onrender.com" in host or "vercel.app" in origin:
            return True
    return False


def _set_auth_cookies(
    response: Response,
    owner_id: str,
    csrf_token: str,
    request: Request | None = None,
) -> tuple[str, str]:
    """Helper to issue and set session cookies."""
    access_token = create_access_token(owner_id=owner_id, csrf_token=csrf_token)
    raw_refresh_token = generate_secure_token(48)
    is_secure = _is_cross_site_secure(request)
    samesite = "none" if is_secure else "lax"
    cookie_secure = True if is_secure else False

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=cookie_secure,
        samesite=samesite,
        max_age=24 * 3600,  # 1 day (86400 seconds)
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,
        secure=cookie_secure,
        samesite=samesite,
        max_age=7 * 24 * 3600,
        path="/",
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,  # Client needs to read this to send X-CSRF-Token
        secure=cookie_secure,
        samesite=samesite,
        max_age=7 * 24 * 3600,
        path="/",
    )
    # Also expose headers for cross-origin clients (Vercel to Render)
    response.headers["X-CSRF-Token"] = csrf_token
    response.headers["X-Access-Token"] = access_token
    response.headers["X-Refresh-Token"] = raw_refresh_token
    return access_token, raw_refresh_token


def _clear_auth_cookies(response: Response, request: Request | None = None) -> None:
    """Helper to remove authentication cookies."""
    is_secure = _is_cross_site_secure(request)
    samesite = "none" if is_secure else "lax"
    cookie_secure = True if is_secure else False

    response.delete_cookie(key="access_token", path="/", samesite=samesite, secure=cookie_secure)
    response.delete_cookie(key="refresh_token", path="/", samesite=samesite, secure=cookie_secure)
    response.delete_cookie(key="csrf_token", path="/", samesite=samesite, secure=cookie_secure)


@router.post(
    "/auth/register",
    response_model=OwnerResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="registerOwner",
    summary="Register new owner",
    dependencies=[Depends(rate_limit_auth)],
)
async def register(
    body: RegisterRequest,
    response: Response,
    request: Request,
) -> OwnerResponse:
    """Register a new account holder with initial monitor and credentials."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        # Check existing email
        stmt = select(OwnerModel).where(OwnerModel.email == body.email.lower().strip())
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing:
            raise ConflictException(
                code="EMAIL_ALREADY_EXISTS",
                title="Email already registered",
                detail="An account with this email address already exists.",
            )

        owner_id = str(uuid.uuid4())
        hashed_pwd = hash_password(body.password)

        owner_row = OwnerModel(
            id=owner_id,
            name=body.name.strip(),
            email=body.email.lower().strip(),
            phone=body.phone.strip(),
            timezone="Asia/Kolkata",
            password_hash=hashed_pwd,
            mfa_enabled=False,
        )
        session.add(owner_row)

        # Create default monitor (90 days threshold, warnings at 60 and 80)
        now = datetime.now(UTC)
        monitor_row = InactivityMonitorModel(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            started_at=now,
            last_activity_at=now,
            threshold_days=90,
            warning_days=[60, 80],
            status="OK",
            episode_id=str(uuid.uuid4()),
        )
        session.add(monitor_row)

        csrf_token = generate_csrf_token()
        _, raw_refresh_token = _set_auth_cookies(response, owner_id, csrf_token, request)

        # Store hashed refresh token
        now = datetime.now(UTC)
        rf_row = RefreshTokenModel(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            token_hash=hash_token(raw_refresh_token),
            expires_at=now + timedelta(days=7),
            created_at=now,
        )
        session.add(rf_row)
        await session.commit()

    return OwnerResponse(
        id=owner_id,
        name=body.name,
        email=body.email,
        phone=body.phone,
        timezone="Asia/Kolkata",
        mfa_enabled=False,
    )


@router.post(
    "/auth/login",
    response_model=LoginResponse,
    operation_id="loginOwner",
    summary="Authenticate owner",
    dependencies=[Depends(rate_limit_auth)],
)
async def login(
    body: LoginRequest,
    response: Response,
    request: Request,
) -> LoginResponse:
    """Log in owner and establish cookie session."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(OwnerModel).where(OwnerModel.email == body.email.lower().strip())
        owner_row = (await session.execute(stmt)).scalar_one_or_none()

        if not owner_row or not owner_row.password_hash:
            raise UnauthorizedException("Invalid email or password.")

        if not verify_password(body.password, owner_row.password_hash):
            raise UnauthorizedException("Invalid email or password.")

        # Check MFA if enabled
        if owner_row.mfa_enabled:
            if not body.mfa_code:
                owner_resp = OwnerResponse(
                    id=owner_row.id,
                    name=owner_row.name,
                    email=owner_row.email,
                    phone=owner_row.phone,
                    timezone=owner_row.timezone,
                    mfa_enabled=True,
                )
                return LoginResponse(owner=owner_resp, csrf_token="", mfa_required=True)

            if not owner_row.mfa_secret or not verify_totp(owner_row.mfa_secret, body.mfa_code):
                raise UnauthorizedException("Invalid MFA verification code.")

        csrf_token = generate_csrf_token()
        access_token, raw_refresh_token = _set_auth_cookies(response, owner_row.id, csrf_token, request)

        now = datetime.now(UTC)
        rf_row = RefreshTokenModel(
            id=str(uuid.uuid4()),
            owner_id=owner_row.id,
            token_hash=hash_token(raw_refresh_token),
            expires_at=now + timedelta(days=7),
            created_at=now,
        )
        session.add(rf_row)
        await session.commit()

        owner_resp = OwnerResponse(
            id=owner_row.id,
            name=owner_row.name,
            email=owner_row.email,
            phone=owner_row.phone,
            timezone=owner_row.timezone,
            mfa_enabled=owner_row.mfa_enabled,
            monitoring_paused_until=owner_row.monitoring_paused_until,
        )
        return LoginResponse(
            owner=owner_resp,
            csrf_token=csrf_token,
            access_token=access_token,
            refresh_token=raw_refresh_token,
            mfa_required=False,
        )


@router.post(
    "/auth/logout",
    response_model=ActionResponse,
    operation_id="logoutOwner",
    summary="Log out owner",
)
async def logout(
    request: Request,
    response: Response,
) -> ActionResponse:
    """Clear session cookies and revoke current refresh token."""
    refresh_token = request.cookies.get("refresh_token") or request.headers.get("x-refresh-token")
    if refresh_token:
        session_factory = get_session_factory()
        async with session_factory() as session:
            h = hash_token(refresh_token)
            stmt = select(RefreshTokenModel).where(
                RefreshTokenModel.token_hash == h,
                RefreshTokenModel.revoked_at.is_(None),
            )
            rf_row = (await session.execute(stmt)).scalar_one_or_none()
            if rf_row:
                rf_row.revoked_at = datetime.now(UTC)
                await session.commit()

    _clear_auth_cookies(response, request)
    return ActionResponse(message="Successfully logged out.")


@router.post(
    "/auth/refresh",
    response_model=RefreshResponse,
    operation_id="refreshSession",
    summary="Refresh session tokens",
)
async def refresh(
    request: Request,
    response: Response,
) -> RefreshResponse:
    """Rotate refresh token and issue new access token."""
    raw_token = request.cookies.get("refresh_token") or request.headers.get("x-refresh-token")
    if not raw_token:
        raise UnauthorizedException("No refresh token provided.")

    h = hash_token(raw_token)
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(RefreshTokenModel).where(RefreshTokenModel.token_hash == h)
        rf_row = (await session.execute(stmt)).scalar_one_or_none()

        now = datetime.now(UTC)
        if not rf_row or rf_row.revoked_at is not None or rf_row.expires_at < now:
            _clear_auth_cookies(response, request)
            raise UnauthorizedException("Invalid, expired, or revoked refresh token.")

        # Revoke old refresh token (single use)
        rf_row.revoked_at = now

        csrf_token = generate_csrf_token()
        access_token, new_refresh_token = _set_auth_cookies(response, rf_row.owner_id, csrf_token, request)

        new_rf_row = RefreshTokenModel(
            id=str(uuid.uuid4()),
            owner_id=rf_row.owner_id,
            token_hash=hash_token(new_refresh_token),
            expires_at=now + timedelta(days=7),
            created_at=now,
        )
        session.add(new_rf_row)
        await session.commit()

    return RefreshResponse(
        message="Session refreshed successfully.",
        csrf_token=csrf_token,
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


@router.post(
    "/auth/mfa/enroll",
    response_model=MfaEnrollResponse,
    operation_id="enrollMfa",
    summary="Enroll in TOTP MFA",
)
async def enroll_mfa(
    current_owner: Owner = Depends(get_current_owner),
) -> MfaEnrollResponse:
    """Generate a TOTP secret and provisioning URI."""
    secret = generate_totp_secret()
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(OwnerModel).where(OwnerModel.id == current_owner.id)
        owner_row = (await session.execute(stmt)).scalar_one()
        owner_row.mfa_secret = secret
        await session.commit()

    otpauth_url = (
        f"otpauth://totp/FamilySafetyNet:{current_owner.email.value}"
        f"?secret={secret}&issuer=FamilySafetyNet"
    )
    return MfaEnrollResponse(secret=secret, otpauth_url=otpauth_url)


@router.post(
    "/auth/mfa/verify",
    response_model=ActionResponse,
    operation_id="verifyMfa",
    summary="Verify and enable TOTP MFA",
)
async def verify_mfa(
    body: MfaVerifyRequest,
    current_owner: Owner = Depends(get_current_owner),
) -> ActionResponse:
    """Verify code and activate MFA for current owner."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(OwnerModel).where(OwnerModel.id == current_owner.id)
        owner_row = (await session.execute(stmt)).scalar_one()

        if not owner_row.mfa_secret:
            raise ConflictException(
                code="MFA_NOT_ENROLLED",
                title="MFA Not Enrolled",
                detail="MFA enrollment must be initiated first.",
            )

        if not verify_totp(owner_row.mfa_secret, body.code):
            raise UnauthorizedException("Invalid MFA verification code.")

        owner_row.mfa_enabled = True
        await session.commit()

    return ActionResponse(message="MFA has been successfully verified and enabled.")


@router.get(
    "/me",
    response_model=OwnerResponse,
    operation_id="getCurrentOwner",
    summary="Get current owner profile",
)
async def get_me(
    current_owner: Owner = Depends(get_current_owner),
) -> OwnerResponse:
    """Return profile details for authenticated owner."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(OwnerModel).where(OwnerModel.id == current_owner.id)
        owner_row = (await session.execute(stmt)).scalar_one()

    return OwnerResponse(
        id=owner_row.id,
        name=owner_row.name,
        email=owner_row.email,
        phone=owner_row.phone,
        timezone=owner_row.timezone,
        mfa_enabled=owner_row.mfa_enabled,
        monitoring_paused_until=owner_row.monitoring_paused_until,
    )


@router.get(
    "/me/export",
    response_model=OwnerExportResponse,
    operation_id="exportOwnerData",
    summary="Export all owner data",
)
async def export_me(
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> OwnerExportResponse:
    """Export complete owner data bundle (GDPR / DPDP compliance)."""
    async with uow:
        contacts = await uow.contacts.get_contacts_for_owner(current_owner.id)
        monitor = await uow.monitors.get_for_owner(current_owner.id)
        loans = await uow.loans.get_loans_for_owner(current_owner.id)

    monitor_dict: dict[str, Any] | None = None
    if monitor:
        monitor_dict = {
            "threshold_days": monitor.config.threshold_days,
            "warning_days": list(monitor.config.warning_days),
            "current_stage": monitor.status.value,
            "last_activity_at": (
                monitor.last_activity_at.isoformat() if monitor.last_activity_at else None
            ),
        }

    contacts_data = [
        {
            "id": c.id,
            "name": c.name,
            "relation": c.relation,
            "phone": c.phone.value,
            "email": c.email.value,
            "priority": c.priority,
            "consent_status": "VERIFIED" if c.is_verified else "PENDING",
        }
        for c in contacts
    ]

    loans_data = [
        {
            "id": loan.id,
            "lender": loan.lender,
            "account_masked": loan.account_masked,
            "emi_paise": loan.emi.paise,
            "due_day": loan.due_day.value,
            "grace_days": loan.grace_days,
        }
        for loan in loans
    ]

    return OwnerExportResponse(
        owner=OwnerResponse(
            id=current_owner.id,
            name=current_owner.name,
            email=current_owner.email.value,
            phone=current_owner.phone.value,
            timezone=current_owner.timezone,
            monitoring_paused_until=current_owner.monitoring_paused_until,
        ),
        monitor=monitor_dict,
        contacts=contacts_data,
        loans=loans_data,
        documents=[],
        exported_at=datetime.now(UTC),
    )


@router.delete(
    "/me",
    response_model=ActionResponse,
    operation_id="deleteOwnerAccount",
    summary="Delete owner account",
)
async def delete_me(
    response: Response,
    current_owner: Owner = Depends(get_current_owner),
) -> ActionResponse:
    """Permanently delete owner account and associated data."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(OwnerModel).where(OwnerModel.id == current_owner.id)
        owner_row = (await session.execute(stmt)).scalar_one_or_none()
        if owner_row:
            await session.delete(owner_row)
            await session.commit()

    _clear_auth_cookies(response)
    return ActionResponse(message="Account successfully deleted.")
