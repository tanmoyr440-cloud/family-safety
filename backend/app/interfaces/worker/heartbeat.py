"""Scheduler heartbeat persistence and health inspection."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.infrastructure.persistence.models import SchedulerHeartbeatModel


async def record_heartbeat(
    session_factory: async_sessionmaker[AsyncSession],
    job_name: str,
    success: bool,
    error_message: str | None = None,
) -> None:
    """Record a heartbeat execution status for a scheduler job."""
    now = datetime.now(UTC)
    async with session_factory() as session:
        # Check existing row to preserve previous last_success_at if current run failed
        stmt = select(SchedulerHeartbeatModel).where(SchedulerHeartbeatModel.job_name == job_name)
        existing = (await session.execute(stmt)).scalar_one_or_none()

        last_success = now if success else (existing.last_success_at if existing else None)
        last_err = None if success else error_message

        upsert_stmt = (
            insert(SchedulerHeartbeatModel)
            .values(
                job_name=job_name,
                last_run_at=now,
                last_success_at=last_success,
                last_error=last_err,
                updated_at=now,
            )
            .on_conflict_do_update(
                index_elements=["job_name"],
                set_={
                    "last_run_at": now,
                    "last_success_at": last_success,
                    "last_error": last_err,
                    "updated_at": now,
                },
            )
        )
        await session.execute(upsert_stmt)
        await session.commit()


async def check_scheduler_health(
    session_factory: async_sessionmaker[AsyncSession],
    max_stale_hours: int = 36,
) -> tuple[bool, datetime | None, str | None]:
    """Check if scheduler heartbeat is healthy (success within last max_stale_hours).

    Returns (is_healthy, last_success_at, detail).
    """
    now = datetime.now(UTC)
    async with session_factory() as session:
        stmt = (
            select(SchedulerHeartbeatModel.last_success_at)
            .where(SchedulerHeartbeatModel.last_success_at.is_not(None))
            .order_by(SchedulerHeartbeatModel.last_success_at.desc())
            .limit(1)
        )
        latest_success = (await session.execute(stmt)).scalar_one_or_none()

    if latest_success is None:
        return False, None, "No successful scheduler runs recorded."

    age = now - latest_success
    if age > timedelta(hours=max_stale_hours):
        return (
            False,
            latest_success,
            f"Scheduler has not run successfully in {int(age.total_seconds() // 3600)} hours.",
        )

    return True, latest_success, None
