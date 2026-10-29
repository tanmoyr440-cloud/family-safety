"""Database connection and session factory utilities."""

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


def normalize_database_url(database_url: str) -> str:
    """Normalize postgres URLs to use asyncpg driver."""
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    if database_url.startswith("postgresql://") and not database_url.startswith("postgresql+"):
        return database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
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
