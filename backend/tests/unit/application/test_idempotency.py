"""Idempotency tests verifying no duplicate outbox messages are enqueued on repeated runs."""

from datetime import UTC, datetime

import pytest

from app.application.use_cases.evaluate_inactivity import EvaluateInactivity
from app.application.use_cases.evaluate_loan_obligations import EvaluateLoanObligations
from app.domain.entities.contact import TrustedContact
from app.domain.entities.inactivity_monitor import InactivityConfig, InactivityMonitor
from app.domain.entities.loan import Installment, InstallmentStatus, Loan
from app.domain.entities.owner import Owner
from app.domain.value_objects.due_day import DueDay
from app.domain.value_objects.email_address import EmailAddress
from app.domain.value_objects.money import Money
from app.domain.value_objects.phone_number import PhoneNumber
from tests.fakes.fake_clock import FakeClock
from tests.fakes.in_memory_uow import InMemoryUnitOfWork


@pytest.fixture
def uow() -> InMemoryUnitOfWork:
    return InMemoryUnitOfWork()


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock(datetime(2026, 1, 1, 9, 0, tzinfo=UTC))


@pytest.fixture
async def setup_owner_and_contact(
    uow: InMemoryUnitOfWork, clock: FakeClock
) -> tuple[Owner, TrustedContact]:
    owner = Owner(
        id="owner-idempotency",
        name="Tanmoy",
        phone=PhoneNumber("+919876543210"),
        email=EmailAddress("tanmoy@example.com"),
        timezone="Asia/Kolkata",
    )
    await uow.owners.save(owner)

    contact = TrustedContact(
        id="contact-idempotency",
        owner_id=owner.id,
        name="Father",
        relation="father",
        phone=PhoneNumber("+919876543211"),
        email=EmailAddress("father@example.com"),
        priority=1,
        consent_verified_at=clock.now(),
    )
    await uow.contacts.save(contact)

    return owner, contact


@pytest.mark.asyncio
async def test_evaluate_inactivity_idempotency(
    uow: InMemoryUnitOfWork,
    clock: FakeClock,
    setup_owner_and_contact: tuple[Owner, TrustedContact],
) -> None:
    owner, _ = setup_owner_and_contact

    # Monitor started 60 days ago
    start_time = clock.now()
    monitor = InactivityMonitor(
        owner_id=owner.id,
        started_at=start_time,
        last_activity_at=start_time,
        config=InactivityConfig(threshold_days=90, warning_days=(60, 80)),
    )
    await uow.monitors.save(monitor)

    # Advance clock to day 60
    clock.advance(days=60)

    use_case = EvaluateInactivity(uow, clock)

    # Run 1: Enqueues owner warnings (SMS and EMAIL)
    report1 = await use_case.execute(owner.id)
    assert report1.messages_queued == 2
    assert len(uow.outbox.messages) == 2

    # Run 2: Exact same time, enqueues nothing new
    report2 = await use_case.execute(owner.id)
    assert report2.messages_queued == 0
    assert len(uow.outbox.messages) == 2


@pytest.mark.asyncio
async def test_evaluate_loan_obligations_idempotency(
    uow: InMemoryUnitOfWork,
    clock: FakeClock,
    setup_owner_and_contact: tuple[Owner, TrustedContact],
) -> None:
    owner, _ = setup_owner_and_contact

    loan = Loan(
        id="loan-idempotency",
        owner_id=owner.id,
        lender="HDFC Bank",
        account_masked="XXXX1234",
        emi=Money(1_616_600),
        due_day=DueDay(24),
        grace_days=1,
        first_installment_month="2026-01",
        last_installment_month="2026-12",
        reminder_days_before=(3, 1, 0),
    )
    await uow.loans.save(loan)

    # Set clock to Oct 21, 2026 (3 days before Oct 24)
    clock.set(datetime(2026, 10, 21, 9, 0, tzinfo=UTC))

    installment = Installment(
        loan_id=loan.id,
        year_month="2026-10",
        due_date=datetime(2026, 10, 24).date(),
        amount=loan.emi,
        status=InstallmentStatus.UPCOMING,
    )
    await uow.installments.save(installment)

    use_case = EvaluateLoanObligations(uow, clock)

    # First run on 21st: Enqueues owner reminders (SMS and EMAIL)
    report1 = await use_case.execute(loan.id)
    assert report1.messages_queued == 2
    assert len(uow.outbox.messages) == 2

    # Second run on 21st: Enqueues 0 new messages
    report2 = await use_case.execute(loan.id)
    assert report2.messages_queued == 0
    assert len(uow.outbox.messages) == 2
