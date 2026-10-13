"""Use case: AssemblePacket."""

from typing import Any

from app.application.dto import EmergencyPacketDTO
from app.application.ports.clock import Clock
from app.application.ports.document_store import DocumentStore
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import DomainError


class AssemblePacket:
    """Assembles the emergency packet DTO with masked financial identifiers and document list."""

    def __init__(
        self,
        uow: UnitOfWork,
        clock: Clock,
        document_store: DocumentStore | None = None,
    ) -> None:
        self._uow = uow
        self._clock = clock
        self._document_store = document_store

    async def execute(self, owner_id: str) -> EmergencyPacketDTO:
        """Assemble emergency packet for owner."""
        now = self._clock.now()

        async with self._uow:
            owner = await self._uow.owners.get_by_id(owner_id)
            if owner is None:
                raise DomainError(f"Owner {owner_id} not found", code="OWNER_NOT_FOUND")

            loans = await self._uow.loans.get_loans_for_owner(owner_id)
            bank_accounts = await self._uow.bank_accounts.get_accounts_for_owner(owner_id)

            loan_data: list[dict[str, Any]] = [
                {
                    "lender": loan.lender,
                    "account_masked": loan.account_masked,
                    "emi_paise": loan.emi.paise,
                    "due_day": loan.due_day.value,
                    "grace_days": loan.grace_days,
                }
                for loan in loans
            ]

            bank_account_data: list[dict[str, Any]] = [
                {
                    "id": b.id,
                    "bank_name": b.bank_name,
                    "account_number_masked": b.account_number_masked,
                    "ifsc_code": b.ifsc_code,
                    "branch_name": b.branch_name,
                    "account_type": b.account_type,
                    "holder_name": b.holder_name,
                }
                for b in bank_accounts
            ]

        doc_data: list[dict[str, Any]] = []
        if self._document_store is not None:
            docs = await self._document_store.list_for_owner(owner_id)
            doc_data = [
                {
                    "id": d.id,
                    "title": d.title,
                    "file_name": d.file_name,
                    "file_size_bytes": d.file_size_bytes,
                }
                for d in docs
            ]

        return EmergencyPacketDTO(
            owner_name=owner.name,
            explanation=f"We have not been able to reach {owner.name}. Please check on them.",
            groww_holdings_summary="Stocks and Mutual Funds registered on Groww.",
            loans=loan_data,
            document_manifest=doc_data,
            assembled_at=now,
            bank_accounts=bank_account_data,
            version="1.0",
        )
