"""Use case: PauseMonitoring."""

from datetime import datetime

from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.entities.inactivity_monitor import InactivityMonitor


class PauseMonitoring:
    """Pauses an owner's inactivity monitoring until a specified future datetime."""

    def __init__(self, uow: UnitOfWork, clock: Clock) -> None:
        self._uow = uow
        self._clock = clock

    async def execute(
        self,
        owner_id: str,
        until: datetime,
        max_pause_days: int = 60,
    ) -> InactivityMonitor:
        """Pause monitoring for owner."""
        now = self._clock.now()

        async with self._uow:
            monitor = await self._uow.monitors.get_for_owner(owner_id)
            if monitor is None:
                monitor = InactivityMonitor(
                    owner_id=owner_id,
                    started_at=now,
                    last_activity_at=now,
                )

            monitor.pause(until=until, now=now, max_pause_days=max_pause_days)
            await self._uow.monitors.save(monitor)
            await self._uow.commit()

        return monitor
