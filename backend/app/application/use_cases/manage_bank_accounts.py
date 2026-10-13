"""Use case: ManageBankAccounts."""

import uuid

from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.entities.bank_account import (
    BankAccount,
    is_valid_ifsc,
    mask_bank_account_number,
    normalize_ifsc,
)


class ManageBankAccounts:
    """Use case orchestrating registration and management of owner's bank accounts."""

    def __init__(self, uow: UnitOfWork, clock: Clock) -> None:
        self._uow = uow
        self._clock = clock

    async def get_accounts(self, owner_id: str) -> list[BankAccount]:
        """Fetch all registered bank accounts for the given owner."""
        async with self._uow:
            return await self._uow.bank_accounts.get_accounts_for_owner(owner_id)

    async def add_account(
        self,
        owner_id: str,
        bank_name: str,
        account_number: str,
        ifsc_code: str,
        branch_name: str | None = None,
        account_type: str = "SAVINGS",
        holder_name: str | None = None,
    ) -> BankAccount:
        """Register a new bank account with validated IFSC and masked account number."""
        clean_bank_name = bank_name.strip()
        if not clean_bank_name:
            raise ValueError("Bank name is required.")

        clean_acc_num = account_number.strip().replace(" ", "").replace("-", "")
        if len(clean_acc_num) < 4:
            raise ValueError("Bank account number must be at least 4 digits.")

        clean_ifsc = normalize_ifsc(ifsc_code)
        if not is_valid_ifsc(clean_ifsc):
            raise ValueError(
                f"Invalid IFSC code '{ifsc_code}'. IFSC must be 11 characters (e.g. SBIN0001234 or HDFC0000001)."
            )

        account = BankAccount(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            bank_name=clean_bank_name,
            account_number_masked=mask_bank_account_number(clean_acc_num),
            ifsc_code=clean_ifsc,
            branch_name=branch_name.strip() if branch_name and branch_name.strip() else None,
            account_type=account_type.strip().upper() if account_type else "SAVINGS",
            holder_name=holder_name.strip() if holder_name and holder_name.strip() else None,
            created_at=self._clock.now(),
        )

        async with self._uow:
            await self._uow.bank_accounts.save(account)
            await self._uow.commit()

        return account

    async def delete_account(self, owner_id: str, account_id: str) -> None:
        """Delete an existing bank account owned by the caller."""
        async with self._uow:
            account = await self._uow.bank_accounts.get_by_id(account_id)
            if account and account.owner_id == owner_id:
                await self._uow.bank_accounts.delete(account_id)
                await self._uow.commit()
