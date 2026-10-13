"""DueDay value object representing a day of the month (1-31)."""

import calendar
from dataclasses import dataclass
from datetime import date

from app.domain.errors import InvalidDueDay


@dataclass(frozen=True)
class DueDay:
    """Day of month for recurrent payments."""

    value: int

    def __post_init__(self) -> None:
        if isinstance(self.value, bool) or not isinstance(self.value, int):
            raise InvalidDueDay("Due day must be an integer")
        if not (1 <= self.value <= 31):
            raise InvalidDueDay(f"Due day must be between 1 and 31, got {self.value}")

    def due_date_for(self, year: int, month: int) -> date:
        """Calculate due date for a specific year and month, clamping to month end."""
        last_day = calendar.monthrange(year, month)[1]
        clamped_day = min(self.value, last_day)
        return date(year, month, clamped_day)

    def __str__(self) -> str:
        return str(self.value)
