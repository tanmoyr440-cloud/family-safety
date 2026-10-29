import os
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.infrastructure.persistence.database import create_engine, create_session_factory
from app.infrastructure.persistence.models import Base
from app.main import app

_TEST_DB_FILE = Path(__file__).resolve().parent / "test_family_safety_net.db"
_DEFAULT_TEST_DB_URL = f"sqlite+aiosqlite:///{_TEST_DB_FILE.as_posix()}"

TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    _DEFAULT_TEST_DB_URL,
)


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """Async test client for FastAPI application."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


@pytest.fixture
async def db_engine() -> AsyncIterator[AsyncEngine]:
    """SQLAlchemy AsyncEngine connected to the test database."""
    engine = create_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
def db_session_factory(db_engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Async session factory for test database."""
    return create_session_factory(db_engine)


@pytest.fixture(autouse=True)
def configure_test_dependencies(
    db_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Ensure API dependencies point to the test database session factory."""
    from app.config import settings
    from app.interfaces.api import dependencies

    settings.database_url = TEST_DB_URL
    dependencies._session_factory = db_session_factory

    from app.interfaces.api.security import (
        auth_rate_limiter,
        general_rate_limiter,
        otp_rate_limiter,
    )

    auth_rate_limiter.requests.clear()
    otp_rate_limiter.requests.clear()
    general_rate_limiter.requests.clear()
