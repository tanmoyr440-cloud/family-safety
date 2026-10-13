"""In-memory Unit of Work and repository test doubles."""

from datetime import datetime
from types import TracebackType
from typing import Self

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
from app.domain.entities.inactivity_monitor import InactivityMonitor
from app.domain.entities.loan import Installment, Loan
from app.domain.entities.mutual_fund_holding import MutualFundHolding
from app.domain.entities.owner import Owner


class InMemoryOwnerRepository(OwnerRepository):
    """In-memory storage for owners."""

    def __init__(self) -> None:
        self.owners: dict[str, Owner] = {}

    async def get_by_id(self, owner_id: str) -> Owner | None:
        return self.owners.get(owner_id)

    async def save(self, owner: Owner) -> None:
        self.owners[owner.id] = owner


class InMemoryContactRepository(ContactRepository):
    """In-memory storage for contacts."""

    def __init__(self) -> None:
        self.contacts: dict[str, TrustedContact] = {}

    async def get_contacts_for_owner(self, owner_id: str) -> list[TrustedContact]:
        owner_contacts = [c for c in self.contacts.values() if c.owner_id == owner_id]
        owner_contacts.sort(key=lambda c: c.priority)
        return owner_contacts

    async def get_by_id(self, contact_id: str) -> TrustedContact | None:
        return self.contacts.get(contact_id)

    async def save(self, contact: TrustedContact) -> None:
        self.contacts[contact.id] = contact

    async def delete(self, contact_id: str) -> None:
        self.contacts.pop(contact_id, None)


class InMemoryInactivityMonitorRepository(InactivityMonitorRepository):
    """In-memory storage for monitors."""

    def __init__(self) -> None:
        self.monitors: dict[str, InactivityMonitor] = {}

    async def get_for_owner(self, owner_id: str) -> InactivityMonitor | None:
        return self.monitors.get(owner_id)

    async def save(self, monitor: InactivityMonitor) -> None:
        self.monitors[monitor.owner_id] = monitor


class InMemoryLoanRepository(LoanRepository):
    """In-memory storage for loans."""

    def __init__(self) -> None:
        self.loans: dict[str, Loan] = {}

    async def get_loans_for_owner(self, owner_id: str) -> list[Loan]:
        return [loan for loan in self.loans.values() if loan.owner_id == owner_id]

    async def get_by_id(self, loan_id: str) -> Loan | None:
        return self.loans.get(loan_id)

    async def save(self, loan: Loan) -> None:
        self.loans[loan.id] = loan


class InMemoryInstallmentRepository(InstallmentRepository):
    """In-memory storage for installments."""

    def __init__(self) -> None:
        self.installments: dict[str, Installment] = {}

    async def get_installments(self, loan_id: str) -> list[Installment]:
        return [inst for inst in self.installments.values() if inst.loan_id == loan_id]

    async def get_by_year_month(self, loan_id: str, year_month: str) -> Installment | None:
        key = f"{loan_id}:{year_month}"
        return self.installments.get(key)

    async def save(self, installment: Installment) -> None:
        key = f"{installment.loan_id}:{installment.year_month}"
        self.installments[key] = installment


class InMemoryOutboxRepository(OutboxRepository):
    """In-memory transactional outbox enforcing unique dedupe_key constraint."""

    def __init__(self) -> None:
        self.messages: dict[str, OutboxMessage] = {}
        self.dedupe_keys: set[str] = set()

    async def enqueue(self, message: OutboxMessage) -> bool:
        """Enforces dedupe_key uniqueness. Returns True if inserted, False if duplicate."""
        if message.dedupe_key in self.dedupe_keys:
            return False
        self.dedupe_keys.add(message.dedupe_key)
        self.messages[message.id] = message
        return True

    async def get_pending(self, now: datetime, limit: int = 50) -> list[OutboxMessage]:
        due = [
            m for m in self.messages.values() if m.status == "PENDING" and m.next_attempt_at <= now
        ]
        return due[:limit]

    async def update(self, message: OutboxMessage) -> None:
        self.messages[message.id] = message


class InMemoryMutualFundHoldingRepository(MutualFundHoldingRepository):
    """In-memory storage for mutual fund holdings."""

    def __init__(self) -> None:
        self.holdings: dict[str, MutualFundHolding] = {}

    async def get_holdings_for_owner(self, owner_id: str) -> list[MutualFundHolding]:
        return [h for h in self.holdings.values() if h.owner_id == owner_id]

    async def get_by_id(self, holding_id: str) -> MutualFundHolding | None:
        return self.holdings.get(holding_id)

    async def save(self, holding: MutualFundHolding) -> None:
        self.holdings[holding.id] = holding

    async def delete(self, holding_id: str) -> None:
        self.holdings.pop(holding_id, None)


class InMemoryBankAccountRepository(BankAccountRepository):
    """In-memory storage for bank accounts."""

    def __init__(self) -> None:
        self.accounts: dict[str, BankAccount] = {}

    async def get_accounts_for_owner(self, owner_id: str) -> list[BankAccount]:
        return [acc for acc in self.accounts.values() if acc.owner_id == owner_id]

    async def get_by_id(self, account_id: str) -> BankAccount | None:
        return self.accounts.get(account_id)

    async def save(self, account: BankAccount) -> None:
        self.accounts[account.id] = account

    async def delete(self, account_id: str) -> None:
        self.accounts.pop(account_id, None)


class InMemoryUnitOfWork:
    """In-memory Unit of Work implementation for unit and simulation tests."""

    def __init__(self) -> None:
        self.owners = InMemoryOwnerRepository()
        self.contacts = InMemoryContactRepository()
        self.monitors = InMemoryInactivityMonitorRepository()
        self.loans = InMemoryLoanRepository()
        self.installments = InMemoryInstallmentRepository()
        self.mutual_funds = InMemoryMutualFundHoldingRepository()
        self.bank_accounts = InMemoryBankAccountRepository()
        self.outbox = InMemoryOutboxRepository()
        self.committed = False

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        pass

    async def commit(self) -> None:
        self.committed = True

    async def rollback(self) -> None:
        self.committed = False

