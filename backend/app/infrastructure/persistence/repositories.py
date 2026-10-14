"""SQLAlchemy repository implementations mapping between ORM rows and domain entities."""

from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession


def _ensure_utc(dt: datetime | None) -> datetime | None:
    """Ensure datetime is timezone-aware UTC for database compatibility."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)

from app.application.dto import OutboxMessage
from app.application.ports.repositories import (
    BankAccountRepository,
    ContactRepository,
    InactivityMonitorRepository,
    InstallmentRepository,
    LoanRepository,
    MutualFundHoldingRepository,
    OutboxRepository,
    OwnerRepository,
)
from app.domain.entities.bank_account import BankAccount
from app.domain.entities.contact import TrustedContact
from app.domain.entities.inactivity_monitor import (
    InactivityConfig,
    InactivityMonitor,
    InactivityStage,
)
from app.domain.entities.loan import Installment, InstallmentStatus, Loan
from app.domain.entities.mutual_fund_holding import MutualFundHolding
from app.domain.entities.owner import Owner
from app.domain.policies.escalation_policy import ChannelKind
from app.domain.value_objects.due_day import DueDay
from app.domain.value_objects.email_address import EmailAddress
from app.domain.value_objects.money import Money
from app.domain.value_objects.phone_number import PhoneNumber
from app.infrastructure.persistence.models import (
    BankAccountModel,
    ContactModel,
    InactivityMonitorModel,
    InstallmentModel,
    LoanModel,
    MutualFundHoldingModel,
    OutboxModel,
    OwnerModel,
)


class SqlAlchemyOwnerRepository(OwnerRepository):
    """SQLAlchemy implementation of OwnerRepository."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, owner_id: str) -> Owner | None:
        stmt = select(OwnerModel).where(OwnerModel.id == owner_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return Owner(
            id=model.id,
            name=model.name,
            phone=PhoneNumber(model.phone),
            email=EmailAddress(model.email),
            timezone=model.timezone,
            monitoring_paused_until=_ensure_utc(model.monitoring_paused_until),
        )

    async def save(self, owner: Owner) -> None:
        model = await self._session.get(OwnerModel, owner.id)
        if model is None:
            model = OwnerModel(
                id=owner.id,
                name=owner.name,
                phone=str(owner.phone),
                email=str(owner.email),
                timezone=owner.timezone,
                monitoring_paused_until=owner.monitoring_paused_until,
            )
            self._session.add(model)
        else:
            model.name = owner.name
            model.phone = str(owner.phone)
            model.email = str(owner.email)
            model.timezone = owner.timezone
            model.monitoring_paused_until = owner.monitoring_paused_until


class SqlAlchemyContactRepository(ContactRepository):
    """SQLAlchemy implementation of ContactRepository."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_contacts_for_owner(self, owner_id: str) -> list[TrustedContact]:
        stmt = (
            select(ContactModel)
            .where(ContactModel.owner_id == owner_id)
            .order_by(ContactModel.priority.asc())
        )
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [
            TrustedContact(
                id=m.id,
                owner_id=m.owner_id,
                name=m.name,
                relation=m.relation,
                phone=PhoneNumber(m.phone),
                email=EmailAddress(m.email),
                priority=m.priority,
                locale=m.locale,
                consent_verified_at=_ensure_utc(m.consent_verified_at),
            )
            for m in models
        ]

    async def get_by_id(self, contact_id: str) -> TrustedContact | None:
        model = await self._session.get(ContactModel, contact_id)
        if model is None:
            return None
        return TrustedContact(
            id=model.id,
            owner_id=model.owner_id,
            name=model.name,
            relation=model.relation,
            phone=PhoneNumber(model.phone),
            email=EmailAddress(model.email),
            priority=model.priority,
            locale=model.locale,
            consent_verified_at=_ensure_utc(model.consent_verified_at),
        )

    async def save(self, contact: TrustedContact) -> None:
        model = await self._session.get(ContactModel, contact.id)
        if model is None:
            model = ContactModel(
                id=contact.id,
                owner_id=contact.owner_id,
                name=contact.name,
                relation=contact.relation,
                phone=str(contact.phone),
                email=str(contact.email),
                priority=contact.priority,
                locale=contact.locale,
                consent_verified_at=contact.consent_verified_at,
            )
            self._session.add(model)
        else:
            model.name = contact.name
            model.relation = contact.relation
            model.phone = str(contact.phone)
            model.email = str(contact.email)
            model.priority = contact.priority
            model.locale = contact.locale
            model.consent_verified_at=contact.consent_verified_at

    async def delete(self, contact_id: str) -> None:
        stmt = delete(ContactModel).where(ContactModel.id == contact_id)
        await self._session.execute(stmt)


class SqlAlchemyInactivityMonitorRepository(InactivityMonitorRepository):
    """SQLAlchemy implementation of InactivityMonitorRepository."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_for_owner(self, owner_id: str) -> InactivityMonitor | None:
        stmt = select(InactivityMonitorModel).where(InactivityMonitorModel.owner_id == owner_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return InactivityMonitor(
            owner_id=model.owner_id,
            started_at=_ensure_utc(model.started_at) or datetime.now(UTC),
            last_activity_at=_ensure_utc(model.last_activity_at) or datetime.now(UTC),
            config=InactivityConfig(
                threshold_days=model.threshold_days,
                warning_days=tuple(model.warning_days),
            ),
            status=InactivityStage(model.status),
            episode_id=model.episode_id,
            paused_until=_ensure_utc(model.paused_until),
        )

    async def save(self, monitor: InactivityMonitor) -> None:
        stmt = select(InactivityMonitorModel).where(
            InactivityMonitorModel.owner_id == monitor.owner_id
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            model = InactivityMonitorModel(
                owner_id=monitor.owner_id,
                started_at=monitor.started_at,
                last_activity_at=monitor.last_activity_at,
                threshold_days=monitor.config.threshold_days,
                warning_days=list(monitor.config.warning_days),
                status=monitor.status.value,
                episode_id=monitor.episode_id,
                paused_until=monitor.paused_until,
            )
            self._session.add(model)
        else:
            model.started_at = monitor.started_at
            model.last_activity_at = monitor.last_activity_at
            model.threshold_days = monitor.config.threshold_days
            model.warning_days = list(monitor.config.warning_days)
            model.status = monitor.status.value
            model.episode_id = monitor.episode_id
            model.paused_until = monitor.paused_until


class SqlAlchemyLoanRepository(LoanRepository):
    """SQLAlchemy implementation of LoanRepository."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_loans_for_owner(self, owner_id: str) -> list[Loan]:
        stmt = select(LoanModel).where(LoanModel.owner_id == owner_id)
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [
            Loan(
                id=m.id,
                owner_id=m.owner_id,
                lender=m.lender,
                account_masked=m.account_masked,
                emi=Money(m.emi_paise),
                due_day=DueDay(m.due_day),
                grace_days=m.grace_days,
                first_installment_month=m.first_installment_month,
                last_installment_month=m.last_installment_month,
                reminder_days_before=tuple(m.reminder_days_before),
                parent_repeat_every_days=m.parent_repeat_every_days,
            )
            for m in models
        ]

    async def get_by_id(self, loan_id: str) -> Loan | None:
        model = await self._session.get(LoanModel, loan_id)
        if model is None:
            return None
        return Loan(
            id=model.id,
            owner_id=model.owner_id,
            lender=model.lender,
            account_masked=model.account_masked,
            emi=Money(model.emi_paise),
            due_day=DueDay(model.due_day),
            grace_days=model.grace_days,
            first_installment_month=model.first_installment_month,
            last_installment_month=model.last_installment_month,
            reminder_days_before=tuple(model.reminder_days_before),
            parent_repeat_every_days=model.parent_repeat_every_days,
        )

    async def save(self, loan: Loan) -> None:
        model = await self._session.get(LoanModel, loan.id)
        if model is None:
            model = LoanModel(
                id=loan.id,
                owner_id=loan.owner_id,
                lender=loan.lender,
                account_masked=loan.account_masked,
                emi_paise=loan.emi.paise,
                due_day=loan.due_day.value,
                grace_days=loan.grace_days,
                first_installment_month=loan.first_installment_month,
                last_installment_month=loan.last_installment_month,
                reminder_days_before=list(loan.reminder_days_before),
                parent_repeat_every_days=loan.parent_repeat_every_days,
            )
            self._session.add(model)
        else:
            model.lender = loan.lender
            model.account_masked = loan.account_masked
            model.emi_paise = loan.emi.paise
            model.due_day = loan.due_day.value
            model.grace_days = loan.grace_days
            model.first_installment_month = loan.first_installment_month
            model.last_installment_month = loan.last_installment_month
            model.reminder_days_before = list(loan.reminder_days_before)
            model.parent_repeat_every_days = loan.parent_repeat_every_days


class SqlAlchemyInstallmentRepository(InstallmentRepository):
    """SQLAlchemy implementation of InstallmentRepository."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_installments(self, loan_id: str) -> list[Installment]:
        stmt = (
            select(InstallmentModel)
            .where(InstallmentModel.loan_id == loan_id)
            .order_by(InstallmentModel.year_month.asc())
        )
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [
            Installment(
                loan_id=m.loan_id,
                year_month=m.year_month,
                due_date=m.due_date,
                amount=Money(m.amount_paise),
                status=InstallmentStatus(m.status),
                paid_at=m.paid_at,
                parent_notified=m.parent_notified,
                resolved_notified=m.resolved_notified,
            )
            for m in models
        ]

    async def get_by_year_month(self, loan_id: str, year_month: str) -> Installment | None:
        stmt = select(InstallmentModel).where(
            InstallmentModel.loan_id == loan_id,
            InstallmentModel.year_month == year_month,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return Installment(
            loan_id=model.loan_id,
            year_month=model.year_month,
            due_date=model.due_date,
            amount=Money(model.amount_paise),
            status=InstallmentStatus(model.status),
            paid_at=model.paid_at,
            parent_notified=model.parent_notified,
            resolved_notified=model.resolved_notified,
        )

    async def save(self, installment: Installment) -> None:
        stmt = select(InstallmentModel).where(
            InstallmentModel.loan_id == installment.loan_id,
            InstallmentModel.year_month == installment.year_month,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            model = InstallmentModel(
                loan_id=installment.loan_id,
                year_month=installment.year_month,
                due_date=installment.due_date,
                amount_paise=installment.amount.paise,
                status=installment.status.value,
                paid_at=installment.paid_at,
                parent_notified=installment.parent_notified,
                resolved_notified=installment.resolved_notified,
            )
            self._session.add(model)
        else:
            model.due_date = installment.due_date
            model.amount_paise = installment.amount.paise
            model.status = installment.status.value
            model.paid_at = installment.paid_at
            model.parent_notified = installment.parent_notified
            model.resolved_notified = installment.resolved_notified


class SqlAlchemyOutboxRepository(OutboxRepository):
    """SQLAlchemy implementation of OutboxRepository with SKIP LOCKED support."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def enqueue(self, message: OutboxMessage) -> bool:
        """Enqueue message atomically using ON CONFLICT (dedupe_key) DO NOTHING."""
        stmt = (
            insert(OutboxModel)
            .values(
                id=message.id,
                dedupe_key=message.dedupe_key,
                channel=message.channel.value,
                recipient=message.recipient,
                template_id=message.template_id,
                payload=message.payload,
                next_attempt_at=message.next_attempt_at,
                status=message.status,
                attempts=message.attempts,
                last_error=message.last_error,
                sent_at=message.sent_at,
            )
            .on_conflict_do_nothing(index_elements=["dedupe_key"])
            .returning(OutboxModel.id)
        )
        result = await self._session.execute(stmt)
        row = result.scalar_one_or_none()
        return row is not None

    async def get_pending(self, now: datetime, limit: int = 50) -> list[OutboxMessage]:
        """Fetch pending messages using SELECT FOR UPDATE SKIP LOCKED."""
        stmt = (
            select(OutboxModel)
            .where(
                OutboxModel.status == "PENDING",
                OutboxModel.next_attempt_at <= now,
            )
            .order_by(OutboxModel.next_attempt_at.asc())
            .with_for_update(skip_locked=True)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [
            OutboxMessage(
                id=m.id,
                dedupe_key=m.dedupe_key,
                channel=ChannelKind(m.channel),
                recipient=m.recipient,
                template_id=m.template_id,
                payload=m.payload,
                next_attempt_at=m.next_attempt_at,
                status=m.status,
                attempts=m.attempts,
                last_error=m.last_error,
                sent_at=m.sent_at,
            )
            for m in models
        ]

    async def update(self, message: OutboxMessage) -> None:
        model = await self._session.get(OutboxModel, message.id)
        if model is not None:
            model.status = message.status
            model.attempts = message.attempts
            model.last_error = message.last_error
            model.next_attempt_at = message.next_attempt_at
            model.sent_at = message.sent_at


class SqlAlchemyMutualFundHoldingRepository(MutualFundHoldingRepository):
    """SQLAlchemy implementation of MutualFundHoldingRepository."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_holdings_for_owner(self, owner_id: str) -> list[MutualFundHolding]:
        stmt = (
            select(MutualFundHoldingModel)
            .where(MutualFundHoldingModel.owner_id == owner_id)
            .order_by(MutualFundHoldingModel.created_at.desc())
        )
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [
            MutualFundHolding(
                id=m.id,
                owner_id=m.owner_id,
                scheme_code=m.scheme_code,
                scheme_name=m.scheme_name,
                fund_house=m.fund_house,
                units=m.units,
                folio_masked=m.folio_masked,
                created_at=_ensure_utc(m.created_at),
            )
            for m in models
        ]

    async def get_by_id(self, holding_id: str) -> MutualFundHolding | None:
        model = await self._session.get(MutualFundHoldingModel, holding_id)
        if model is None:
            return None
        return MutualFundHolding(
            id=model.id,
            owner_id=model.owner_id,
            scheme_code=model.scheme_code,
            scheme_name=model.scheme_name,
            fund_house=model.fund_house,
            units=model.units,
            folio_masked=model.folio_masked,
            created_at=_ensure_utc(model.created_at),
        )

    async def save(self, holding: MutualFundHolding) -> None:
        model = await self._session.get(MutualFundHoldingModel, holding.id)
        if model is None:
            model = MutualFundHoldingModel(
                id=holding.id,
                owner_id=holding.owner_id,
                scheme_code=holding.scheme_code,
                scheme_name=holding.scheme_name,
                fund_house=holding.fund_house,
                units=holding.units,
                folio_masked=holding.folio_masked,
                created_at=_ensure_utc(holding.created_at) or datetime.now(UTC),
            )
            self._session.add(model)
        else:
            model.scheme_code = holding.scheme_code
            model.scheme_name = holding.scheme_name
            model.fund_house = holding.fund_house
            model.units = holding.units
            model.folio_masked = holding.folio_masked

    async def delete(self, holding_id: str) -> None:
        stmt = delete(MutualFundHoldingModel).where(MutualFundHoldingModel.id == holding_id)
        await self._session.execute(stmt)

    async def delete_for_owner(self, owner_id: str) -> int:
        stmt = delete(MutualFundHoldingModel).where(MutualFundHoldingModel.owner_id == owner_id)
        result = await self._session.execute(stmt)
        return int(result.rowcount) if result.rowcount is not None and result.rowcount > 0 else 0


class SqlAlchemyBankAccountRepository(BankAccountRepository):
    """SQLAlchemy implementation of BankAccountRepository."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_accounts_for_owner(self, owner_id: str) -> list[BankAccount]:
        stmt = (
            select(BankAccountModel)
            .where(BankAccountModel.owner_id == owner_id)
            .order_by(BankAccountModel.created_at.desc())
        )
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [
            BankAccount(
                id=m.id,
                owner_id=m.owner_id,
                bank_name=m.bank_name,
                account_number_masked=m.account_number_masked,
                ifsc_code=m.ifsc_code,
                branch_name=m.branch_name,
                account_type=m.account_type,
                holder_name=m.holder_name,
                created_at=_ensure_utc(m.created_at),
            )
            for m in models
        ]

    async def get_by_id(self, account_id: str) -> BankAccount | None:
        model = await self._session.get(BankAccountModel, account_id)
        if model is None:
            return None
        return BankAccount(
            id=model.id,
            owner_id=model.owner_id,
            bank_name=model.bank_name,
            account_number_masked=model.account_number_masked,
            ifsc_code=model.ifsc_code,
            branch_name=model.branch_name,
            account_type=model.account_type,
            holder_name=model.holder_name,
            created_at=_ensure_utc(model.created_at),
        )

    async def save(self, account: BankAccount) -> None:
        model = await self._session.get(BankAccountModel, account.id)
        if model is None:
            model = BankAccountModel(
                id=account.id,
                owner_id=account.owner_id,
                bank_name=account.bank_name,
                account_number_masked=account.account_number_masked,
                ifsc_code=account.ifsc_code,
                branch_name=account.branch_name,
                account_type=account.account_type,
                holder_name=account.holder_name,
                created_at=_ensure_utc(account.created_at) or datetime.now(UTC),
            )
            self._session.add(model)
        else:
            model.bank_name = account.bank_name
            model.account_number_masked = account.account_number_masked
            model.ifsc_code = account.ifsc_code
            model.branch_name = account.branch_name
            model.account_type = account.account_type
            model.holder_name = account.holder_name

    async def delete(self, account_id: str) -> None:
        stmt = delete(BankAccountModel).where(BankAccountModel.id == account_id)
        await self._session.execute(stmt)

