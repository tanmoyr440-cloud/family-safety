"""FastAPI dependency injection providers."""

from collections.abc import AsyncIterator

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.application.ports.unit_of_work import UnitOfWork
from app.config import settings
from app.domain.entities.owner import Owner
from app.infrastructure.persistence.database import create_engine, create_session_factory
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from app.interfaces.api.errors import UnauthorizedException
from app.interfaces.api.security import (
    auth_rate_limiter,
    decode_access_token,
    general_rate_limiter,
    otp_rate_limiter,
    verify_csrf,
)

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Get or initialize the SQLAlchemy async session factory."""
    global _engine, _session_factory
    if _session_factory is None:
        _engine = create_engine(settings.database_url)
        _session_factory = create_session_factory(_engine)
    return _session_factory


def get_engine() -> AsyncEngine:
    """Get or initialize the SQLAlchemy async engine."""
    global _engine
    if _engine is None:
        get_session_factory()
    assert _engine is not None
    return _engine


async def get_uow() -> AsyncIterator[UnitOfWork]:
    """Dependency provider for UnitOfWork."""
    factory = get_session_factory()
    uow = SqlAlchemyUnitOfWork(factory)
    yield uow


async def get_current_owner(
    request: Request,
    uow: UnitOfWork = Depends(get_uow),
) -> Owner:
    """Dependency to extract, authenticate and return current Owner."""
    auth_header = request.headers.get("Authorization")
    has_bearer = bool(auth_header and auth_header.startswith("Bearer "))

    token = None
    if has_bearer and auth_header:
        token = auth_header[7:].strip()
    elif "access_token" in request.cookies:
        token = request.cookies.get("access_token")

    if not token:
        raise UnauthorizedException("Authentication required.")

    payload = decode_access_token(token)
    owner_id: str = payload["sub"]
    csrf_token: str = payload.get("csrf", "")

    # For authenticated mutating requests relying on ambient cookies, enforce CSRF.
    # Authorization: Bearer tokens are explicitly attached by the client and immune to CSRF.
    if not has_bearer:
        verify_csrf(request, csrf_token)

    async with uow:
        owner = await uow.owners.get_by_id(owner_id)
        if not owner:
            raise UnauthorizedException("Owner account not found.")
        return owner


def rate_limit_auth(request: Request) -> None:
    """Rate limit authentication attempts per client IP."""
    client_ip = request.client.host if request.client else "unknown"
    auth_rate_limiter.check(client_ip)


def rate_limit_otp(request: Request) -> None:
    """Rate limit OTP sending and verification attempts per client IP."""
    client_ip = request.client.host if request.client else "unknown"
    otp_rate_limiter.check(client_ip)


def rate_limit_general(request: Request) -> None:
    """General endpoint rate limiter."""
    client_ip = request.client.host if request.client else "unknown"
    general_rate_limiter.check(client_ip)
