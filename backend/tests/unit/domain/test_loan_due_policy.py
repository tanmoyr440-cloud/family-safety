"""Unit tests for LoanDuePolicy and loan boundaries."""

from datetime import date

from app.domain.entities.loan import (
    Installment,
    InstallmentStatus,
    Loan,
)
from app.domain.policies.loan_due_policy import (
    LoanActionKind,
    LoanDuePolicy,
)
from app.domain.value_objects.due_day import DueDay
from app.domain.value_objects.money import Money


def create_sample_loan(grace_days: int = 1) -> Loan:
    return Loan(
        id="loan-1",
        owner_id="owner-1",
        lender="HDFC Bank",
        account_masked="XXXX1234",
        emi=Money(1_616_600),
        due_day=DueDay(24),
        grace_days=grace_days,
        first_installment_month="2026-01",
        last_installment_month="2026-12",
        reminder_days_before=(3, 1, 0),
        parent_repeat_every_days=7,
    )


class TestLoanDuePolicyBoundaries:
    """Boundary tests for loan EMI due dates, grace periods, and escalation."""

    def test_paid_on_23rd_and_24th_triggers_no_actions(self) -> None:
        loan = create_sample_loan(grace_days=1)
        installment = Installment(
            loan_id=loan.id,
            year_month="2026-10",
            due_date=date(2026, 10, 24),
            amount=loan.emi,
            status=InstallmentStatus.PAID,
            paid_at=date(2026, 10, 23),
        )

        actions = LoanDuePolicy.evaluate(
            loan=loan,
            installments=[installment],
            today=date(2026, 10, 24),
        )
        assert len(actions) == 0

    def test_unpaid_on_21st_triggers_owner_reminder_3_days_before(self) -> None:
        loan = create_sample_loan(grace_days=1)
        installment = Installment(
            loan_id=loan.id,
            year_month="2026-10",
            due_date=date(2026, 10, 24),
            amount=loan.emi,
            status=InstallmentStatus.UPCOMING,
        )

        actions = LoanDuePolicy.evaluate(
            loan=loan,
            installments=[installment],
            today=date(2026, 10, 21),
        )
        assert len(actions) == 1
        assert actions[0].kind == LoanActionKind.REMIND_OWNER
        assert actions[0].days_until_due == 3

    def test_unpaid_on_23rd_triggers_owner_reminder_1_day_before(self) -> None:
        loan = create_sample_loan(grace_days=1)
        installment = Installment(
            loan_id=loan.id,
            year_month="2026-10",
            due_date=date(2026, 10, 24),
            amount=loan.emi,
            status=InstallmentStatus.UPCOMING,
        )

        actions = LoanDuePolicy.evaluate(
            loan=loan,
            installments=[installment],
            today=date(2026, 10, 23),
        )
        assert len(actions) == 1
        assert actions[0].kind == LoanActionKind.REMIND_OWNER
        assert actions[0].days_until_due == 1

    def test_unpaid_on_24th_due_date_triggers_owner_due_reminder(self) -> None:
        loan = create_sample_loan(grace_days=1)
        installment = Installment(
            loan_id=loan.id,
            year_month="2026-10",
            due_date=date(2026, 10, 24),
            amount=loan.emi,
            status=InstallmentStatus.DUE,
        )

        actions = LoanDuePolicy.evaluate(
            loan=loan,
            installments=[installment],
            today=date(2026, 10, 24),
        )
        assert len(actions) == 1
        assert actions[0].kind == LoanActionKind.REMIND_OWNER
        assert actions[0].days_until_due == 0

    def test_unpaid_on_25th_with_grace_1_triggers_owner_grace_nagging(self) -> None:
        loan = create_sample_loan(grace_days=1)
        installment = Installment(
            loan_id=loan.id,
            year_month="2026-10",
            due_date=date(2026, 10, 24),
            amount=loan.emi,
            status=InstallmentStatus.DUE,
        )

        # 25th is within 1 day grace
        actions = LoanDuePolicy.evaluate(
            loan=loan,
            installments=[installment],
            today=date(2026, 10, 25),
        )
        assert len(actions) == 1
        assert actions[0].kind == LoanActionKind.WARN_OWNER_GRACE
        assert installment.status != InstallmentStatus.MISSED

    def test_unpaid_on_26th_with_grace_1_triggers_missed_and_notify_parents(self) -> None:
        loan = create_sample_loan(grace_days=1)
        installment = Installment(
            loan_id=loan.id,
            year_month="2026-10",
            due_date=date(2026, 10, 24),
            amount=loan.emi,
            status=InstallmentStatus.DUE,
        )

        # 26th is past 1 day grace -> MISSED -> NOTIFY_PARENTS
        actions = LoanDuePolicy.evaluate(
            loan=loan,
            installments=[installment],
            today=date(2026, 10, 26),
        )
        assert len(actions) == 1
        assert actions[0].kind == LoanActionKind.NOTIFY_PARENTS_MISSED
        assert actions[0].total_overdue_amount == Money(1_616_600)

    def test_grace_0_unpaid_on_25th_triggers_notify_parents(self) -> None:
        loan = create_sample_loan(grace_days=0)
        installment = Installment(
            loan_id=loan.id,
            year_month="2026-10",
            due_date=date(2026, 10, 24),
            amount=loan.emi,
            status=InstallmentStatus.DUE,
        )

        # With grace 0, 25th is already past due date + 0
        actions = LoanDuePolicy.evaluate(
            loan=loan,
            installments=[installment],
            today=date(2026, 10, 25),
        )
        assert len(actions) == 1
        assert actions[0].kind == LoanActionKind.NOTIFY_PARENTS_MISSED

    def test_two_consecutive_unpaid_months_aggregated_into_one_action(self) -> None:
        loan = create_sample_loan(grace_days=1)
        inst1 = Installment(
            loan_id=loan.id,
            year_month="2026-09",
            due_date=date(2026, 9, 24),
            amount=loan.emi,
            status=InstallmentStatus.MISSED,
        )
        inst2 = Installment(
            loan_id=loan.id,
            year_month="2026-10",
            due_date=date(2026, 10, 24),
            amount=loan.emi,
            status=InstallmentStatus.MISSED,
        )

        actions = LoanDuePolicy.evaluate(
            loan=loan,
            installments=[inst1, inst2],
            today=date(2026, 10, 26),
        )
        assert len(actions) == 1
        action = actions[0]
        assert action.kind == LoanActionKind.NOTIFY_PARENTS_MISSED
        # 1616600 * 2 = 3233200 paise
        assert action.total_overdue_amount == Money(3_233_200)
        assert action.unpaid_months == ["2026-09", "2026-10"]

    def test_paid_late_after_parent_notification_triggers_resolved_action(self) -> None:
        loan = create_sample_loan(grace_days=1)
        installment = Installment(
            loan_id=loan.id,
            year_month="2026-10",
            due_date=date(2026, 10, 24),
            amount=loan.emi,
            status=InstallmentStatus.PAID,
            paid_at=date(2026, 10, 28),
            parent_notified=True,
            resolved_notified=False,
        )

        actions = LoanDuePolicy.evaluate(
            loan=loan,
            installments=[installment],
            today=date(2026, 10, 29),
        )
        assert len(actions) == 1
        assert actions[0].kind == LoanActionKind.NOTIFY_PARENTS_RESOLVED
        assert actions[0].year_month == "2026-10"

    def test_marking_already_paid_installment_is_idempotent_no_op(self) -> None:
        loan = create_sample_loan(grace_days=1)
        installment = Installment(
            loan_id=loan.id,
            year_month="2026-10",
            due_date=date(2026, 10, 24),
            amount=loan.emi,
            status=InstallmentStatus.PAID,
            paid_at=date(2026, 10, 23),
        )

        # Marking as paid again does not raise error and preserves paid_at
        installment.mark_paid(paid_at=date(2026, 10, 25))
        assert installment.paid_at == date(2026, 10, 23)

    def test_no_installments_beyond_last_installment_month(self) -> None:
        loan = create_sample_loan(grace_days=1)
        # loan last installment month is 2026-12
        assert loan.is_active_for_month("2026-12") is True
        assert loan.is_active_for_month("2027-01") is False
