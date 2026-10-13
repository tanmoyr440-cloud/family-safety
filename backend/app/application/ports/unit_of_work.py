"""Unit of work port protocol for managing transactional boundaries."""

from types import TracebackType
from typing import Protocol, Self

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


class UnitOfWork(Protocol):
    """Protocol for transactional Unit of Work."""

    @property
    def owners(self) -> OwnerRepository:
        """Owner repository."""
        ...

    @property
    def contacts(self) -> ContactRepository:
        """Contact repository."""
        ...

    @property
    def monitors(self) -> InactivityMonitorRepository:
        """Inactivity monitor repository."""
        ...

    @property
    def loans(self) -> LoanRepository:
        """Loan repository."""
        ...

    @property
    def installments(self) -> InstallmentRepository:
        """Installment repository."""
        ...

    @property
    def mutual_funds(self) -> MutualFundHoldingRepository:
        """Mutual fund holding repository."""
        ...

    @property
    def bank_accounts(self) -> BankAccountRepository:
        """Bank account repository."""
        ...

    @property
    def outbox(self) -> OutboxRepository:
        """Outbox repository."""
        ...

    async def __aenter__(self) -> Self:
        """Begin transaction."""
        ...

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        """Commit or rollback transaction."""
        ...

    async def commit(self) -> None:
        """Explicitly commit changes."""
        ...

    async def rollback(self) -> None:
        """Roll back changes."""
        ...
