"""Bank account entity representing owner's registered bank accounts."""

import re
from dataclasses import dataclass
from datetime import datetime

IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")


def mask_bank_account_number(raw_account: str) -> str:
    """Mask sensitive bank account number to show only the trailing 4 digits."""
    clean = raw_account.strip().replace(" ", "").replace("-", "")
    if len(clean) <= 4:
        return clean
    return f"XXXX{clean[-4:]}"


def normalize_ifsc(ifsc: str) -> str:
    """Normalize IFSC code to uppercase alphanumeric."""
    return ifsc.strip().upper()


def is_valid_ifsc(ifsc: str) -> bool:
    """Validate 11-character Indian Financial System Code (IFSC) format."""
    normalized = normalize_ifsc(ifsc)
    return bool(IFSC_REGEX.match(normalized))


@dataclass
class BankAccount:
    """Owner's registered bank account for emergency dossier and family reference."""

    id: str
    owner_id: str
    bank_name: str
    account_number_masked: str
    ifsc_code: str
    branch_name: str | None = None
    account_type: str = "SAVINGS"
    holder_name: str | None = None
    created_at: datetime | None = None
