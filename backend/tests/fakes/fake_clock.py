"""FakeClock test double."""

from datetime import UTC, datetime, timedelta


class FakeClock:
    """Test clock that can be explicitly advanced for time-travel simulations."""

    def __init__(self, initial_time: datetime | None = None) -> None:
        self._current_time: datetime = initial_time or datetime(2026, 1, 1, 9, 0, tzinfo=UTC)

    def now(self) -> datetime:
        """Return current simulated time."""
        return self._current_time

    def advance(
        self,
        days: int = 0,
        hours: int = 0,
        minutes: int = 0,
        seconds: int = 0,
    ) -> datetime:
        """Advance the simulated clock."""
        delta = timedelta(days=days, hours=hours, minutes=minutes, seconds=seconds)
        self._current_time += delta
        return self._current_time

    def set(self, target_time: datetime) -> None:
        """Set simulated clock to a specific timestamp."""
        self._current_time = target_time
