"""Escalation policy deciding recipient resolution and escalation actions."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum

from app.domain.entities.contact import TrustedContact
from app.domain.entities.inactivity_monitor import InactivityStage
from app.domain.entities.owner import Owner
from app.domain.errors import NoVerifiedContactsError
from app.domain.events import EscalationSkipped


class ChannelKind(StrEnum):
    """Notification delivery channel."""

    SMS = "SMS"
    EMAIL = "EMAIL"


class RecipientKind(StrEnum):
    """Kind of recipient being addressed."""

    OWNER = "OWNER"
    CONTACT = "CONTACT"


@dataclass(frozen=True)
class EscalationRecipient:
    """Designated recipient for an escalation message."""

    kind: RecipientKind
    channel: ChannelKind
    address: str
    contact_id: str | None = None
    is_copy: bool = False


@dataclass
class EscalationPlan:
    """Resolved plan of recipients and audit events."""

    recipients: list[EscalationRecipient] = field(default_factory=list)
    events: list[object] = field(default_factory=list)


class EscalationPolicy:
    """Pure domain policy resolving recipients for escalation stages."""

    @classmethod
    def resolve(
        cls,
        stage: InactivityStage,
        owner: Owner,
        contacts: list[TrustedContact],
        now: datetime,
    ) -> EscalationPlan:
        """Resolve recipients for the specified stage.

        - Owner warning stages go to the owner only (SMS + EMAIL).
        - Parent stages go to verified contacts ordered by priority (SMS + EMAIL),
          with the owner receiving a copy.
        - Unverified contacts are skipped and recorded via EscalationSkipped event.
        - If no verified contacts exist for a parent stage, raises NoVerifiedContactsError.
        """
        eval_time = now
        plan = EscalationPlan()

        if stage in (InactivityStage.WARN_OWNER_1, InactivityStage.WARN_OWNER_2):
            plan.recipients.append(
                EscalationRecipient(
                    kind=RecipientKind.OWNER,
                    channel=ChannelKind.SMS,
                    address=str(owner.phone),
                ),
            )
            plan.recipients.append(
                EscalationRecipient(
                    kind=RecipientKind.OWNER,
                    channel=ChannelKind.EMAIL,
                    address=str(owner.email),
                ),
            )
            return plan

        if stage == InactivityStage.NOTIFY_PARENTS:
            verified_contacts: list[TrustedContact] = []

            for contact in contacts:
                if contact.is_verified:
                    verified_contacts.append(contact)
                else:
                    plan.events.append(
                        EscalationSkipped(
                            contact_id=contact.id,
                            owner_id=owner.id,
                            reason="CONSENT_NOT_VERIFIED",
                            occurred_at=eval_time,
                        ),
                    )

            if not verified_contacts:
                raise NoVerifiedContactsError(
                    f"No verified contacts for owner {owner.id} in parent notification stage",
                )

            # Sort verified contacts by priority (1 is highest)
            verified_contacts.sort(key=lambda c: c.priority)

            for contact in verified_contacts:
                plan.recipients.append(
                    EscalationRecipient(
                        kind=RecipientKind.CONTACT,
                        channel=ChannelKind.SMS,
                        address=str(contact.phone),
                        contact_id=contact.id,
                    ),
                )
                plan.recipients.append(
                    EscalationRecipient(
                        kind=RecipientKind.CONTACT,
                        channel=ChannelKind.EMAIL,
                        address=str(contact.email),
                        contact_id=contact.id,
                    ),
                )

            # Owner gets a copy so they know family was contacted
            plan.recipients.append(
                EscalationRecipient(
                    kind=RecipientKind.OWNER,
                    channel=ChannelKind.SMS,
                    address=str(owner.phone),
                    is_copy=True,
                ),
            )
            plan.recipients.append(
                EscalationRecipient(
                    kind=RecipientKind.OWNER,
                    channel=ChannelKind.EMAIL,
                    address=str(owner.email),
                    is_copy=True,
                ),
            )

        return plan
