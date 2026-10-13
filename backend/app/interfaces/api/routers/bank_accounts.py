"""Bank accounts management router conforming to api-contract.md."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, status

from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.manage_bank_accounts import ManageBankAccounts
from app.domain.entities.owner import Owner
from app.interfaces.api.dependencies import get_current_owner, get_uow
from app.interfaces.api.errors import BadRequestException
from app.interfaces.api.schemas import (
    ActionResponse,
    AddBankAccountRequest,
    BankAccountResponse,
)


class SystemClock(Clock):
    """System clock provider."""

    def now(self) -> datetime:
        return datetime.now(UTC)


clock = SystemClock()
router = APIRouter(tags=["bank-accounts"])


@router.get(
    "/bank-accounts",
    response_model=list[BankAccountResponse],
    operation_id="listBankAccounts",
    summary="List registered savings and bank accounts",
)
async def list_bank_accounts(
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> list[BankAccountResponse]:
    """Retrieve all registered bank accounts for the authenticated owner."""
    use_case = ManageBankAccounts(uow=uow, clock=clock)
    accounts = await use_case.get_accounts(current_owner.id)
    return [
        BankAccountResponse(
            id=acc.id,
            bank_name=acc.bank_name,
            account_number_masked=acc.account_number_masked,
            ifsc_code=acc.ifsc_code,
            branch_name=acc.branch_name,
            account_type=acc.account_type,
            holder_name=acc.holder_name,
            created_at=acc.created_at,
        )
        for acc in accounts
    ]


@router.post(
    "/bank-accounts",
    response_model=BankAccountResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="addBankAccount",
    summary="Register a new savings or bank account",
)
async def add_bank_account(
    body: AddBankAccountRequest,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> BankAccountResponse:
    """Register bank account with validated IFSC and masked account number."""
    use_case = ManageBankAccounts(uow=uow, clock=clock)
    try:
        acc = await use_case.add_account(
            owner_id=current_owner.id,
            bank_name=body.bank_name,
            account_number=body.account_number,
            ifsc_code=body.ifsc_code,
            branch_name=body.branch_name,
            account_type=body.account_type,
            holder_name=body.holder_name,
        )
    except ValueError as exc:
        raise BadRequestException(str(exc)) from exc

    return BankAccountResponse(
        id=acc.id,
        bank_name=acc.bank_name,
        account_number_masked=acc.account_number_masked,
        ifsc_code=acc.ifsc_code,
        branch_name=acc.branch_name,
        account_type=acc.account_type,
        holder_name=acc.holder_name,
        created_at=acc.created_at,
    )


@router.delete(
    "/bank-accounts/{id}",
    response_model=ActionResponse,
    operation_id="deleteBankAccount",
    summary="Delete a registered bank account",
)
async def delete_bank_account(
    id: str,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> ActionResponse:
    """Remove a registered bank account."""
    use_case = ManageBankAccounts(uow=uow, clock=clock)
    await use_case.delete_account(owner_id=current_owner.id, account_id=id)
    return ActionResponse(message="Bank account deleted successfully.")
