"""Clock port protocol."""

from datetime import datetime
from typing import Protocol


class Clock(Protocol):
    """Protocol for time providers."""

    def now(self) -> datetime:
        """Return current datetime."""
        ...
