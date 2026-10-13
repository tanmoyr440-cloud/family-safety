"""Payment evidence source port protocol."""

from typing import Protocol


class PaymentEvidenceSource(Protocol):
    """Protocol for checking evidence of an EMI payment installment."""

    async def check_payment(self, loan_id: str, year_month: str) -> bool:
        """Check whether payment for the given installment is confirmed."""
        ...
