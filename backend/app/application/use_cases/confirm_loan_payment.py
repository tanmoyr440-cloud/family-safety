"""Use case: ConfirmLoanPayment."""

from datetime import date
from zoneinfo import ZoneInfo

from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.entities.loan import Installment, InstallmentStatus
from app.domain.errors import InstallmentNotFound, LoanEnded


class ConfirmLoanPayment:
    """Confirms that a loan installment was paid.

    Marking an already paid installment is an idempotent no-op.
    """

    def __init__(self, uow: UnitOfWork, clock: Clock) -> None:
        self._uow = uow
        self._clock = clock

    async def execute(
        self,
        loan_id: str,
        year_month: str,
        paid_at: date | None = None,
    ) -> Installment:
        """Mark installment as paid."""
        now = self._clock.now()

        async with self._uow:
            loan = await self._uow.loans.get_by_id(loan_id)
            if loan is None:
                raise InstallmentNotFound(f"Loan {loan_id} not found")

            if not loan.is_active_for_month(year_month):
                raise LoanEnded(f"Loan {loan_id} is not active for {year_month}")

            owner = await self._uow.owners.get_by_id(loan.owner_id)
            tz_str = owner.timezone if owner else "Asia/Kolkata"
            payment_date = paid_at or now.astimezone(ZoneInfo(tz_str)).date()

            installment = await self._uow.installments.get_by_year_month(loan_id, year_month)
            if installment is None:
                # Parse year_month YYYY-MM to determine due date
                parts = year_month.split("-")
                year, month = int(parts[0]), int(parts[1])
                due_date = loan.due_day.due_date_for(year, month)
                installment = Installment(
                    loan_id=loan_id,
                    year_month=year_month,
                    due_date=due_date,
                    amount=loan.emi,
                    status=InstallmentStatus.UPCOMING,
                )

            installment.mark_paid(paid_at=payment_date)
            await self._uow.installments.save(installment)

            # Auto-provision next month installment cycle if active
            parts = year_month.split("-")
            year, month = int(parts[0]), int(parts[1])
            next_year = year if month < 12 else year + 1
            next_month = month + 1 if month < 12 else 1
            next_ym = f"{next_year:04d}-{next_month:02d}"
            if loan.is_active_for_month(next_ym):
                existing_next = await self._uow.installments.get_by_year_month(loan_id, next_ym)
                if existing_next is None:
                    next_due = loan.due_day.due_date_for(next_year, next_month)
                    next_inst = Installment(
                        loan_id=loan_id,
                        year_month=next_ym,
                        due_date=next_due,
                        amount=loan.emi,
                        status=InstallmentStatus.UPCOMING,
                    )
                    await self._uow.installments.save(next_inst)

            await self._uow.commit()

        return installment
