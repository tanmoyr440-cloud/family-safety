"""System clock implementation."""

from datetime import UTC, datetime


class SystemClock:
    """Default system clock providing current UTC time."""

    def now(self) -> datetime:
        """Return current time in UTC."""
        return datetime.now(UTC)
