"""Activity signal source port protocol."""

from datetime import datetime
from typing import Protocol


class ActivitySignalSource(Protocol):
    """Protocol for fetching owner activity signals from external sources."""

    async def fetch_latest_activity(self, owner_id: str) -> datetime | None:
        """Fetch latest activity timestamp for the given owner, or None if no signals."""
        ...
