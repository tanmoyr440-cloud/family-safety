"""Days value object representing non-negative durations."""

from dataclasses import dataclass

from app.domain.errors import InvalidDays


@dataclass(frozen=True)
class Days:
    """Non-negative day duration count."""

    value: int

    def __post_init__(self) -> None:
        if isinstance(self.value, bool) or not isinstance(self.value, int):
            raise InvalidDays("Days must be an integer")
        if self.value < 0:
            raise InvalidDays(f"Days must be non-negative, got {self.value}")

    def __str__(self) -> str:
        return f"{self.value} days"
