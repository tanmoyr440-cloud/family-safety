"""Resend Email notification channel adapter.

Provider API Documentation:
https://resend.com/docs/api-reference/emails/send-email

Sends transactional email alerts for owner warnings and emergency packet delivery.
Maps Resend API errors to TransientDeliveryError and PermanentDeliveryError.
Masks email addresses in all logging.
"""

import base64
import logging
from typing import Any
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


def _mask_email(email: Any) -> str:
    """Mask email address for safe logging (e.g. user@example.com -> u***@example.com)."""
    email_str = str(email.value) if hasattr(email, "value") else str(email)
    cleaned = email_str.strip()
    if "@" not in cleaned:
        return "****"
    local, domain = cleaned.split("@", 1)
    masked_local = local[0] + "***" if len(local) > 1 else local + "***"
    return f"{masked_local}@{domain}"


class ResendEmailChannel(NotificationChannel):
    """Resend Email adapter implementing the NotificationChannel port."""

    kind: ChannelKind = ChannelKind.EMAIL

    def __init__(
        self,
        api_key: str | None = None,
        from_email: str | None = None,
        allowlist: list[str] | None = None,
        dry_run: bool | None = None,
        http_client: httpx.AsyncClient | None = None,
        renderer: TemplateRenderer | None = None,
    ) -> None:
        raw_key = api_key or settings.resend_api_key
        self._api_key = raw_key.strip().strip("'\"") if raw_key else ""
        if from_email:
            self._from_email = from_email.strip().strip("'\"")
        elif settings.resend_from_email and settings.resend_from_email != "alerts@familysafetynet.app":
            self._from_email = settings.resend_from_email.strip().strip("'\"")
        else:
            self._from_email = "Family Safety Net <onboarding@resend.dev>"
        self._allowlist = (
            set(allowlist) if allowlist is not None else set(settings.notifications_allowlist)
        )
        self._dry_run = dry_run if dry_run is not None else settings.dry_run
        self._client = http_client
        self._renderer = renderer or TemplateRenderer()
        self._timeout = httpx.Timeout(connect=5.0, read=10.0, write=10.0, pool=5.0)

    async def send(self, message: OutboundMessage) -> DeliveryResult:
        """Send an email notification via Resend REST API."""
        masked_to = _mask_email(message.recipient)
        now = datetime.now(UTC)

        # Allowlist check
        if self._allowlist and message.recipient not in self._allowlist:
            logger.info(
                "[RESEND EMAIL] Recipient %s not in NOTIFICATIONS_ALLOWLIST. Skipping send.",
                masked_to,
            )
            return DeliveryResult(
                provider_message_id=f"allowlist-bypassed-{uuid.uuid4()}",
                delivered_at=now,
            )

        # Subject and body rendering
        subject = message.payload.get("subject", "Family Safety Net Alert")
        body_text = self._renderer.render(message.template_id, message.payload)
        html_body = self._renderer.render_html(message.template_id, message.payload)

        # Dry-run check
        if self._dry_run:
            logger.info(
                "[RESEND EMAIL DRY-RUN] Would send to %s from %s: template=%s subject=%s attachments=%d",
                masked_to,
                _mask_email(self._from_email),
                message.template_id,
                subject,
                len(message.attachments),
            )
            return DeliveryResult(
                provider_message_id=f"dry-run-{uuid.uuid4()}",
                delivered_at=now,
            )

        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        json_payload: dict[str, Any] = {
            "from": self._from_email,
            "to": [message.recipient],
            "subject": subject,
            "text": body_text,
        }
        if html_body:
            json_payload["html"] = html_body

        if message.attachments:
            json_payload["attachments"] = [
                {
                    "filename": att.filename,
                    "content": base64.b64encode(att.content).decode("ascii"),
                }
                for att in message.attachments
            ]

        try:
            if self._client is not None:
                resp = await self._client.post(
                    url,
                    headers=headers,
                    json=json_payload,
                    timeout=self._timeout,
                )
            else:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    resp = await client.post(
                        url,
                        headers=headers,
                        json=json_payload,
                    )

            if resp.status_code in (200, 201):
                res_data = resp.json()
                msg_id = str(res_data.get("id", f"resend_{uuid.uuid4()}"))
                logger.info(
                    "[RESEND EMAIL] Successfully sent email to %s (id=%s)",
                    masked_to,
                    msg_id,
                )
                return DeliveryResult(
                    provider_message_id=msg_id,
                    delivered_at=now,
                )

            # Map error responses
            status_code = resp.status_code
            try:
                err_data = resp.json()
                err_msg = err_data.get("message", resp.text)
                err_name = err_data.get("name", "Error")
            except Exception:
                err_msg = resp.text
                err_name = "Error"

            logger.warning(
                "[RESEND EMAIL ERROR] Status %d (%s) for recipient %s: %s",
                status_code,
                err_name,
                masked_to,
                err_msg,
            )

            # 400 Bad Request or 422 Unprocessable (e.g. invalid email syntax, bad parameters)
            if status_code in (400, 422):
                raise PermanentDeliveryError(
                    f"Resend permanent failure ({status_code}, {err_name}): {err_msg}"
                )

            # 401 Unauthorized / 403 Forbidden (invalid API key or unverified domain)
            if status_code in (401, 403):
                raise PermanentDeliveryError(
                    f"Resend auth/forbidden error ({status_code}): {err_msg}"
                )

            # 429 Rate limit or 5xx Server errors
            if status_code == 429 or status_code >= 500:
                raise TransientDeliveryError(f"Resend transient error ({status_code}): {err_msg}")

            raise TransientDeliveryError(f"Resend unexpected response ({status_code}): {err_msg}")

        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            logger.warning(
                "[RESEND EMAIL] Network/timeout error sending to %s: %s",
                masked_to,
                str(exc),
            )
            raise TransientDeliveryError(f"Resend network/timeout error: {exc}") from exc
        except (PermanentDeliveryError, TransientDeliveryError):
            raise
        except Exception as exc:
            logger.error("[RESEND EMAIL] Unexpected error sending to %s: %s", masked_to, str(exc))
            raise TransientDeliveryError(f"Resend unexpected error: {exc}") from exc
