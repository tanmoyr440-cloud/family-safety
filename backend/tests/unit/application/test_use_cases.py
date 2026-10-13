"""Unit tests for application use cases."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.application.ports.document_store import DocumentMetadata
from app.application.use_cases.assemble_packet import AssemblePacket
from app.application.use_cases.confirm_loan_payment import ConfirmLoanPayment
from app.application.use_cases.dispatch_outbox import DispatchOutbox
from app.application.use_cases.manage_contacts import ManageContacts
from app.application.use_cases.pause_monitoring import PauseMonitoring
from app.application.use_cases.record_activity import RecordActivity
from app.domain.entities.inactivity_monitor import InactivityStage
from app.domain.entities.loan import Loan
from app.domain.entities.owner import Owner
from app.domain.policies.escalation_policy import ChannelKind
from app.domain.value_objects.due_day import DueDay
from app.domain.value_objects.email_address import EmailAddress
from app.domain.value_objects.money import Money
from app.domain.value_objects.phone_number import PhoneNumber
from tests.fakes.fake_clock import FakeClock
from tests.fakes.fake_document_store import FakeDocumentStore
from tests.fakes.in_memory_uow import InMemoryUnitOfWork
from tests.fakes.recording_channel import RecordingChannel


@pytest.fixture
def uow() -> InMemoryUnitOfWork:
    return InMemoryUnitOfWork()


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock(datetime(2026, 1, 1, 9, 0, tzinfo=UTC))


@pytest.mark.asyncio
async def test_record_activity(uow: InMemoryUnitOfWork, clock: FakeClock) -> None:
    use_case = RecordActivity(uow, clock)
    t1 = await use_case.execute("owner-1")
    assert t1 == clock.now()

    # Advance clock and record again
    clock.advance(days=5)
    t2 = await use_case.execute("owner-1")
    assert t2 == clock.now()
    assert t2 > t1


@pytest.mark.asyncio
async def test_confirm_loan_payment(uow: InMemoryUnitOfWork, clock: FakeClock) -> None:
    loan = Loan(
        id="loan-1",
        owner_id="owner-1",
        lender="HDFC Bank",
        account_masked="XXXX1234",
        emi=Money(1_616_600),
        due_day=DueDay(24),
        first_installment_month="2026-01",
        last_installment_month="2026-12",
    )
    await uow.loans.save(loan)

    use_case = ConfirmLoanPayment(uow, clock)
    inst = await use_case.execute("loan-1", "2026-10")
    assert inst.status == "PAID"
    assert inst.paid_at is not None

    # Idempotent: confirm again
    inst2 = await use_case.execute("loan-1", "2026-10")
    assert inst2.status == "PAID"
    assert inst2.paid_at == inst.paid_at


@pytest.mark.asyncio
async def test_manage_contacts(uow: InMemoryUnitOfWork, clock: FakeClock) -> None:
    use_case = ManageContacts(uow, clock)
    contact = await use_case.add_contact(
        owner_id="owner-1",
        name="Father",
        relation="father",
        phone="+919876543210",
        email="father@example.com",
        priority=1,
    )
    assert contact.is_verified is False

    # Verify consent
    verified = await use_case.verify_consent(contact.id)
    assert verified.is_verified is True

    # Delete contact
    await use_case.delete_contact(contact.id)
    assert await uow.contacts.get_by_id(contact.id) is None


@pytest.mark.asyncio
async def test_pause_monitoring(uow: InMemoryUnitOfWork, clock: FakeClock) -> None:
    use_case = PauseMonitoring(uow, clock)
    pause_until = clock.now() + timedelta(days=30)
    monitor = await use_case.execute("owner-1", until=pause_until)
    assert monitor.status == InactivityStage.PAUSED
    assert monitor.paused_until == pause_until


@pytest.mark.asyncio
async def test_dispatch_outbox_success(uow: InMemoryUnitOfWork, clock: FakeClock) -> None:
    sms_channel = RecordingChannel(ChannelKind.SMS)
    use_case = DispatchOutbox(uow, clock, [sms_channel])

    # Enqueue a message
    from app.application.dto import OutboxMessage

    msg = OutboxMessage(
        id=str(uuid.uuid4()),
        dedupe_key="test-key-1",
        channel=ChannelKind.SMS,
        recipient="+919876543210",
        template_id="test_template",
        payload={"message": "hello"},
        next_attempt_at=clock.now(),
    )
    await uow.outbox.enqueue(msg)

    sent = await use_case.execute()
    assert sent == 1
    assert len(sms_channel.sent_messages) == 1
    assert msg.status == "SENT"


@pytest.mark.asyncio
async def test_dispatch_outbox_transient_failure_retries(
    uow: InMemoryUnitOfWork,
    clock: FakeClock,
) -> None:
    sms_channel = RecordingChannel(ChannelKind.SMS)
    sms_channel.fail_transient = True
    use_case = DispatchOutbox(uow, clock, [sms_channel])

    from app.application.dto import OutboxMessage

    msg = OutboxMessage(
        id=str(uuid.uuid4()),
        dedupe_key="test-key-retry",
        channel=ChannelKind.SMS,
        recipient="+919876543210",
        template_id="test_template",
        payload={"message": "hello"},
        next_attempt_at=clock.now(),
    )
    await uow.outbox.enqueue(msg)

    # First attempt fails transiently
    sent = await use_case.execute()
    assert sent == 0
    assert msg.status == "PENDING"
    assert msg.attempts == 1
    # Next attempt scheduled 60s in future
    assert msg.next_attempt_at == clock.now() + timedelta(seconds=60)


@pytest.mark.asyncio
async def test_dispatch_outbox_permanent_failure_marks_dead(
    uow: InMemoryUnitOfWork,
    clock: FakeClock,
) -> None:
    sms_channel = RecordingChannel(ChannelKind.SMS)
    sms_channel.fail_permanent = True
    use_case = DispatchOutbox(uow, clock, [sms_channel])

    from app.application.dto import OutboxMessage

    msg = OutboxMessage(
        id=str(uuid.uuid4()),
        dedupe_key="test-key-permanent",
        channel=ChannelKind.SMS,
        recipient="+919876543210",
        template_id="test_template",
        payload={"message": "hello"},
        next_attempt_at=clock.now(),
    )
    await uow.outbox.enqueue(msg)

    sent = await use_case.execute()
    assert sent == 0
    assert msg.status == "DEAD"
    assert msg.attempts == 1


@pytest.mark.asyncio
async def test_assemble_packet(uow: InMemoryUnitOfWork, clock: FakeClock) -> None:
    owner = Owner(
        id="owner-1",
        name="Tanmoy",
        phone=PhoneNumber("+919876543210"),
        email=EmailAddress("tanmoy@example.com"),
    )
    await uow.owners.save(owner)

    loan = Loan(
        id="loan-1",
        owner_id="owner-1",
        lender="HDFC Bank",
        account_masked="XXXX1234",
        emi=Money(1_616_600),
        due_day=DueDay(24),
    )
    await uow.loans.save(loan)

    doc_store = FakeDocumentStore()
    doc_store.add_document(
        DocumentMetadata(
            id="doc-1",
            owner_id="owner-1",
            title="Car RC",
            file_name="rc.pdf",
            file_size_bytes=1024,
            content_type="application/pdf",
            sha256_hash="abcdef",
            uploaded_at=clock.now(),
        ),
    )

    use_case = AssemblePacket(uow, clock, doc_store)
    packet = await use_case.execute("owner-1")
    assert packet.owner_name == "Tanmoy"
    assert len(packet.loans) == 1
    assert packet.loans[0]["account_masked"] == "XXXX1234"
    assert len(packet.document_manifest) == 1
    assert packet.document_manifest[0]["title"] == "Car RC"
