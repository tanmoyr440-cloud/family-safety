"""100-day time-travel simulation test matching references/testing.md Section 5."""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from app.application.use_cases.confirm_loan_payment import ConfirmLoanPayment
from app.application.use_cases.dispatch_outbox import DispatchOutbox
from app.application.use_cases.evaluate_inactivity import EvaluateInactivity
from app.application.use_cases.evaluate_loan_obligations import EvaluateLoanObligations
from app.domain.entities.contact import TrustedContact
from app.domain.entities.inactivity_monitor import InactivityConfig, InactivityMonitor
from app.domain.entities.loan import Installment, InstallmentStatus, Loan
from app.domain.entities.owner import Owner
from app.domain.policies.escalation_policy import ChannelKind
from app.domain.value_objects.due_day import DueDay
from app.domain.value_objects.email_address import EmailAddress
from app.domain.value_objects.money import Money
from app.domain.value_objects.phone_number import PhoneNumber
from tests.fakes.fake_clock import FakeClock
from tests.fakes.in_memory_uow import InMemoryUnitOfWork
from tests.fakes.recording_channel import RecordingChannel


@pytest.mark.asyncio
async def test_inactivity_100_day_simulation() -> None:
    """100-day time-travel simulation for investment inactivity.

    Simulates an owner with no activity over 100 days:
    - Days 1 to 59: OK, 0 messages sent
    - Day 60: WARN_OWNER_1 -> exactly 2 messages (Owner SMS + Email)
    - Days 61 to 79: OK/warned, 0 messages sent
    - Day 80: WARN_OWNER_2 -> exactly 2 messages (Owner SMS + Email)
    - Days 81 to 89: 0 messages sent
    - Day 90: NOTIFY_PARENTS -> exactly 4 messages (Contact SMS + Email, Owner copy SMS + Email)
    - Days 91 to 100: 0 messages sent (no duplicates)
    """
    tz = ZoneInfo("Asia/Kolkata")
    start_time = datetime(2026, 1, 1, 9, 0, tzinfo=tz)

    clock = FakeClock(start_time)
    uow = InMemoryUnitOfWork()

    sms_channel = RecordingChannel(ChannelKind.SMS)
    email_channel = RecordingChannel(ChannelKind.EMAIL)

    owner = Owner(
        id="owner-sim",
        name="Tanmoy",
        phone=PhoneNumber("+919876543210"),
        email=EmailAddress("tanmoy@example.com"),
        timezone="Asia/Kolkata",
    )
    await uow.owners.save(owner)

    contact = TrustedContact(
        id="contact-sim",
        owner_id=owner.id,
        name="Father",
        relation="father",
        phone=PhoneNumber("+919876543211"),
        email=EmailAddress("father@example.com"),
        priority=1,
        consent_verified_at=start_time,
    )
    await uow.contacts.save(contact)

    monitor = InactivityMonitor(
        owner_id=owner.id,
        started_at=start_time,
        last_activity_at=start_time,
        config=InactivityConfig(threshold_days=90, warning_days=(60, 80)),
    )
    await uow.monitors.save(monitor)

    evaluate_inactivity = EvaluateInactivity(uow, clock)
    dispatch_outbox = DispatchOutbox(uow, clock, [sms_channel, email_channel])

    # Record which day triggered which message count
    daily_sends: dict[int, int] = {}

    for day in range(1, 101):
        clock.advance(days=1)
        # Clear channel recording from previous day
        sms_channel.clear()
        email_channel.clear()

        await evaluate_inactivity.execute(owner.id)
        sent_today = await dispatch_outbox.execute()
        daily_sends[day] = sent_today

    # Verification of exact schedule
    for day in range(1, 60):
        assert daily_sends[day] == 0, f"Expected 0 messages on day {day}, got {daily_sends[day]}"

    assert daily_sends[60] == 2, f"Expected 2 messages on day 60, got {daily_sends[60]}"

    for day in range(61, 80):
        assert daily_sends[day] == 0, f"Expected 0 messages on day {day}, got {daily_sends[day]}"

    assert daily_sends[80] == 2, f"Expected 2 messages on day 80, got {daily_sends[80]}"

    for day in range(81, 90):
        assert daily_sends[day] == 0, f"Expected 0 messages on day {day}, got {daily_sends[day]}"

    assert daily_sends[90] == 4, f"Expected 4 messages on day 90, got {daily_sends[90]}"

    for day in range(91, 101):
        assert daily_sends[day] == 0, f"Expected 0 messages on day {day}, got {daily_sends[day]}"


@pytest.mark.asyncio
async def test_loan_obligations_month_simulation() -> None:
    """Simulation of car loan EMI (Rs 16,166 due on 24th, grace 1) throughout October 2026.

    - Oct 1 to 20: 0 messages
    - Oct 21 (due - 3d): 2 messages (Owner SMS + Email reminder)
    - Oct 22: 0 messages
    - Oct 23 (due - 1d): 2 messages (Owner SMS + Email reminder)
    - Oct 24 (due date): 2 messages (Owner SMS + Email due alert)
    - Oct 25 (inside grace 1): 2 messages (Owner grace nag)
    - Oct 26 (unpaid past grace -> MISSED): 4 messages (Parents alerted via SMS + Email, Owner copy)
    - Oct 27: 0 messages
    - Oct 28: Owner pays late -> ConfirmLoanPayment
    - Oct 29: 2 messages (Parents RESOLVED notification)
    - Oct 30 to 31: 0 messages
    """
    tz = ZoneInfo("Asia/Kolkata")
    oct_1 = datetime(2026, 10, 1, 9, 0, tzinfo=tz)

    clock = FakeClock(oct_1)
    uow = InMemoryUnitOfWork()

    sms_channel = RecordingChannel(ChannelKind.SMS)
    email_channel = RecordingChannel(ChannelKind.EMAIL)

    owner = Owner(
        id="owner-loan-sim",
        name="Tanmoy",
        phone=PhoneNumber("+919876543210"),
        email=EmailAddress("tanmoy@example.com"),
        timezone="Asia/Kolkata",
    )
    await uow.owners.save(owner)

    contact = TrustedContact(
        id="contact-loan-sim",
        owner_id=owner.id,
        name="Father",
        relation="father",
        phone=PhoneNumber("+919876543211"),
        email=EmailAddress("father@example.com"),
        priority=1,
        consent_verified_at=oct_1,
    )
    await uow.contacts.save(contact)

    loan = Loan(
        id="loan-oct-sim",
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

    installment = Installment(
        loan_id=loan.id,
        year_month="2026-10",
        due_date=datetime(2026, 10, 24).date(),
        amount=loan.emi,
        status=InstallmentStatus.UPCOMING,
    )
    await uow.installments.save(installment)

    evaluate_loan = EvaluateLoanObligations(uow, clock)
    confirm_payment = ConfirmLoanPayment(uow, clock)
    dispatch_outbox = DispatchOutbox(uow, clock, [sms_channel, email_channel])

    daily_sends: dict[int, int] = {}

    for day in range(2, 32):
        clock.set(datetime(2026, 10, day, 9, 0, tzinfo=tz))
        sms_channel.clear()
        email_channel.clear()

        if day == 28:
            # Owner confirms payment late
            await confirm_payment.execute(loan.id, "2026-10")

        await evaluate_loan.execute(loan.id)
        sent = await dispatch_outbox.execute()
        daily_sends[day] = sent

    # Oct 2 to 20: 0 messages
    for day in range(2, 21):
        assert daily_sends[day] == 0, f"Day {day} expected 0 messages"

    # Oct 21: 2 reminders (due - 3d)
    assert daily_sends[21] == 2

    # Oct 22: 0
    assert daily_sends[22] == 0

    # Oct 23: 2 reminders (due - 1d)
    assert daily_sends[23] == 2

    # Oct 24: 2 reminders (due day)
    assert daily_sends[24] == 2

    # Oct 25: 2 warnings (grace period)
    assert daily_sends[25] == 2

    # Oct 26: 4 parent escalations (MISSED: contact SMS+Email, owner copy SMS+Email)
    assert daily_sends[26] == 4

    # Oct 27: 0
    assert daily_sends[27] == 0

    # Oct 28: Paid today, evaluation runs after payment -> resolved queued (contact SMS + Email)
    assert daily_sends[28] == 2

    # Oct 29 to 31: 0 messages
    for day in range(29, 32):
        assert daily_sends[day] == 0, f"Day {day} expected 0 messages"
