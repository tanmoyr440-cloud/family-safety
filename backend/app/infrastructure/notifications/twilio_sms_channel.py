"""Twilio SMS notification channel adapter.

Provider API Documentation:
https://www.twilio.com/docs/messaging/api/message-resource

Sends SMS alerts for owner reminders and parent notifications.
Maps Twilio API errors to TransientDeliveryError and PermanentDeliveryError.
Masks phone numbers in all logging.
"""

import logging
import uuid
from datetime import UTC, datetime

import httpx

from app.application.ports.notification_channel import (
    DeliveryResult,
    NotificationChannel,
    OutboundMessage,
    PermanentDeliveryError,
    TransientDeliveryError,
)
from app.config import settings
from app.domain.policies.escalation_policy import ChannelKind
from app.infrastructure.notifications.template_renderer import TemplateRenderer

logger = logging.getLogger(__name__)


def _mask_phone(phone: str) -> str:
    """Mask phone number for safe logging (e.g. +919876543210 -> +91****3210)."""
    cleaned = phone.strip()
    if len(cleaned) <= 4:
        return "****"
    return f"{cleaned[:3]}****{cleaned[-4:]}"


class TwilioSmsChannel(NotificationChannel):
    """Twilio SMS adapter implementing the NotificationChannel port."""

    kind: ChannelKind = ChannelKind.SMS

    def __init__(
        self,
        account_sid: str | None = None,
        auth_token: str | None = None,
        from_number: str | None = None,
        allowlist: list[str] | None = None,
        dry_run: bool | None = None,
        http_client: httpx.AsyncClient | None = None,
        renderer: TemplateRenderer | None = None,
    ) -> None:
        self._account_sid = account_sid or settings.twilio_account_sid
        self._auth_token = auth_token or settings.twilio_auth_token
        self._from_number = from_number or settings.twilio_from_number
        self._allowlist = (
            set(allowlist) if allowlist is not None else set(settings.notifications_allowlist)
        )
        self._dry_run = dry_run if dry_run is not None else settings.dry_run
        self._client = http_client
        self._renderer = renderer or TemplateRenderer()
        self._timeout = httpx.Timeout(connect=5.0, read=10.0, write=10.0, pool=5.0)

    async def send(self, message: OutboundMessage) -> DeliveryResult:
        """Send an SMS notification via Twilio Messages API."""
        masked_to = _mask_phone(message.recipient)
        now = datetime.now(UTC)

        # Allowlist check
        if self._allowlist and message.recipient not in self._allowlist:
            logger.info(
                "[TWILIO SMS] Recipient %s not in NOTIFICATIONS_ALLOWLIST. Skipping send.",
                masked_to,
            )
            return DeliveryResult(
                provider_message_id=f"allowlist-bypassed-{uuid.uuid4()}",
                delivered_at=now,
            )

        # Render message body
        body = self._renderer.render(message.template_id, message.payload)

        # Dry-run check
        if self._dry_run:
            logger.info(
                "[TWILIO SMS DRY-RUN] Would send to %s from %s: template=%s",
                masked_to,
                _mask_phone(self._from_number),
                message.template_id,
            )
            return DeliveryResult(
                provider_message_id=f"dry-run-{uuid.uuid4()}",
                delivered_at=now,
            )

        url = f"https://api.twilio.com/2010-04-01/Accounts/{self._account_sid}/Messages.json"
        data = {
            "To": message.recipient,
            "From": self._from_number,
            "Body": body,
        }

        try:
            if self._client is not None:
                resp = await self._client.post(
                    url,
                    data=data,
                    auth=(self._account_sid, self._auth_token),
                    timeout=self._timeout,
                )
            else:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    resp = await client.post(
                        url,
                        data=data,
                        auth=(self._account_sid, self._auth_token),
                    )

            if resp.status_code in (200, 201):
                payload = resp.json()
                sid = str(payload.get("sid", f"SM_{uuid.uuid4()}"))
                logger.info("[TWILIO SMS] Successfully sent message to %s (sid=%s)", masked_to, sid)
                return DeliveryResult(
                    provider_message_id=sid,
                    delivered_at=now,
                )

            # Map error responses
            status_code = resp.status_code
            try:
                err_body = resp.json()
                err_msg = err_body.get("message", resp.text)
                err_code = err_body.get("code")
            except Exception:
                err_msg = resp.text
                err_code = None

            logger.warning(
                "[TWILIO SMS ERROR] Status %d (code=%s) for recipient %s: %s",
                status_code,
                err_code,
                masked_to,
                err_msg,
            )

            # 400 Bad Request (invalid phone numbers, unsubscribed, unrouteable)
            if status_code in (400, 404):
                raise PermanentDeliveryError(
                    f"Twilio permanent failure ({status_code}, code={err_code}): {err_msg}"
                )

            # 401 Unauthorized / 403 Forbidden (credentials or account suspended)
            if status_code in (401, 403):
                raise PermanentDeliveryError(
                    f"Twilio authentication/authorization error ({status_code}): {err_msg}"
                )

            # 429 Too Many Requests or 5xx Server Errors
            if status_code == 429 or status_code >= 500:
                raise TransientDeliveryError(f"Twilio transient error ({status_code}): {err_msg}")

            raise TransientDeliveryError(f"Twilio unexpected response ({status_code}): {err_msg}")

        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            logger.warning(
                "[TWILIO SMS] Network/timeout error sending to %s: %s",
                masked_to,
                str(exc),
            )
            raise TransientDeliveryError(f"Twilio network/timeout error: {exc}") from exc
        except (PermanentDeliveryError, TransientDeliveryError):
            raise
        except Exception as exc:
            logger.error("[TWILIO SMS] Unexpected error sending to %s: %s", masked_to, str(exc))
            raise TransientDeliveryError(f"Twilio unexpected error: {exc}") from exc
