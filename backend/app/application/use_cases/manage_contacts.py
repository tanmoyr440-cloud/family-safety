"""Use case: ManageContacts."""

import uuid
from datetime import datetime

from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.entities.contact import TrustedContact
from app.domain.errors import ContactNotVerified
from app.domain.value_objects.email_address import EmailAddress
from app.domain.value_objects.phone_number import PhoneNumber


class ManageContacts:
    """Manages trusted contacts registration, consent verification, and deletion."""

    def __init__(self, uow: UnitOfWork, clock: Clock) -> None:
        self._uow = uow
        self._clock = clock

    async def add_contact(
        self,
        owner_id: str,
        name: str,
        relation: str,
        phone: str,
        email: str,
        priority: int,
        locale: str = "en",
    ) -> TrustedContact:
        """Register a new trusted contact with consent pending."""
        contact = TrustedContact(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            name=name,
            relation=relation,
            phone=PhoneNumber(phone),
            email=EmailAddress(email),
            priority=priority,
            locale=locale,
            consent_verified_at=None,
        )

        async with self._uow:
            await self._uow.contacts.save(contact)
            await self._uow.commit()

        return contact

    async def verify_consent(
        self,
        contact_id: str,
        verified_at: datetime | None = None,
    ) -> TrustedContact:
        """Record verified consent for contact."""
        now = verified_at or self._clock.now()

        async with self._uow:
            contact = await self._uow.contacts.get_by_id(contact_id)
            if contact is None:
                raise ContactNotVerified(f"Contact {contact_id} not found")

            contact.consent_verified_at = now
            await self._uow.contacts.save(contact)
            await self._uow.commit()

        return contact

    async def delete_contact(self, contact_id: str) -> None:
        """Delete contact."""
        async with self._uow:
            await self._uow.contacts.delete(contact_id)
            await self._uow.commit()
