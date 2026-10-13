"""Money value object representing currency in integer paise.

Floats are strictly forbidden to eliminate rounding errors.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Self

from app.domain.errors import InvalidMoney


@dataclass(frozen=True)
class Money:
    """Monetary amount represented as integer paise."""

    paise: int

    def __post_init__(self) -> None:
        if isinstance(self.paise, bool) or not isinstance(self.paise, int):
            raise TypeError("paise must be an int")
        if self.paise < 0:
            raise InvalidMoney("Money amount cannot be negative")

    @classmethod
    def from_rupees(cls, rupees: Decimal) -> Self:
        """Construct Money from Decimal rupees."""
        if not isinstance(rupees, Decimal):
            raise TypeError("rupees must be a Decimal")
        paise_val = int(round(rupees * 100))
        return cls(paise=paise_val)

    def __add__(self, other: "Money") -> "Money":
        if not isinstance(other, Money):
            return NotImplemented
        return Money(self.paise + other.paise)

    def __sub__(self, other: "Money") -> "Money":
        if not isinstance(other, Money):
            return NotImplemented
        if self.paise < other.paise:
            raise InvalidMoney("Resulting Money amount cannot be negative")
        return Money(self.paise - other.paise)

    def __lt__(self, other: "Money") -> bool:
        if not isinstance(other, Money):
            return NotImplemented
        return self.paise < other.paise

    def __le__(self, other: "Money") -> bool:
        if not isinstance(other, Money):
            return NotImplemented
        return self.paise <= other.paise

    def __gt__(self, other: "Money") -> bool:
        if not isinstance(other, Money):
            return NotImplemented
        return self.paise > other.paise

    def __ge__(self, other: "Money") -> bool:
        if not isinstance(other, Money):
            return NotImplemented
        return self.paise >= other.paise

    def __str__(self) -> str:
        return f"{self.paise} paise"
