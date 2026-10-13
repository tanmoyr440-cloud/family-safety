"""Owner entity representing the account holder."""

from dataclasses import dataclass
from datetime import datetime

from app.domain.value_objects.email_address import EmailAddress
from app.domain.value_objects.phone_number import PhoneNumber


@dataclass
class Owner:
    """Owner account holder entity."""

    id: str
    name: str
    phone: PhoneNumber
    email: EmailAddress
    timezone: str = "Asia/Kolkata"
    monitoring_paused_until: datetime | None = None
