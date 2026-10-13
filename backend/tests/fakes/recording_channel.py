"""Recording notification channel test double."""

import uuid
from datetime import UTC, datetime

from app.application.ports.notification_channel import (
    DeliveryResult,
    OutboundMessage,
    PermanentDeliveryError,
    TransientDeliveryError,
)
from app.domain.policies.escalation_policy import ChannelKind


class RecordingChannel:
    """NotificationChannel test double.

    Records sent messages and simulates delivery failures.
    """

    def __init__(self, kind: ChannelKind) -> None:
        self.kind = kind
        self.sent_messages: list[OutboundMessage] = []
        self.fail_transient: bool = False
        self.fail_permanent: bool = False

    async def send(self, message: OutboundMessage) -> DeliveryResult:
        """Send message or raise configured error."""
        if self.fail_permanent:
            raise PermanentDeliveryError("Permanent failure: recipient number or address invalid")
        if self.fail_transient:
            raise TransientDeliveryError("Transient failure: gateway timeout or 5xx")

        self.sent_messages.append(message)
        return DeliveryResult(
            provider_message_id=f"prov-{uuid.uuid4()}",
            delivered_at=datetime.now(UTC),
        )

    def clear(self) -> None:
        """Clear recorded messages."""
        self.sent_messages.clear()
