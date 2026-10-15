"""SMTP Email notification channel adapter for Gmail, Google Workspace, and standard SMTP.

Sends transactional email alerts with multipart HTML and plain-text templates.
Maps SMTP authentication and network errors to PermanentDeliveryError and TransientDeliveryError.
Masks email addresses in all logging.
"""

import asyncio
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import smtplib
from email.utils import parseaddr
from typing import Any
import uuid
from datetime import UTC, datetime

from app.application.ports.notification_channel import (
    DeliveryResult,
    EmailAttachment,
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


class SmtpEmailChannel(NotificationChannel):
    """SMTP Email adapter implementing the NotificationChannel port."""

    kind: ChannelKind = ChannelKind.EMAIL

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        username: str | None = None,
        password: str | None = None,
        from_email: str | None = None,
        use_tls: bool | None = None,
        allowlist: list[str] | None = None,
        dry_run: bool | None = None,
        renderer: TemplateRenderer | None = None,
    ) -> None:
        self._host = host or settings.smtp_host
        self._port = port or settings.smtp_port
        self._username = username or settings.smtp_username
        self._password = password or settings.smtp_password
        self._from_email = from_email or settings.smtp_from_email or self._username
        self._use_tls = use_tls if use_tls is not None else settings.smtp_use_tls
        self._allowlist = (
            set(allowlist) if allowlist is not None else set(settings.notifications_allowlist)
        )
        self._dry_run = dry_run if dry_run is not None else settings.dry_run
        self._renderer = renderer or TemplateRenderer()

    def _send_sync(
        self,
        recipient: str,
        subject: str,
        text_body: str,
        html_body: str | None,
        attachments: list[EmailAttachment] | None = None,
    ) -> None:
        """Synchronous SMTP connection and send with multipart MIME attachments."""
        if attachments:
            msg = MIMEMultipart("mixed")
            # Subpart for body text and html
            alt_part = MIMEMultipart("alternative")
            alt_part.attach(MIMEText(text_body, "plain", "utf-8"))
            if html_body:
                alt_part.attach(MIMEText(html_body, "html", "utf-8"))
            msg.attach(alt_part)

            # Attach files
            for att in attachments:
                maintype, _, subtype = att.content_type.partition("/")
                if not subtype:
                    maintype, subtype = "application", "octet-stream"
                part = MIMEBase(maintype, subtype)
                part.set_payload(att.content)
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    f'attachment; filename="{att.filename}"',
                )
                msg.attach(part)
        else:
            msg = MIMEMultipart("alternative")
            msg.attach(MIMEText(text_body, "plain", "utf-8"))
            if html_body:
                msg.attach(MIMEText(html_body, "html", "utf-8"))

        msg["Subject"] = subject
        msg["From"] = self._from_email or "Family Safety Net <alerts@familysafetynet.app>"
        msg["To"] = recipient

        if not self._username or not self._password:
            raise PermanentDeliveryError("SMTP username or password not configured.")

        server: smtplib.SMTP | smtplib.SMTP_SSL | None = None
        try:
            if self._port == 465:
                server = smtplib.SMTP_SSL(self._host, self._port, timeout=6)
            else:
                try:
                    server = smtplib.SMTP(self._host, self._port, timeout=6)
                    if self._use_tls:
                        server.starttls()
                except (TimeoutError, OSError, smtplib.SMTPConnectError) as conn_err:
                    if self._host in ("smtp.gmail.com", "smtp.googlemail.com") or self._port == 587:
                        logger.warning(
                            "SMTP port %s connection timed out or failed (%s). Retrying with port 465 direct SSL...",
                            self._port,
                            conn_err,
                        )
                        server = smtplib.SMTP_SSL(self._host, 465, timeout=6)
                    else:
                        raise

            server.login(self._username, self._password)
            _, parsed_from = parseaddr(self._from_email or self._username)
            envelope_from = parsed_from if parsed_from else (self._from_email or self._username)
            server.sendmail(envelope_from, [recipient], msg.as_string())
            try:
                server.quit()
            except Exception:
                pass
        except smtplib.SMTPAuthenticationError as exc:
            raise PermanentDeliveryError(
                f"SMTP authentication failed: {exc}. If using Gmail, generate and use a 16-character Google App Password (not your personal login password)."
            ) from exc
        except smtplib.SMTPRecipientsRefused as exc:
            raise PermanentDeliveryError(f"Recipient address refused: {exc}") from exc
        except (smtplib.SMTPException, OSError, TimeoutError) as exc:
            raise TransientDeliveryError(f"SMTP delivery error: {exc}") from exc
        finally:
            if server is not None:
                try:
                    server.close()
                except Exception:
                    pass

    async def send(self, message: OutboundMessage) -> DeliveryResult:
        """Send an email notification via SMTP."""
        masked_to = _mask_email(message.recipient)
        now = datetime.now(UTC)

        # Allowlist check
        if self._allowlist and message.recipient not in self._allowlist:
            logger.info(
                "[SMTP EMAIL] Recipient %s not in NOTIFICATIONS_ALLOWLIST. Skipping send.",
                masked_to,
            )
            return DeliveryResult(
                provider_message_id=f"allowlist-bypassed-{uuid.uuid4()}",
                delivered_at=now,
            )

        # Subject and body rendering
        owner_name = message.payload.get("owner_name", "Family Member")
        subject = message.payload.get("subject") or f"Family Safety Net Alert: {owner_name} Emergency Guidance"
        text_body = self._renderer.render(message.template_id, message.payload)
        html_body = self._renderer.render_html(message.template_id, message.payload)

        # Dry-run check
        if self._dry_run:
            logger.info(
                "[SMTP EMAIL DRY-RUN] Would send to %s from %s: template=%s subject=%s attachments=%d",
                masked_to,
                _mask_email(self._from_email or ""),
                message.template_id,
                subject,
                len(message.attachments),
            )
            return DeliveryResult(
                provider_message_id=f"dry-run-{uuid.uuid4()}",
                delivered_at=now,
            )

        await asyncio.to_thread(
            self._send_sync,
            message.recipient,
            subject,
            text_body,
            html_body,
            message.attachments,
        )

        msg_id = f"smtp_{uuid.uuid4()}"
        logger.info(
            "[SMTP EMAIL] Successfully sent email to %s (id=%s, attachments=%d)",
            masked_to,
            msg_id,
            len(message.attachments),
        )
        return DeliveryResult(
            provider_message_id=msg_id,
            delivered_at=now,
        )
