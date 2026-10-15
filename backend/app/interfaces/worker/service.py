"""Worker service executing evaluation jobs and outbox dispatch."""

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.application.ports.clock import Clock
from app.application.ports.notification_channel import (
    DeliveryResult,
    NotificationChannel,
    OutboundMessage,
    PermanentDeliveryError,
    TransientDeliveryError,
)
from app.application.use_cases.dispatch_outbox import DispatchOutbox
from app.application.use_cases.evaluate_inactivity import EvaluateInactivity
from app.application.use_cases.evaluate_loan_obligations import EvaluateLoanObligations
from app.config import settings
from app.domain.policies.escalation_policy import ChannelKind
from app.infrastructure.notifications.console_channel import ConsoleChannel
from app.infrastructure.notifications.resend_email_channel import ResendEmailChannel
from app.infrastructure.notifications.smtp_email_channel import SmtpEmailChannel
from app.infrastructure.notifications.twilio_sms_channel import TwilioSmsChannel
from app.infrastructure.persistence.models import OwnerModel
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from app.interfaces.worker.heartbeat import record_heartbeat

logger = logging.getLogger(__name__)


class FixedClock(Clock):
    """Clock returning a fixed datetime instant."""

    def __init__(self, now_dt: datetime) -> None:
        self._now = now_dt

    def now(self) -> datetime:
        return self._now


class SystemClock(Clock):
    """System clock returning current UTC time."""

    def now(self) -> datetime:
        return datetime.now(UTC)


class CompositeFallbackEmailChannel(NotificationChannel):
    """Composite email channel that tries primary channel and falls back to secondary channels on failure."""

    kind: ChannelKind = ChannelKind.EMAIL

    def __init__(self, channels: list[NotificationChannel]) -> None:
        self._channels = [c for c in channels if c.kind == ChannelKind.EMAIL]

    async def send(self, message: OutboundMessage) -> DeliveryResult:
        if not self._channels:
            raise PermanentDeliveryError("No email delivery channels configured.")

        last_exc: Exception | None = None
        for i, channel in enumerate(self._channels):
            try:
                return await channel.send(message)
            except Exception as exc:
                last_exc = exc
                next_channel = (
                    self._channels[i + 1].__class__.__name__
                    if i + 1 < len(self._channels)
                    else None
                )
                logger.warning(
                    "Email channel %s failed for %s: %s. %s",
                    channel.__class__.__name__,
                    message.recipient,
                    exc,
                    f"Retrying via {next_channel}..." if next_channel else "No more fallback channels.",
                )
        if last_exc:
            raise last_exc
        raise TransientDeliveryError("All email channels failed to deliver.")


def create_default_channels(
    dry_run: bool = False,
    allowlist: list[str] | None = None,
) -> list[NotificationChannel]:
    """Instantiate channels configured from application settings."""
    resolved_allowlist = allowlist if allowlist is not None else settings.notifications_allowlist
    resolved_dry_run = dry_run or settings.dry_run

    channels: list[NotificationChannel] = []

    # SMS channel: Twilio if real credentials configured, else Console
    if settings.twilio_account_sid and not settings.twilio_account_sid.startswith("AC_mock"):
        channels.append(
            TwilioSmsChannel(
                allowlist=resolved_allowlist,
                dry_run=resolved_dry_run,
            )
        )
    else:
        channels.append(
            ConsoleChannel(
                kind=ChannelKind.SMS,
                allowlist=resolved_allowlist,
                dry_run=resolved_dry_run,
            )
        )

    # Collect available email channels
    email_channels: list[NotificationChannel] = []

    # Priority 1: Resend Email (REST API over HTTPS 443 - never blocked by cloud firewalls like Render)
    if settings.resend_api_key and not settings.resend_api_key.startswith("re_mock"):
        email_channels.append(
            ResendEmailChannel(
                allowlist=resolved_allowlist,
                dry_run=resolved_dry_run,
            )
        )

    # Priority 2: SMTP Email (e.g. Gmail - note that Render free tier blocks outbound SMTP ports 25, 465, 587)
    if settings.smtp_enabled or bool(settings.smtp_username and settings.smtp_password):
        email_channels.append(
            SmtpEmailChannel(
                allowlist=resolved_allowlist,
                dry_run=resolved_dry_run,
            )
        )

    if not email_channels:
        email_channels.append(
            ConsoleChannel(
                kind=ChannelKind.EMAIL,
                allowlist=resolved_allowlist,
                dry_run=resolved_dry_run,
            )
        )

    if len(email_channels) == 1:
        channels.append(email_channels[0])
    else:
        channels.append(CompositeFallbackEmailChannel(email_channels))

    return channels


class WorkerService:
    """Executes scheduled evaluation jobs and dispatches outbox messages."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        channels: list[NotificationChannel] | None = None,
        clock: Clock | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._channels = channels or create_default_channels()
        self._clock = clock or SystemClock()

    async def _get_all_owner_ids(self) -> list[str]:
        """Fetch all registered owner IDs."""
        async with self._session_factory() as session:
            stmt = select(OwnerModel.id)
            return list((await session.execute(stmt)).scalars().all())

    async def evaluate_inactivity(
        self,
        as_of: datetime | None = None,
        dry_run: bool = False,
    ) -> int:
        """Run EvaluateInactivity for every registered owner."""
        eval_clock = FixedClock(as_of) if as_of else self._clock
        owner_ids = await self._get_all_owner_ids()
        success_count = 0
        error_count = 0

        logger.info(
            "Starting inactivity evaluation for %d owners (as_of=%s, dry_run=%s)",
            len(owner_ids),
            eval_clock.now().isoformat(),
            dry_run,
        )

        for oid in owner_ids:
            try:
                uow = SqlAlchemyUnitOfWork(self._session_factory)
                use_case = EvaluateInactivity(uow=uow, clock=eval_clock)
                await use_case.execute(owner_id=oid)
                success_count += 1
            except Exception as exc:
                error_count += 1
                logger.error(
                    "Error evaluating inactivity for owner %s: %s",
                    oid,
                    exc,
                    exc_info=True,
                )

        # Record heartbeat
        await record_heartbeat(
            session_factory=self._session_factory,
            job_name="inactivity_evaluation",
            success=(error_count == 0),
            error_message=f"{error_count} owners failed" if error_count > 0 else None,
        )

        logger.info(
            "Inactivity evaluation finished: %d succeeded, %d failed",
            success_count,
            error_count,
        )
        return success_count

    async def evaluate_loans(
        self,
        as_of: datetime | None = None,
        dry_run: bool = False,
    ) -> int:
        """Run EvaluateLoanObligations for every registered owner."""
        eval_clock = FixedClock(as_of) if as_of else self._clock
        owner_ids = await self._get_all_owner_ids()
        success_count = 0
        error_count = 0

        logger.info(
            "Starting loan obligations evaluation for %d owners (as_of=%s, dry_run=%s)",
            len(owner_ids),
            eval_clock.now().isoformat(),
            dry_run,
        )

        for oid in owner_ids:
            try:
                uow = SqlAlchemyUnitOfWork(self._session_factory)
                async with uow:
                    owner_loans = await uow.loans.get_loans_for_owner(oid)

                for loan in owner_loans:
                    loan_uow = SqlAlchemyUnitOfWork(self._session_factory)
                    use_case = EvaluateLoanObligations(uow=loan_uow, clock=eval_clock)
                    await use_case.execute(loan.id)
                success_count += 1
            except Exception as exc:
                error_count += 1
                logger.error("Error evaluating loans for owner %s: %s", oid, exc, exc_info=True)

        # Record heartbeat
        await record_heartbeat(
            session_factory=self._session_factory,
            job_name="loan_evaluation",
            success=(error_count == 0),
            error_message=f"{error_count} owners failed" if error_count > 0 else None,
        )

        logger.info(
            "Loan obligations evaluation finished: %d succeeded, %d failed",
            success_count,
            error_count,
        )
        return success_count

    async def dispatch_outbox(
        self,
        as_of: datetime | None = None,
        dry_run: bool = False,
        limit: int = 50,
    ) -> int:
        """Claim and dispatch due messages from transactional outbox."""
        uow = SqlAlchemyUnitOfWork(self._session_factory)
        channels = self._channels
        if dry_run:
            channels = create_default_channels(dry_run=True)

        from app.infrastructure.storage.encrypted_document_store import EncryptedDocumentStore

        eval_clock = FixedClock(as_of) if as_of else self._clock
        dispatcher = DispatchOutbox(
            uow=uow,
            clock=eval_clock,
            channels=channels,
            document_store=EncryptedDocumentStore(),
            session_factory=self._session_factory,
        )
        try:
            count = await dispatcher.execute(limit=limit)
            await record_heartbeat(
                session_factory=self._session_factory,
                job_name="outbox_dispatch",
                success=True,
            )
            logger.info("Outbox dispatch completed: %d messages sent", count)
            return count
        except Exception as exc:
            logger.error("Outbox dispatch failed: %s", exc, exc_info=True)
            await record_heartbeat(
                session_factory=self._session_factory,
                job_name="outbox_dispatch",
                success=False,
                error_message=str(exc),
            )
            raise

    async def run_evaluation_cycle(
        self,
        as_of: datetime | None = None,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        """Execute complete evaluation cycle: inactivity, loans, and outbox dispatch."""
        inactivity_count = await self.evaluate_inactivity(as_of=as_of, dry_run=dry_run)
        loans_count = await self.evaluate_loans(as_of=as_of, dry_run=dry_run)
        dispatched_count = await self.dispatch_outbox(as_of=as_of, dry_run=dry_run)
        return {
            "inactivity_evaluated": inactivity_count,
            "loans_evaluated": loans_count,
            "messages_dispatched": dispatched_count,
        }
