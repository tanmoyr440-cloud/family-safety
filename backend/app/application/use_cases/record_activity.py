"""Use case: RecordActivity."""

from datetime import datetime

from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.entities.inactivity_monitor import InactivityMonitor


class RecordActivity:
    """Records an activity signal for an owner, resetting the inactivity clock."""

    def __init__(self, uow: UnitOfWork, clock: Clock) -> None:
        self._uow = uow
        self._clock = clock

    async def execute(self, owner_id: str, occurred_at: datetime | None = None) -> datetime:
        """Record activity for owner and return updated last activity timestamp."""
        now = occurred_at or self._clock.now()

        async with self._uow:
            monitor = await self._uow.monitors.get_for_owner(owner_id)
            if monitor is None:
                monitor = InactivityMonitor(
                    owner_id=owner_id,
                    started_at=now,
                    last_activity_at=now,
                )
            else:
                monitor.record_activity(now)

            await self._uow.monitors.save(monitor)
            await self._uow.commit()

        return monitor.last_activity_at
