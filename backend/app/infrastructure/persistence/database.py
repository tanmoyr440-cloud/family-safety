"""Database connection and session factory utilities."""

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


def create_engine(database_url: str, echo: bool = False) -> AsyncEngine:
    """Create SQLAlchemy AsyncEngine."""
    if "sqlite" in database_url:
        return create_async_engine(
            database_url,
            echo=echo,
            future=True,
            connect_args={"check_same_thread": False},
        )
    return create_async_engine(
        database_url,
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
