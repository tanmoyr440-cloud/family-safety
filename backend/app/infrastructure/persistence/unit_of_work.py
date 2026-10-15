"""SQLAlchemy Unit of Work implementation."""

from types import TracebackType
from typing import Self

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

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
from app.application.ports.unit_of_work import UnitOfWork
from app.infrastructure.persistence.repositories import (
    SqlAlchemyBankAccountRepository,
    SqlAlchemyContactRepository,
    SqlAlchemyInactivityMonitorRepository,
    SqlAlchemyInstallmentRepository,
    SqlAlchemyLoanRepository,
    SqlAlchemyMutualFundHoldingRepository,
    SqlAlchemyOutboxRepository,
    SqlAlchemyOwnerRepository,
)


class SqlAlchemyUnitOfWork(UnitOfWork):
    """SQLAlchemy implementation of UnitOfWork managing AsyncSession transactions."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        self._session_factory = session_factory
        self._session: AsyncSession | None = None
        self._depth: int = 0
        self._owners: SqlAlchemyOwnerRepository | None = None
        self._contacts: SqlAlchemyContactRepository | None = None
        self._monitors: SqlAlchemyInactivityMonitorRepository | None = None
        self._loans: SqlAlchemyLoanRepository | None = None
        self._installments: SqlAlchemyInstallmentRepository | None = None
        self._mutual_funds: SqlAlchemyMutualFundHoldingRepository | None = None
        self._bank_accounts: SqlAlchemyBankAccountRepository | None = None
        self._outbox: SqlAlchemyOutboxRepository | None = None

    @property
    def owners(self) -> OwnerRepository:
        assert self._owners is not None, "UnitOfWork not initialized. Use 'async with uow:'"
        return self._owners

    @property
    def contacts(self) -> ContactRepository:
        assert self._contacts is not None, "UnitOfWork not initialized. Use 'async with uow:'"
        return self._contacts

    @property
    def monitors(self) -> InactivityMonitorRepository:
        assert self._monitors is not None, "UnitOfWork not initialized. Use 'async with uow:'"
        return self._monitors

    @property
    def loans(self) -> LoanRepository:
        assert self._loans is not None, "UnitOfWork not initialized. Use 'async with uow:'"
        return self._loans

    @property
    def installments(self) -> InstallmentRepository:
        assert self._installments is not None, "UnitOfWork not initialized. Use 'async with uow:'"
        return self._installments

    @property
    def mutual_funds(self) -> MutualFundHoldingRepository:
        assert self._mutual_funds is not None, "UnitOfWork not initialized. Use 'async with uow:'"
        return self._mutual_funds

    @property
    def bank_accounts(self) -> BankAccountRepository:
        assert self._bank_accounts is not None, "UnitOfWork not initialized. Use 'async with uow:'"
        return self._bank_accounts

    @property
    def outbox(self) -> OutboxRepository:
        assert self._outbox is not None, "UnitOfWork not initialized. Use 'async with uow:'"
        return self._outbox

    async def __aenter__(self) -> Self:
        if self._depth == 0:
            self._session = self._session_factory()
            self._owners = SqlAlchemyOwnerRepository(self._session)
            self._contacts = SqlAlchemyContactRepository(self._session)
            self._monitors = SqlAlchemyInactivityMonitorRepository(self._session)
            self._loans = SqlAlchemyLoanRepository(self._session)
            self._installments = SqlAlchemyInstallmentRepository(self._session)
            self._mutual_funds = SqlAlchemyMutualFundHoldingRepository(self._session)
            self._bank_accounts = SqlAlchemyBankAccountRepository(self._session)
            self._outbox = SqlAlchemyOutboxRepository(self._session)
        self._depth += 1
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        self._depth = max(0, self._depth - 1)
        if self._depth == 0 and self._session is not None:
            try:
                if exc_type is not None:
                    await self._session.rollback()
            finally:
                await self._session.close()
                self._session = None
                self._owners = None
                self._contacts = None
                self._monitors = None
                self._loans = None
                self._installments = None
                self._mutual_funds = None
                self._bank_accounts = None
                self._outbox = None

    async def close(self) -> None:
        """Force close active session if left open."""
        if self._session is not None:
            try:
                await self._session.close()
            finally:
                self._session = None
                self._depth = 0
                self._owners = None
                self._contacts = None
                self._monitors = None
                self._loans = None
                self._installments = None
                self._mutual_funds = None
                self._bank_accounts = None
                self._outbox = None

    async def commit(self) -> None:
        if self._session is not None:
            await self._session.commit()

    async def rollback(self) -> None:
        if self._session is not None:
            await self._session.rollback()
