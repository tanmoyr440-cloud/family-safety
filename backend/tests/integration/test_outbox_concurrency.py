"""Integration tests on real Postgres: unique dedupe_key constraint
and SKIP LOCKED concurrency.
"""

import asyncio
import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.application.dto import OutboxMessage
from app.domain.policies.escalation_policy import ChannelKind
from app.infrastructure.persistence.models import OutboxModel
from app.infrastructure.persistence.repositories import SqlAlchemyOutboxRepository


@pytest.mark.asyncio
async def test_outbox_unique_dedupe_key_constraint(
    db_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Verifies that inserting a duplicate dedupe_key into real PostgreSQL
    is rejected idempotently.
    """
    dedupe_key = f"unique-dedupe-{uuid.uuid4()}"
    now = datetime.now(UTC)

    msg1 = OutboxMessage(
        id=str(uuid.uuid4()),
        dedupe_key=dedupe_key,
        channel=ChannelKind.SMS,
        recipient="+919876543210",
        template_id="tmpl_1",
        payload={"step": 1},
        next_attempt_at=now,
    )

    msg2 = OutboxMessage(
        id=str(uuid.uuid4()),
        dedupe_key=dedupe_key,  # same dedupe key, different message id
        channel=ChannelKind.EMAIL,
        recipient="test@example.com",
        template_id="tmpl_2",
        payload={"step": 2},
        next_attempt_at=now,
    )

    async with db_session_factory() as session:
        repo = SqlAlchemyOutboxRepository(session)
        inserted1 = await repo.enqueue(msg1)
        assert inserted1 is True
        await session.commit()

    async with db_session_factory() as session:
        repo = SqlAlchemyOutboxRepository(session)
        inserted2 = await repo.enqueue(msg2)
        assert inserted2 is False
        await session.commit()


@pytest.mark.asyncio
async def test_outbox_skip_locked_concurrency(
    db_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Tests that concurrent workers using SELECT ... FOR UPDATE SKIP LOCKED claim
    non-overlapping message batches.
    """
    async with db_session_factory() as session:
        bind = session.bind
        dialect_name = bind.dialect.name if bind is not None else ""
        if "sqlite" in dialect_name:
            pytest.skip("SKIP LOCKED row-level locking is not supported by SQLite")

    now = datetime.now(UTC)
    tag = str(uuid.uuid4())[:8]

    # Pre-populate 4 pending messages
    messages = [
        OutboxMessage(
            id=str(uuid.uuid4()),
            dedupe_key=f"skip-locked-{tag}-{i}",
            channel=ChannelKind.SMS,
            recipient=f"+91987654321{i}",
            template_id="tmpl",
            payload={"index": i},
            next_attempt_at=now,
        )
        for i in range(4)
    ]

    async with db_session_factory() as session:
        await session.execute(delete(OutboxModel))
        repo = SqlAlchemyOutboxRepository(session)
        for m in messages:
            await repo.enqueue(m)
        await session.commit()

    worker1_claimed = asyncio.Event()
    worker2_claimed = asyncio.Event()
    worker1_ids: list[str] = []
    worker2_ids: list[str] = []

    async def worker1() -> None:
        async with db_session_factory() as session:
            repo = SqlAlchemyOutboxRepository(session)
            batch = await repo.get_pending(now=now, limit=2)
            worker1_ids.extend(m.id for m in batch)
            worker1_claimed.set()
            await worker2_claimed.wait()
            await session.commit()

    async def worker2() -> None:
        async with db_session_factory() as session:
            repo = SqlAlchemyOutboxRepository(session)
            await worker1_claimed.wait()
            batch = await repo.get_pending(now=now, limit=2)
            worker2_ids.extend(m.id for m in batch)
            worker2_claimed.set()
            await session.commit()

    # Run both workers concurrently
    await asyncio.gather(worker1(), worker2())

    # Assert workers claimed disjoint sets of messages
    assert len(worker1_ids) > 0
    assert len(worker2_ids) > 0
    overlap = set(worker1_ids) & set(worker2_ids)
    assert len(overlap) == 0, f"Workers claimed overlapping messages: {overlap}"
