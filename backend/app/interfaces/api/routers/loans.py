"""Loan obligations and installments router conforming to api-contract.md."""

import uuid
from dataclasses import replace
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, status

from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.confirm_loan_payment import ConfirmLoanPayment
from app.domain.entities.loan import (
    Installment,
    InstallmentStatus,
    Loan,
)
from app.domain.entities.owner import Owner
from app.domain.value_objects.due_day import DueDay
from app.domain.value_objects.money import Money
from app.interfaces.api.dependencies import (
    get_current_owner,
    get_uow,
)
from app.interfaces.api.errors import (
    NotFoundException,
)
from app.interfaces.api.schemas import (
    CreateLoanRequest,
    InstallmentResponse,
    LoanResponse,
    MarkInstallmentPaidRequest,
    NextDueSchema,
    PaymentInstructionsSchema,
    UpdateLoanRequest,
)


class SystemClock(Clock):
    def now(self) -> datetime:
        return datetime.now(UTC)


clock = SystemClock()
router = APIRouter(tags=["loans"])


def _mask_account(raw_acc: str) -> str:
    """Mask account number showing only last 4 digits."""
    cleaned = raw_acc.strip()
    if len(cleaned) <= 4:
        return f"XXXX{cleaned}"
    return f"XXXX{cleaned[-4:]}"


def _calculate_next_due(
    loan: Loan,
    installments: list[Installment],
    now: datetime,
) -> NextDueSchema:
    """Calculate the next pending or upcoming due installment for a loan."""
    today = now.date()
    inst_by_ym = {inst.year_month: inst for inst in installments}

    # 1. First check if any past installments are unpaid/missed
    unpaid_past = [
        inst
        for inst in installments
        if inst.year_month < f"{today.year:04d}-{today.month:02d}"
        and inst.status != InstallmentStatus.PAID
    ]
    if unpaid_past:
        unpaid_past.sort(key=lambda i: i.due_date)
        earliest = unpaid_past[0]
        return NextDueSchema(
            year_month=earliest.year_month,
            due_date=earliest.due_date,
            status=earliest.status.value,
        )

    # 2. Check current month
    curr_ym = f"{today.year:04d}-{today.month:02d}"
    curr_inst = inst_by_ym.get(curr_ym)

    if curr_inst and curr_inst.status == InstallmentStatus.PAID:
        # Current month is already PAID! Advance month by month until we find an unpaid month
        test_year = today.year
        test_month = today.month
        while True:
            if test_month == 12:
                test_year += 1
                test_month = 1
            else:
                test_month += 1
            next_ym = f"{test_year:04d}-{test_month:02d}"
            next_due_date = loan.due_day.due_date_for(test_year, test_month)
            next_inst = inst_by_ym.get(next_ym)
            if not next_inst or next_inst.status != InstallmentStatus.PAID:
                status = "UPCOMING" if today <= next_due_date else "DUE"
                return NextDueSchema(
                    year_month=next_ym,
                    due_date=next_due_date,
                    status=status,
                )
    else:
        # Current month is NOT paid yet
        due_date = loan.due_day.due_date_for(today.year, today.month)
        grace_limit = due_date + timedelta(days=loan.grace_days)
        if curr_inst and curr_inst.status == InstallmentStatus.MISSED:
            status = "MISSED"
        elif today > grace_limit:
            status = "MISSED"
        elif today > due_date:
            status = "DUE"
        else:
            status = "UPCOMING"

        return NextDueSchema(
            year_month=curr_ym,
            due_date=due_date,
            status=status,
        )


def _map_loan(loan: Loan, installments: list[Installment] | None = None) -> LoanResponse:
    """Map domain Loan entity to LoanResponse DTO."""
    instructions = PaymentInstructionsSchema()
    now = clock.now()
    next_due = _calculate_next_due(loan, installments or [], now)
    has_unmasked = bool(
        loan.account_number
        and not loan.account_number.startswith("XXXX")
        and not loan.account_number.startswith("****")
    )

    return LoanResponse(
        id=loan.id,
        lender=loan.lender,
        account_number=loan.account_number,
        account_masked=loan.account_masked,
        has_unmasked_account=has_unmasked,
        emi_paise=loan.emi.paise,
        due_day=loan.due_day.value,
        grace_days=loan.grace_days,
        payment_instructions=instructions,
        next_due=next_due,
    )


def _map_installment(inst: Installment) -> InstallmentResponse:
    """Map domain Installment entity to InstallmentResponse DTO."""
    paid_at_dt = (
        datetime.combine(inst.paid_at, datetime.min.time(), tzinfo=UTC) if inst.paid_at else None
    )
    return InstallmentResponse(
        year_month=inst.year_month,
        due_date=inst.due_date,
        amount_paise=inst.amount.paise,
        status=inst.status.value,
        paid_at=paid_at_dt,
        evidence=None,
    )


@router.get(
    "/loans",
    response_model=list[LoanResponse],
    operation_id="listLoans",
    summary="List tracked loans",
)
async def list_loans(
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> list[LoanResponse]:
    """Retrieve all active loan obligations for current owner."""
    async with uow:
        loans = await uow.loans.get_loans_for_owner(current_owner.id)
        result: list[LoanResponse] = []
        for loan in loans:
            installments = await uow.installments.get_installments(loan.id)
            result.append(_map_loan(loan, installments))
    return result


@router.post(
    "/loans",
    response_model=LoanResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="createLoan",
    summary="Register a new loan obligation",
)
async def create_loan(
    body: CreateLoanRequest,
    _idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> LoanResponse:
    """Register loan obligation with EMI amount and due day."""
    loan_id = str(uuid.uuid4())
    masked = _mask_account(body.account_number)

    loan = Loan(
        id=loan_id,
        owner_id=current_owner.id,
        lender=body.lender,
        account_number=body.account_number,
        account_masked=masked,
        emi=Money(body.emi_paise),
        due_day=DueDay(body.due_day),
        grace_days=body.grace_days,
    )

    async with uow:
        await uow.loans.save(loan)
        now = clock.now()
        ym = f"{now.year:04d}-{now.month:02d}"
        due_date = loan.due_day.due_date_for(now.year, now.month)
        inst = Installment(
            loan_id=loan_id,
            year_month=ym,
            due_date=due_date,
            amount=loan.emi,
            status=InstallmentStatus.UPCOMING if now.date() <= due_date else InstallmentStatus.DUE,
        )
        await uow.installments.save(inst)
        await uow.commit()

    return _map_loan(loan, [inst])


@router.patch(
    "/loans/{id}",
    response_model=LoanResponse,
    operation_id="updateLoan",
    summary="Update loan details",
)
async def update_loan(
    id: str,
    body: UpdateLoanRequest,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> LoanResponse:
    """Update loan details."""
    async with uow:
        loan = await uow.loans.get_by_id(id)
        if not loan or loan.owner_id != current_owner.id:
            raise NotFoundException("Loan not found.")

        updated_lender = body.lender if body.lender is not None else loan.lender
        updated_emi = Money(body.emi_paise) if body.emi_paise is not None else loan.emi
        updated_due_day = DueDay(body.due_day) if body.due_day is not None else loan.due_day
        updated_grace = body.grace_days if body.grace_days is not None else loan.grace_days

        updated_account_num = loan.account_number
        updated_masked = loan.account_masked
        if body.account_number is not None:
            clean_acc = body.account_number.strip().replace(" ", "").replace("-", "")
            if clean_acc and not clean_acc.startswith("XXXX") and not clean_acc.startswith("****"):
                updated_account_num = clean_acc
                updated_masked = _mask_account(clean_acc)

        loan = replace(
            loan,
            lender=updated_lender,
            emi=updated_emi,
            due_day=updated_due_day,
            grace_days=updated_grace,
            account_number=updated_account_num,
            account_masked=updated_masked,
        )

        await uow.loans.save(loan)
        await uow.commit()
        installments = await uow.installments.get_installments(loan.id)

    return _map_loan(loan, installments)


@router.get(
    "/loans/{id}/installments",
    response_model=list[InstallmentResponse],
    operation_id="listLoanInstallments",
    summary="List installments for loan",
)
async def list_installments(
    id: str,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> list[InstallmentResponse]:
    """Retrieve installments recorded for a loan."""
    async with uow:
        loan = await uow.loans.get_by_id(id)
        if not loan or loan.owner_id != current_owner.id:
            raise NotFoundException("Loan not found.")
        installments = await uow.installments.get_installments(id)
        now = clock.now()
        today = now.date()
        ym = f"{now.year:04d}-{now.month:02d}"

        inst_by_ym = {i.year_month: i for i in installments}

        if not installments:
            due_date = loan.due_day.due_date_for(now.year, now.month)
            inst = Installment(
                loan_id=id,
                year_month=ym,
                due_date=due_date,
                amount=loan.emi,
                status=InstallmentStatus.UPCOMING if today <= due_date else InstallmentStatus.DUE,
            )
            await uow.installments.save(inst)
            await uow.commit()
            installments = [inst]
            inst_by_ym[ym] = inst

        # If current month installment is PAID, ensure next month installment exists!
        curr_inst = inst_by_ym.get(ym)
        if curr_inst and curr_inst.status == InstallmentStatus.PAID:
            next_year = now.year if now.month < 12 else now.year + 1
            next_month = now.month + 1 if now.month < 12 else 1
            next_ym = f"{next_year:04d}-{next_month:02d}"
            if next_ym not in inst_by_ym and loan.is_active_for_month(next_ym):
                next_due = loan.due_day.due_date_for(next_year, next_month)
                next_inst = Installment(
                    loan_id=id,
                    year_month=next_ym,
                    due_date=next_due,
                    amount=loan.emi,
                    status=InstallmentStatus.UPCOMING,
                )
                await uow.installments.save(next_inst)
                await uow.commit()
                installments.append(next_inst)

    installments.sort(key=lambda i: i.due_date, reverse=True)
    return [_map_installment(i) for i in installments]


@router.post(
    "/loans/{id}/installments/{yyyy_mm}/mark-paid",
    response_model=InstallmentResponse,
    operation_id="markLoanInstallmentPaid",
    summary="Mark loan installment as paid",
)
async def mark_installment_paid(
    id: str,
    yyyy_mm: str,
    _body: MarkInstallmentPaidRequest | None = None,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> InstallmentResponse:
    """Mark an installment as paid with payment evidence/reference."""
    async with uow:
        loan = await uow.loans.get_by_id(id)
        if not loan or loan.owner_id != current_owner.id:
            raise NotFoundException("Loan not found.")

    use_case = ConfirmLoanPayment(uow=uow, clock=clock)
    installment = await use_case.execute(
        loan_id=id,
        year_month=yyyy_mm,
        paid_at=clock.now().date(),
    )
    return _map_installment(installment)
