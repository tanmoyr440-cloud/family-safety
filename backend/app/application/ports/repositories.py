"""Repository interfaces (ports) for domain entities and outbox messages."""

from datetime import datetime
from typing import Protocol

from app.application.dto import OutboxMessage
from app.domain.entities.bank_account import BankAccount
from app.domain.entities.contact import TrustedContact
from app.domain.entities.inactivity_monitor import InactivityMonitor
from app.domain.entities.loan import Installment, Loan
from app.domain.entities.mutual_fund_holding import MutualFundHolding
from app.domain.entities.owner import Owner


class OwnerRepository(Protocol):
    """Protocol for Owner persistence."""

    async def get_by_id(self, owner_id: str) -> Owner | None:
        """Fetch owner by id."""
        ...

    async def save(self, owner: Owner) -> None:
        """Persist or update owner."""
        ...


class ContactRepository(Protocol):
    """Protocol for TrustedContact persistence."""

    async def get_contacts_for_owner(self, owner_id: str) -> list[TrustedContact]:
        """Fetch all contacts for owner ordered by priority."""
        ...

    async def get_by_id(self, contact_id: str) -> TrustedContact | None:
        """Fetch contact by id."""
        ...

    async def save(self, contact: TrustedContact) -> None:
        """Persist or update contact."""
        ...

    async def delete(self, contact_id: str) -> None:
        """Delete contact by id."""
        ...


class InactivityMonitorRepository(Protocol):
    """Protocol for InactivityMonitor aggregate persistence."""

    async def get_for_owner(self, owner_id: str) -> InactivityMonitor | None:
        """Fetch monitor for owner."""
        ...

    async def save(self, monitor: InactivityMonitor) -> None:
        """Persist or update monitor."""
        ...


class LoanRepository(Protocol):
    """Protocol for Loan aggregate persistence."""

    async def get_loans_for_owner(self, owner_id: str) -> list[Loan]:
        """Fetch all loans for owner."""
        ...

    async def get_by_id(self, loan_id: str) -> Loan | None:
        """Fetch loan by id."""
        ...

    async def save(self, loan: Loan) -> None:
        """Persist or update loan."""
        ...


class InstallmentRepository(Protocol):
    """Protocol for Installment persistence."""

    async def get_installments(self, loan_id: str) -> list[Installment]:
        """Fetch all installments for a loan."""
        ...

    async def get_by_year_month(self, loan_id: str, year_month: str) -> Installment | None:
        """Fetch installment by loan id and YYYY-MM."""
        ...

    async def save(self, installment: Installment) -> None:
        """Persist or update installment."""
        ...


class OutboxRepository(Protocol):
    """Protocol for Transactional Outbox persistence."""

    async def enqueue(self, message: OutboxMessage) -> bool:
        """Enqueue message. Returns True if inserted, False if dedupe_key already exists."""
        ...

    async def get_pending(self, now: datetime, limit: int = 50) -> list[OutboxMessage]:
        """Fetch pending messages due for delivery."""
        ...

    async def update(self, message: OutboxMessage) -> None:
        """Update message status, attempts, error, or sent timestamp."""
        ...


class MutualFundHoldingRepository(Protocol):
    """Protocol for MutualFundHolding persistence."""

    async def get_holdings_for_owner(self, owner_id: str) -> list[MutualFundHolding]:
        """Fetch all registered mutual fund holdings for owner."""
        ...

    async def get_by_id(self, holding_id: str) -> MutualFundHolding | None:
        """Fetch holding by ID."""
        ...

    async def save(self, holding: MutualFundHolding) -> None:
        """Persist or update holding."""
        ...

    async def delete(self, holding_id: str) -> None:
        """Delete holding by ID."""
        ...

    async def delete_for_owner(self, owner_id: str) -> int:
        """Delete all holdings for owner and return count deleted."""
        ...


class BankAccountRepository(Protocol):
    """Protocol for BankAccount persistence."""

    async def get_accounts_for_owner(self, owner_id: str) -> list[BankAccount]:
        """Fetch all registered bank accounts for owner."""
        ...

    async def get_by_id(self, account_id: str) -> BankAccount | None:
        """Fetch bank account by ID."""
        ...

    async def save(self, account: BankAccount) -> None:
        """Persist or update bank account."""
        ...

    async def delete(self, account_id: str) -> None:
        """Delete bank account by ID."""
        ...

