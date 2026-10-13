"""Unit tests for ManageBankAccounts use case."""

from datetime import UTC, datetime

import pytest

from app.application.use_cases.manage_bank_accounts import ManageBankAccounts
from tests.fakes.fake_clock import FakeClock
from tests.fakes.in_memory_uow import InMemoryUnitOfWork


@pytest.fixture
def uow() -> InMemoryUnitOfWork:
    return InMemoryUnitOfWork()


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock(datetime(2026, 1, 15, 10, 0, tzinfo=UTC))


@pytest.mark.asyncio
async def test_add_bank_account_success(uow: InMemoryUnitOfWork, clock: FakeClock) -> None:
    use_case = ManageBankAccounts(uow=uow, clock=clock)
    account = await use_case.add_account(
        owner_id="owner-123",
        bank_name="State Bank of India",
        account_number="123456789012",
        ifsc_code="sbin0001234",
        branch_name="Main Branch",
        account_type="SAVINGS",
        holder_name="Tanmoy Sengupta",
    )

    assert account.id is not None
    assert account.owner_id == "owner-123"
    assert account.bank_name == "State Bank of India"
    assert account.account_number_masked == "XXXX9012"
    assert account.ifsc_code == "SBIN0001234"
    assert account.branch_name == "Main Branch"
    assert account.account_type == "SAVINGS"
    assert account.holder_name == "Tanmoy Sengupta"
    assert uow.committed is True

    accounts = await use_case.get_accounts("owner-123")
    assert len(accounts) == 1
    assert accounts[0].id == account.id


@pytest.mark.asyncio
async def test_add_bank_account_validation_errors(
    uow: InMemoryUnitOfWork, clock: FakeClock
) -> None:
    use_case = ManageBankAccounts(uow=uow, clock=clock)

    # Empty bank name
    with pytest.raises(ValueError, match="Bank name is required"):
        await use_case.add_account(
            owner_id="owner-123",
            bank_name="  ",
            account_number="12345678",
            ifsc_code="SBIN0001234",
        )

    # Short account number
    with pytest.raises(ValueError, match="at least 4 digits"):
        await use_case.add_account(
            owner_id="owner-123",
            bank_name="HDFC Bank",
            account_number="12",
            ifsc_code="HDFC0000001",
        )

    # Invalid IFSC
    with pytest.raises(ValueError, match="Invalid IFSC code"):
        await use_case.add_account(
            owner_id="owner-123",
            bank_name="HDFC Bank",
            account_number="123456789",
            ifsc_code="HDFC123456",
        )


@pytest.mark.asyncio
async def test_delete_bank_account(uow: InMemoryUnitOfWork, clock: FakeClock) -> None:
    use_case = ManageBankAccounts(uow=uow, clock=clock)
    acc = await use_case.add_account(
        owner_id="owner-123",
        bank_name="ICICI Bank",
        account_number="987654321000",
        ifsc_code="ICIC0006282",
    )

    accounts_before = await use_case.get_accounts("owner-123")
    assert len(accounts_before) == 1

    # Unauthorized owner cannot delete
    await use_case.delete_account(owner_id="other-owner", account_id=acc.id)
    accounts_still = await use_case.get_accounts("owner-123")
    assert len(accounts_still) == 1

    # Actual owner can delete
    await use_case.delete_account(owner_id="owner-123", account_id=acc.id)
    accounts_after = await use_case.get_accounts("owner-123")
    assert len(accounts_after) == 0
