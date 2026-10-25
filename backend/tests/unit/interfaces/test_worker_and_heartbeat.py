"""Unit tests for scheduler heartbeat, health monitoring, and worker service."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.policies.escalation_policy import ChannelKind
from app.infrastructure.notifications.console_channel import ConsoleChannel
from app.infrastructure.persistence.models import SchedulerHeartbeatModel
from app.interfaces.worker.heartbeat import check_scheduler_health, record_heartbeat
from app.interfaces.worker.service import WorkerService


@pytest.mark.asyncio
async def test_heartbeat_recording_and_health_check(
    db_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Verifies heartbeats are recorded and health status evaluates 36h stale threshold."""
    # Ensure fresh state
    async with db_session_factory() as session:
        await session.execute(delete(SchedulerHeartbeatModel))
        await session.commit()

    # 1. Fresh state with no heartbeats
    is_healthy, last_success, _ = await check_scheduler_health(
        db_session_factory,
        max_stale_hours=36,
    )
    assert is_healthy is False
    assert last_success is None

    # 2. Record a successful run
    await record_heartbeat(db_session_factory, job_name="test_job", success=True)
    is_healthy, last_success, _ = await check_scheduler_health(
        db_session_factory,
        max_stale_hours=36,
    )
    assert is_healthy is True
    assert last_success is not None

    # 3. Simulate stale heartbeat older than 36 hours
    async with db_session_factory() as session:
        stale_time = datetime.now(UTC) - timedelta(hours=37)
        stmt = update(SchedulerHeartbeatModel).values(
            last_success_at=stale_time,
            updated_at=stale_time,
        )
        await session.execute(stmt)
        await session.commit()

    is_healthy, last_success, detail = await check_scheduler_health(
        db_session_factory,
        max_stale_hours=36,
    )
    assert is_healthy is False
    assert detail is not None
    assert "37 hours" in detail


@pytest.mark.asyncio
async def test_scheduler_health_endpoint_stale_detection(
    client: AsyncClient,
    db_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Verifies GET /api/v1/health/scheduler returns 503 when heartbeats are older than 36 hours."""
    # 1. Recent heartbeat -> 200 OK
    await record_heartbeat(db_session_factory, job_name="outbox_dispatch", success=True)
    resp = await client.get("/api/v1/health/scheduler")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    # 2. Stale heartbeat -> 503 Service Unavailable
    async with db_session_factory() as session:
        stale_time = datetime.now(UTC) - timedelta(hours=40)
        stmt = update(SchedulerHeartbeatModel).values(
            last_success_at=stale_time,
            updated_at=stale_time,
        )
        await session.execute(stmt)
        await session.commit()

    try:
        resp_stale = await client.get("/api/v1/health/scheduler")
        assert resp_stale.status_code == 503
        assert resp_stale.json()["status"] == "unhealthy"
    finally:
        async with db_session_factory() as session:
            await session.execute(delete(SchedulerHeartbeatModel))
            await session.commit()


@pytest.mark.asyncio
async def test_worker_service_evaluation_cycle(
    db_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Verifies WorkerService runs evaluation jobs and dispatch in dry-run mode without errors."""
    console_sms = ConsoleChannel(kind=ChannelKind.SMS, dry_run=True)
    console_email = ConsoleChannel(kind=ChannelKind.EMAIL, dry_run=True)

    worker = WorkerService(
        session_factory=db_session_factory,
        channels=[console_sms, console_email],
    )

    results = await worker.run_evaluation_cycle(dry_run=True)
    assert "inactivity_evaluated" in results
    assert "loans_evaluated" in results
    assert "messages_dispatched" in results
