"""Loan and installment domain entities."""

from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from app.domain.value_objects.due_day import DueDay
from app.domain.value_objects.money import Money


class InstallmentStatus(StrEnum):
    """Lifecycle status of a monthly loan installment."""

    UPCOMING = "UPCOMING"
    DUE = "DUE"
    PAID = "PAID"
    MISSED = "MISSED"


@dataclass
class Installment:
    """Monthly installment obligation."""

    loan_id: str
    year_month: str
    due_date: date
    amount: Money
    status: InstallmentStatus = InstallmentStatus.UPCOMING
    paid_at: date | None = None
    parent_notified: bool = False
    resolved_notified: bool = False

    def mark_paid(self, paid_at: date) -> None:
        """Mark installment as paid idempotently. Double marking is a safe no-op."""
        if self.status == InstallmentStatus.PAID:
            return
        self.status = InstallmentStatus.PAID
        self.paid_at = paid_at

    def mark_missed(self) -> None:
        """Mark installment as missed."""
        self.status = InstallmentStatus.MISSED


@dataclass(frozen=True)
class Loan:
    """Loan obligation aggregate."""

    id: str
    owner_id: str
    lender: str
    account_masked: str
    emi: Money
    due_day: DueDay
    grace_days: int = 1
    first_installment_month: str = "2026-01"
    last_installment_month: str = "2026-12"
    reminder_days_before: tuple[int, ...] = (3, 1, 0)
    parent_repeat_every_days: int = 7

    def is_active_for_month(self, year_month: str) -> bool:
        """Return True if the loan is active for the given YYYY-MM month."""
        return self.first_installment_month <= year_month <= self.last_installment_month
