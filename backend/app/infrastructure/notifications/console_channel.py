"""Console channel adapter for local development and testing.

Prints outbound notification messages to standard output or structured logger.
"""

import logging
from typing import Any
import uuid
from datetime import UTC, datetime

from app.application.ports.notification_channel import (
    DeliveryResult,
    NotificationChannel,
    OutboundMessage,
)
from app.domain.policies.escalation_policy import ChannelKind

logger = logging.getLogger(__name__)


def _mask_recipient(recipient: Any) -> str:
    """Mask recipient phone or email for safe logging."""
    recipient_str = str(recipient.value) if hasattr(recipient, "value") else str(recipient)
    if "@" in recipient_str:
        parts = recipient_str.split("@", 1)
        name = parts[0]
        masked_name = name[0] + "***" if len(name) > 1 else name + "***"
        return f"{masked_name}@{parts[1]}"
    cleaned = recipient_str.strip()
    if len(cleaned) <= 4:
        return "****"
    return f"{cleaned[:3]}****{cleaned[-4:]}"


class ConsoleChannel(NotificationChannel):
    """Dev and test notification channel that outputs messages to console."""

    def __init__(
        self,
        kind: ChannelKind,
        allowlist: list[str] | None = None,
        dry_run: bool = False,
    ) -> None:
        self.kind = kind
        self._allowlist = set(allowlist) if allowlist else set()
        self._dry_run = dry_run
        self.sent_messages: list[OutboundMessage] = []

    async def send(self, message: OutboundMessage) -> DeliveryResult:
        """Log the outbound message and return a synthetic DeliveryResult."""
        masked_rec = _mask_recipient(message.recipient)
        now = datetime.now(UTC)

        # Allowlist check
        if self._allowlist and message.recipient not in self._allowlist:
            logger.info(
                "[CONSOLE CHANNEL] Skipped send - recipient %s not in allowlist",
                masked_rec,
            )
            return DeliveryResult(
                provider_message_id=f"allowlist-bypassed-{uuid.uuid4()}",
                delivered_at=now,
            )

        if self._dry_run:
            logger.info(
                "[CONSOLE CHANNEL DRY-RUN] Channel=%s Recipient=%s Template=%s Payload=%s",
                self.kind.value,
                masked_rec,
                message.template_id,
                message.payload,
            )
            return DeliveryResult(
                provider_message_id=f"dry-run-{uuid.uuid4()}",
                delivered_at=now,
            )

        att_summary = (
            f" Attachments=[{', '.join(f'{a.filename} ({len(a.content)}B)' for a in message.attachments)}]"
            if message.attachments
            else ""
        )
        logger.info(
            "[CONSOLE CHANNEL SENT] Channel=%s Recipient=%s Template=%s Payload=%s%s",
            self.kind.value,
            masked_rec,
            message.template_id,
            message.payload,
            att_summary,
        )
        self.sent_messages.append(message)
        return DeliveryResult(
            provider_message_id=f"console-{uuid.uuid4()}",
            delivered_at=now,
        )
