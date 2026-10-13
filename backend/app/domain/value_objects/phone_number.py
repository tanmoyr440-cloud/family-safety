"""PhoneNumber value object in E.164 international format."""

import re
from dataclasses import dataclass

from app.domain.errors import InvalidPhoneNumber

# E.164 format: leading '+' followed by 7 to 15 digits, starting with a non-zero country code digit
_E164_PATTERN = re.compile(r"^\+[1-9]\d{6,14}$")


@dataclass(frozen=True)
class PhoneNumber:
    """Immutable E.164 formatted phone number."""

    value: str

    def __init__(self, raw: str) -> None:
        if not isinstance(raw, str):
            raise InvalidPhoneNumber("Phone number must be a string")

        # Strip whitespace, hyphens, and brackets
        normalized = re.sub(r"[\s\-\(\)]", "", raw)

        if not _E164_PATTERN.match(normalized):
            raise InvalidPhoneNumber(
                f"'{raw}' does not conform to valid E.164 phone number format (+<country><digits>)",
            )

        object.__setattr__(self, "value", normalized)

    def __str__(self) -> str:
        return self.value
