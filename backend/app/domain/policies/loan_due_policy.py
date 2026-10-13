"""Loan due policy for evaluation of reminders, grace periods, and parent alerts."""

from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import StrEnum

from app.domain.entities.loan import (
    Installment,
    InstallmentStatus,
    Loan,
)
from app.domain.value_objects.money import Money


class LoanActionKind(StrEnum):
    """Types of loan actions produced by policy evaluation."""

    REMIND_OWNER = "REMIND_OWNER"
    WARN_OWNER_GRACE = "WARN_OWNER_GRACE"
    NOTIFY_PARENTS_MISSED = "NOTIFY_PARENTS_MISSED"
    NOTIFY_PARENTS_RESOLVED = "NOTIFY_PARENTS_RESOLVED"


@dataclass(frozen=True)
class LoanAction:
    """Action resulting from loan due policy evaluation."""

    kind: LoanActionKind
    days_until_due: int | None = None
    total_overdue_amount: Money | None = None
    unpaid_months: list[str] = field(default_factory=list)
    year_month: str | None = None


class LoanDuePolicy:
    """Pure domain policy evaluating loan installment status and required actions."""

    @classmethod
    def evaluate(
        cls,
        loan: Loan,
        installments: list[Installment],
        today: date,
    ) -> list[LoanAction]:
        """Evaluate installments against due date, grace period, and notification rules."""
        actions: list[LoanAction] = []
        missed_installments: list[Installment] = []

        for inst in installments:
            # Check for late resolution after parents were previously notified
            if (
                inst.status == InstallmentStatus.PAID
                and inst.parent_notified
                and not inst.resolved_notified
            ):
                actions.append(
                    LoanAction(
                        kind=LoanActionKind.NOTIFY_PARENTS_RESOLVED,
                        year_month=inst.year_month,
                    ),
                )
                continue

            if inst.status == InstallmentStatus.PAID:
                continue

            # Unpaid installment: evaluate timing
            grace_limit = inst.due_date + timedelta(days=loan.grace_days)

            if today > grace_limit:
                # Past due and past grace period -> mark missed
                inst.mark_missed()
                missed_installments.append(inst)
            elif today > inst.due_date and today <= grace_limit:
                # Inside grace period: nag owner only, do not alert parents yet
                actions.append(
                    LoanAction(
                        kind=LoanActionKind.WARN_OWNER_GRACE,
                        year_month=inst.year_month,
                    ),
                )
            elif today <= inst.due_date:
                days_until_due = (inst.due_date - today).days
                if days_until_due in loan.reminder_days_before:
                    actions.append(
                        LoanAction(
                            kind=LoanActionKind.REMIND_OWNER,
                            days_until_due=days_until_due,
                            year_month=inst.year_month,
                        ),
                    )

        # If any installments are missed, aggregate them into one parent message
        if missed_installments:
            total_amount = Money(0)
            unpaid_months: list[str] = []
            for m in missed_installments:
                total_amount = total_amount + m.amount
                unpaid_months.append(m.year_month)

            actions.append(
                LoanAction(
                    kind=LoanActionKind.NOTIFY_PARENTS_MISSED,
                    total_overdue_amount=total_amount,
                    unpaid_months=unpaid_months,
                ),
            )

        return actions
