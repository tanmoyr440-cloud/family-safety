"""Notification composer service for building outbox messages with deterministic dedupe keys."""

import uuid
from datetime import datetime
from typing import Any

from app.application.dto import OutboxMessage
from app.domain.policies.escalation_policy import ChannelKind, EscalationRecipient, RecipientKind


class NotificationComposer:
    """Composes outbox messages and deterministic deduplication keys."""

    @staticmethod
    def compose_inactivity_message(
        owner_id: str,
        episode_id: str,
        stage: str,
        recipient: EscalationRecipient,
        now: datetime,
        payload_extra: dict[str, Any] | None = None,
    ) -> OutboxMessage:
        """Compose outbox message for an inactivity stage escalation."""
        contact_part = (
            recipient.contact_id
            if recipient.kind == RecipientKind.CONTACT and recipient.contact_id
            else "owner"
        )
        if recipient.is_copy:
            contact_part = f"owner_copy_{contact_part}"

        # Key format: inactivity:{owner_id}:{episode_id}:{stage}:{contact_id}:{channel}
        dedupe_key = (
            f"inactivity:{owner_id}:{episode_id}:{stage}:{contact_part}:{recipient.channel.value}"
        )

        template_id = f"inactivity_{stage.lower()}_{recipient.channel.value.lower()}"

        payload: dict[str, Any] = {
            "owner_id": owner_id,
            "stage": stage,
            "is_copy": recipient.is_copy,
            **(payload_extra or {}),
        }

        return OutboxMessage(
            id=str(uuid.uuid4()),
            dedupe_key=dedupe_key,
            channel=recipient.channel,
            recipient=recipient.address,
            template_id=template_id,
            payload=payload,
            next_attempt_at=now,
        )

    @staticmethod
    def compose_loan_message(
        loan_id: str,
        year_month: str,
        action_kind: str,
        recipient_address: str,
        channel: ChannelKind,
        now: datetime,
        contact_id: str = "owner",
        payload_extra: dict[str, Any] | None = None,
    ) -> OutboxMessage:
        """Compose outbox message for loan due reminders or escalations."""
        stage_part = action_kind
        if action_kind == "NOTIFY_PARENTS_RESOLVED":
            stage_part = "resolved"
        elif payload_extra and payload_extra.get("days_until_due") is not None:
            stage_part = f"{action_kind}_{payload_extra['days_until_due']}"

        # Key format: loan:{loan_id}:{yyyy-mm}:{stage}:{contact_id}:{channel}
        dedupe_key = f"loan:{loan_id}:{year_month}:{stage_part}:{contact_id}:{channel.value}"

        template_id = f"loan_{action_kind.lower()}_{channel.value.lower()}"

        payload: dict[str, Any] = {
            "loan_id": loan_id,
            "year_month": year_month,
            "action_kind": action_kind,
            **(payload_extra or {}),
        }

        return OutboxMessage(
            id=str(uuid.uuid4()),
            dedupe_key=dedupe_key,
            channel=channel,
            recipient=recipient_address,
            template_id=template_id,
            payload=payload,
            next_attempt_at=now,
        )
