"""EmailAddress value object."""

import re
from dataclasses import dataclass

from app.domain.errors import InvalidEmailAddress

_EMAIL_PATTERN = re.compile(
    r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$",
)


@dataclass(frozen=True)
class EmailAddress:
    """Immutable normalized email address."""

    value: str

    def __init__(self, raw: str) -> None:
        if not isinstance(raw, str):
            raise InvalidEmailAddress("Email address must be a string")

        normalized = raw.strip().lower()

        if not _EMAIL_PATTERN.match(normalized):
            raise InvalidEmailAddress(f"'{raw}' is not a valid email address")

        object.__setattr__(self, "value", normalized)

    def __str__(self) -> str:
        return self.value
