import logging
from datetime import timedelta
from typing import Any

from app.application.ports.clock import Clock
from app.application.ports.notification_channel import (
    EmailAttachment,
    NotificationChannel,
    OutboundMessage,
    PermanentDeliveryError,
    TransientDeliveryError,
)
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.policies.escalation_policy import ChannelKind

logger = logging.getLogger(__name__)

# Backoff schedule: 1m, 5m, 30m, 2h, 12h
_BACKOFF_SECONDS = [60, 300, 1800, 7200, 43200]
_MAX_ATTEMPTS = 6


class DispatchOutbox:
    """Dispatches pending outbox messages to notification channels.

    Tracks backoff schedules and retry counts.
    """

    def __init__(
        self,
        uow: UnitOfWork,
        clock: Clock,
        channels: list[NotificationChannel],
        document_store: Any | None = None,
        session_factory: Any | None = None,
    ) -> None:
        self._uow = uow
        self._clock = clock
        self._channels = {ch.kind: ch for ch in channels}
        self._document_store = document_store
        self._session_factory = session_factory

    async def _load_attachments(self, owner_id: str) -> list[EmailAttachment]:
        """Load and decrypt available documents for owner."""
        if not self._document_store or not self._session_factory:
            return []

        from sqlalchemy import select
        from app.infrastructure.persistence.models import DocumentModel

        attachments: list[EmailAttachment] = []
        try:
            async with self._session_factory() as session:
                stmt = (
                    select(DocumentModel)
                    .where(DocumentModel.owner_id == owner_id)
                    .order_by(DocumentModel.created_at.desc())
                )
                docs = (await session.execute(stmt)).scalars().all()

            for d in docs:
                try:
                    content = self._document_store.read_decrypted(d.storage_path, d.sha256_hash)
                    attachments.append(
                        EmailAttachment(
                            filename=d.filename,
                            content=content,
                            content_type=d.content_type or "application/octet-stream",
                        )
                    )
                except Exception as err:
                    logger.warning("Failed to decrypt document %s: %s", d.id, err)
        except Exception as exc:
            logger.warning("Error fetching documents for owner %s: %s", owner_id, exc)

        return attachments

    async def execute(self, limit: int = 50) -> int:
        """Process and send due messages from the transactional outbox."""
        now = self._clock.now()
        dispatched_count = 0

        async with self._uow:
            pending_messages = await self._uow.outbox.get_pending(now=now, limit=limit)

            for msg in pending_messages:
                channel = self._channels.get(msg.channel)
                if channel is None:
                    msg.last_error = f"No channel configured for {msg.channel}"
                    msg.status = "DEAD"
                    await self._uow.outbox.update(msg)
                    continue

                attachments: list[EmailAttachment] = []
                if (
                    msg.channel == ChannelKind.EMAIL
                    and ("notify_parents" in msg.template_id or msg.payload.get("include_documents"))
                ):
                    owner_id = msg.payload.get("owner_id")
                    if owner_id:
                        attachments = await self._load_attachments(owner_id)

                outbound = OutboundMessage(
                    id=msg.id,
                    channel=msg.channel,
                    recipient=msg.recipient,
                    template_id=msg.template_id,
                    payload=msg.payload,
                    attachments=attachments,
                )

                try:
                    result = await channel.send(outbound)
                    msg.status = "SENT"
                    msg.sent_at = result.delivered_at
                    msg.attempts += 1
                    dispatched_count += 1
                except PermanentDeliveryError as err:
                    msg.status = "DEAD"
                    msg.last_error = str(err)
                    msg.attempts += 1
                except TransientDeliveryError as err:
                    msg.attempts += 1
                    msg.last_error = str(err)
                    if msg.attempts >= _MAX_ATTEMPTS:
                        msg.status = "DEAD"
                    else:
                        delay_idx = min(msg.attempts - 1, len(_BACKOFF_SECONDS) - 1)
                        delay = _BACKOFF_SECONDS[delay_idx]
                        msg.next_attempt_at = now + timedelta(seconds=delay)
                        msg.status = "PENDING"
                except Exception as err:
                    # Treat unexpected errors as transient
                    msg.attempts += 1
                    msg.last_error = str(err)
                    if msg.attempts >= _MAX_ATTEMPTS:
                        msg.status = "DEAD"
                    else:
                        msg.next_attempt_at = now + timedelta(seconds=60)
                        msg.status = "PENDING"

                await self._uow.outbox.update(msg)

            await self._uow.commit()

        return dispatched_count
