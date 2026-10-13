"""Trusted contact entity."""

from dataclasses import dataclass
from datetime import datetime

from app.domain.value_objects.email_address import EmailAddress
from app.domain.value_objects.phone_number import PhoneNumber


@dataclass
class TrustedContact:
    """Trusted contact (parent/family) registered by owner."""

    id: str
    owner_id: str
    name: str
    relation: str
    phone: PhoneNumber
    email: EmailAddress
    priority: int
    locale: str = "en"
    consent_verified_at: datetime | None = None

    @property
    def is_verified(self) -> bool:
        """Return True if contact consent has been verified."""
        return self.consent_verified_at is not None
