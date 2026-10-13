"""Persistence layer exports."""

from app.infrastructure.persistence.database import create_engine, create_session_factory
from app.infrastructure.persistence.models import (
    Base,
    ContactModel,
    InactivityMonitorModel,
    InstallmentModel,
    LoanModel,
    OutboxModel,
    OwnerModel,
)
from app.infrastructure.persistence.repositories import (
    SqlAlchemyContactRepository,
    SqlAlchemyInactivityMonitorRepository,
    SqlAlchemyInstallmentRepository,
    SqlAlchemyLoanRepository,
    SqlAlchemyOutboxRepository,
    SqlAlchemyOwnerRepository,
)
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork

__all__ = [
    "Base",
    "ContactModel",
    "InactivityMonitorModel",
    "InstallmentModel",
    "LoanModel",
    "OutboxModel",
    "OwnerModel",
    "SqlAlchemyContactRepository",
    "SqlAlchemyInactivityMonitorRepository",
    "SqlAlchemyInstallmentRepository",
    "SqlAlchemyLoanRepository",
    "SqlAlchemyOutboxRepository",
    "SqlAlchemyOwnerRepository",
    "SqlAlchemyUnitOfWork",
    "create_engine",
    "create_session_factory",
]
