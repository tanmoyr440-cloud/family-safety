"""Notification channel port protocol and delivery errors."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol

from app.domain.policies.escalation_policy import ChannelKind


class DeliveryError(Exception):
    """Base exception for notification delivery errors."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class TransientDeliveryError(DeliveryError):
    """Transient delivery failure (e.g. timeout, rate limit, provider 5xx) that can be retried."""


class PermanentDeliveryError(DeliveryError):
    """Permanent delivery failure (e.g. invalid phone number, hard bounce).

    Should not be retried.
    """


@dataclass(frozen=True)
class EmailAttachment:
    """Attachment data for email notifications."""

    filename: str
    content: bytes
    content_type: str = "application/octet-stream"


@dataclass(frozen=True)
class DeliveryResult:
    """Result of a successful notification delivery."""

    provider_message_id: str
    delivered_at: datetime


@dataclass(frozen=True)
class OutboundMessage:
    """Outbound message payload passed to a notification channel."""

    id: str
    channel: ChannelKind
    recipient: str
    template_id: str
    payload: dict[str, Any]
    attachments: list[EmailAttachment] = field(default_factory=list)


class NotificationChannel(Protocol):
    """Protocol for external notification channel adapters."""

    kind: ChannelKind

    async def send(self, message: OutboundMessage) -> DeliveryResult:
        """Send a message through the channel, returning DeliveryResult or raising DeliveryError."""
        ...
