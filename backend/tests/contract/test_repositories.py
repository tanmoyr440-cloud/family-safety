"""Contract tests ensuring identical repository behavior across InMemory
and SqlAlchemy implementations.
"""

import uuid
from collections.abc import Callable
from datetime import UTC, date, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.application.dto import OutboxMessage
from app.application.ports.unit_of_work import UnitOfWork
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
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from tests.fakes.in_memory_uow import InMemoryUnitOfWork


@pytest.fixture
def in_memory_uow_factory() -> Callable[[], UnitOfWork]:
    return lambda: InMemoryUnitOfWork()


@pytest.fixture
def sql_uow_factory(
    db_session_factory: async_sessionmaker[AsyncSession],
) -> Callable[[], UnitOfWork]:
    return lambda: SqlAlchemyUnitOfWork(db_session_factory)


@pytest.fixture(params=["in_memory", "sqlalchemy"])
def uow(
    request: pytest.FixtureRequest,
    in_memory_uow_factory: Callable[[], UnitOfWork],
    sql_uow_factory: Callable[[], UnitOfWork],
) -> UnitOfWork:
    if request.param == "in_memory":
        return in_memory_uow_factory()
    return sql_uow_factory()


@pytest.mark.asyncio
async def test_owner_repository_contract(uow: UnitOfWork) -> None:
    owner_id = f"owner-{uuid.uuid4()}"
    owner_email = f"{owner_id}@contract.com"
    owner = Owner(
        id=owner_id,
        name="Contract Test Owner",
        phone=PhoneNumber("+919876543210"),
        email=EmailAddress(owner_email),
        timezone="Asia/Kolkata",
    )

    async with uow:
        await uow.owners.save(owner)
        await uow.commit()

    async with uow:
        retrieved = await uow.owners.get_by_id(owner_id)
        assert retrieved is not None
        assert retrieved.id == owner_id
        assert retrieved.name == "Contract Test Owner"
        assert retrieved.phone == PhoneNumber("+919876543210")
        assert retrieved.email == EmailAddress(owner_email)


@pytest.mark.asyncio
async def test_contact_repository_contract(uow: UnitOfWork) -> None:
    owner_id = f"owner-{uuid.uuid4()}"
    owner = Owner(
        id=owner_id,
        name="Owner With Contacts",
        phone=PhoneNumber("+919876543210"),
        email=EmailAddress(f"{owner_id}@contract.com"),
    )

    contact_id = f"contact-{uuid.uuid4()}"
    contact = TrustedContact(
        id=contact_id,
        owner_id=owner_id,
        name="Father",
        relation="father",
        phone=PhoneNumber("+919876543211"),
        email=EmailAddress(f"{contact_id}@contract.com"),
        priority=1,
    )

    async with uow:
        await uow.owners.save(owner)
        await uow.contacts.save(contact)
        await uow.commit()

    async with uow:
        contacts = await uow.contacts.get_contacts_for_owner(owner_id)
        assert len(contacts) == 1
        assert contacts[0].id == contact_id
        assert contacts[0].name == "Father"
        assert contacts[0].priority == 1

        # Delete contact
        await uow.contacts.delete(contact_id)
        await uow.commit()

    async with uow:
        assert await uow.contacts.get_by_id(contact_id) is None


@pytest.mark.asyncio
async def test_monitor_repository_contract(uow: UnitOfWork) -> None:
    owner_id = f"owner-{uuid.uuid4()}"
    owner = Owner(
        id=owner_id,
        name="Monitored Owner",
        phone=PhoneNumber("+919876543210"),
        email=EmailAddress(f"{owner_id}@contract.com"),
    )
    now = datetime.now(UTC)
    monitor = InactivityMonitor(
        owner_id=owner_id,
        started_at=now,
        last_activity_at=now,
        config=InactivityConfig(threshold_days=90, warning_days=(60, 80)),
    )

    async with uow:
        await uow.owners.save(owner)
        await uow.monitors.save(monitor)
        await uow.commit()

    async with uow:
        saved_monitor = await uow.monitors.get_for_owner(owner_id)
        assert saved_monitor is not None
        assert saved_monitor.owner_id == owner_id
        assert saved_monitor.config.threshold_days == 90
        assert saved_monitor.config.warning_days == (60, 80)
        assert saved_monitor.status == InactivityStage.OK


@pytest.mark.asyncio
async def test_loan_and_installment_repository_contract(uow: UnitOfWork) -> None:
    owner_id = f"owner-{uuid.uuid4()}"
    owner = Owner(
        id=owner_id,
        name="Loan Owner",
        phone=PhoneNumber("+919876543210"),
        email=EmailAddress(f"{owner_id}@contract.com"),
    )
    loan_id = f"loan-{uuid.uuid4()}"
    loan = Loan(
        id=loan_id,
        owner_id=owner_id,
        lender="HDFC Bank",
        account_masked="XXXX1234",
        emi=Money(1_616_600),
        due_day=DueDay(24),
    )
    installment = Installment(
        loan_id=loan_id,
        year_month="2026-10",
        due_date=date(2026, 10, 24),
        amount=Money(1_616_600),
        status=InstallmentStatus.UPCOMING,
    )

    async with uow:
        await uow.owners.save(owner)
        await uow.loans.save(loan)
        await uow.installments.save(installment)
        await uow.commit()

    async with uow:
        saved_loan = await uow.loans.get_by_id(loan_id)
        assert saved_loan is not None
        assert saved_loan.emi == Money(1_616_600)
        assert saved_loan.due_day == DueDay(24)

        saved_inst = await uow.installments.get_by_year_month(loan_id, "2026-10")
        assert saved_inst is not None
        assert saved_inst.amount == Money(1_616_600)
        assert saved_inst.status == InstallmentStatus.UPCOMING


@pytest.mark.asyncio
async def test_outbox_repository_contract(uow: UnitOfWork) -> None:
    now = datetime.now(UTC)
    msg1 = OutboxMessage(
        id=str(uuid.uuid4()),
        dedupe_key=f"contract-dedupe-{uuid.uuid4()}",
        channel=ChannelKind.SMS,
        recipient="+919876543210",
        template_id="test_tmpl",
        payload={"foo": "bar"},
        next_attempt_at=now,
    )

    async with uow:
        inserted1 = await uow.outbox.enqueue(msg1)
        assert inserted1 is True
        # Duplicate dedupe_key returns False
        inserted2 = await uow.outbox.enqueue(msg1)
        assert inserted2 is False
        await uow.commit()

    async with uow:
        pending = await uow.outbox.get_pending(now=now, limit=10)
        matching = [m for m in pending if m.id == msg1.id]
        assert len(matching) == 1
        assert matching[0].dedupe_key == msg1.dedupe_key


@pytest.mark.asyncio
async def test_mutual_fund_repository_contract(uow: UnitOfWork) -> None:
    owner_id = f"owner-{uuid.uuid4()}"
    owner = Owner(
        id=owner_id,
        name="MF Contract Owner",
        phone=PhoneNumber("+919876543210"),
        email=EmailAddress(f"{owner_id}@contract.com"),
    )
    holding_id = f"mf-{uuid.uuid4()}"
    holding = MutualFundHolding(
        id=holding_id,
        owner_id=owner_id,
        scheme_code=122639,
        scheme_name="Parag Parikh Flexi Cap Fund",
        fund_house="PPFAS Mutual Fund",
        units=150.0,
        folio_masked="XXXX9876",
        created_at=datetime.now(UTC),
    )

    async with uow:
        await uow.owners.save(owner)
        await uow.mutual_funds.save(holding)
        await uow.commit()

    async with uow:
        holdings = await uow.mutual_funds.get_holdings_for_owner(owner_id)
        assert len(holdings) == 1
        assert holdings[0].id == holding_id
        assert holdings[0].scheme_code == 122639
        assert holdings[0].units == 150.0

        retrieved = await uow.mutual_funds.get_by_id(holding_id)
        assert retrieved is not None
        assert retrieved.scheme_name == "Parag Parikh Flexi Cap Fund"

        # Delete
        await uow.mutual_funds.delete(holding_id)
        await uow.commit()

    async with uow:
        assert await uow.mutual_funds.get_by_id(holding_id) is None

