"""Unit tests for EscalationPolicy."""

from datetime import UTC, datetime

import pytest

from app.domain.entities.contact import TrustedContact
from app.domain.entities.inactivity_monitor import InactivityStage
from app.domain.entities.owner import Owner
from app.domain.errors import NoVerifiedContactsError
from app.domain.events import EscalationSkipped
from app.domain.policies.escalation_policy import (
    ChannelKind,
    EscalationPlan,
    EscalationPolicy,
    RecipientKind,
)
from app.domain.value_objects.email_address import EmailAddress
from app.domain.value_objects.phone_number import PhoneNumber


@pytest.fixture
def sample_owner() -> Owner:
    return Owner(
        id="owner-1",
        name="Tanmoy",
        phone=PhoneNumber("+919876543210"),
        email=EmailAddress("tanmoy@example.com"),
    )


@pytest.fixture
def verified_contact() -> TrustedContact:
    return TrustedContact(
        id="contact-1",
        owner_id="owner-1",
        name="Father",
        relation="father",
        phone=PhoneNumber("+919876543211"),
        email=EmailAddress("father@example.com"),
        priority=1,
        consent_verified_at=datetime.now(UTC),
    )


@pytest.fixture
def unverified_contact() -> TrustedContact:
    return TrustedContact(
        id="contact-2",
        owner_id="owner-1",
        name="Mother",
        relation="mother",
        phone=PhoneNumber("+919876543212"),
        email=EmailAddress("mother@example.com"),
        priority=2,
        consent_verified_at=None,
    )


@pytest.fixture
def fixed_now() -> datetime:
    return datetime(2026, 10, 11, 12, 0, 0, tzinfo=UTC)


class TestEscalationPolicy:
    """Tests for recipient resolution and escalation rules."""

    def test_owner_stage_targets_only_owner(
        self,
        sample_owner: Owner,
        verified_contact: TrustedContact,
        fixed_now: datetime,
    ) -> None:
        plan = EscalationPolicy.resolve(
            stage=InactivityStage.WARN_OWNER_1,
            owner=sample_owner,
            contacts=[verified_contact],
            now=fixed_now,
        )
        assert len(plan.recipients) == 2  # owner via SMS and Email
        assert all(r.kind == RecipientKind.OWNER for r in plan.recipients)
        channels = {r.channel for r in plan.recipients}
        assert channels == {ChannelKind.SMS, ChannelKind.EMAIL}

    def test_parent_stage_targets_verified_contacts_and_copies_owner(
        self,
        sample_owner: Owner,
        verified_contact: TrustedContact,
        fixed_now: datetime,
    ) -> None:
        plan = EscalationPolicy.resolve(
            stage=InactivityStage.NOTIFY_PARENTS,
            owner=sample_owner,
            contacts=[verified_contact],
            now=fixed_now,
        )

        contact_recipients = [r for r in plan.recipients if r.kind == RecipientKind.CONTACT]
        owner_recipients = [r for r in plan.recipients if r.kind == RecipientKind.OWNER]

        # Contact gets both SMS and EMAIL
        assert len(contact_recipients) == 2
        assert {r.channel for r in contact_recipients} == {ChannelKind.SMS, ChannelKind.EMAIL}
        assert contact_recipients[0].contact_id == verified_contact.id

        # Owner gets copy
        assert len(owner_recipients) == 2
        assert all(r.is_copy for r in owner_recipients)

    def test_unverified_contacts_are_skipped_and_produce_skip_event(
        self,
        sample_owner: Owner,
        verified_contact: TrustedContact,
        unverified_contact: TrustedContact,
        fixed_now: datetime,
    ) -> None:
        plan: EscalationPlan = EscalationPolicy.resolve(
            stage=InactivityStage.NOTIFY_PARENTS,
            owner=sample_owner,
            contacts=[verified_contact, unverified_contact],
            now=fixed_now,
        )

        # Only verified contact included in recipients
        contact_ids = {r.contact_id for r in plan.recipients if r.contact_id is not None}
        assert contact_ids == {verified_contact.id}

        # Skipped event recorded for unverified contact
        assert len(plan.events) == 1
        event = plan.events[0]
        assert isinstance(event, EscalationSkipped)
        assert event.contact_id == unverified_contact.id
        assert event.reason == "CONSENT_NOT_VERIFIED"

    def test_no_verified_contacts_for_parent_stage_alerts_owner_loudly(
        self,
        sample_owner: Owner,
        unverified_contact: TrustedContact,
        fixed_now: datetime,
    ) -> None:
        """Config failure raises NoVerifiedContactsError when no contacts are verified."""
        with pytest.raises(NoVerifiedContactsError):
            EscalationPolicy.resolve(
                stage=InactivityStage.NOTIFY_PARENTS,
                owner=sample_owner,
                contacts=[unverified_contact],
                now=fixed_now,
            )
