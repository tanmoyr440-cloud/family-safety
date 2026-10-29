"""Database connection and session factory utilities."""

from pathlib import Path

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


def normalize_database_url(database_url: str) -> str:
    """Normalize database URLs to use appropriate async drivers."""
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    if database_url.startswith("postgresql://") and not database_url.startswith("postgresql+"):
        return database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if database_url.startswith("sqlite://") and not database_url.startswith("sqlite+"):
        database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    if database_url in ("sqlite+aiosqlite:///family_safety_net.db", "sqlite:///family_safety_net.db"):
        backend_dir = Path(__file__).resolve().parents[3]
        db_path = (backend_dir / "family_safety_net.db").as_posix()
        return f"sqlite+aiosqlite:///{db_path}"
    return database_url


def create_engine(database_url: str, echo: bool = False) -> AsyncEngine:
    """Create SQLAlchemy AsyncEngine."""
    normalized_url = normalize_database_url(database_url)
    if "sqlite" in normalized_url:
        return create_async_engine(
            normalized_url,
            echo=echo,
            future=True,
            connect_args={"check_same_thread": False},
        )
    return create_async_engine(
        normalized_url,
        echo=echo,
        future=True,
        pool_pre_ping=True,
    )


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Create async session factory for UnitOfWork."""
    return async_sessionmaker(
        bind=engine,
        expire_on_commit=False,
        autoflush=False,
    )
