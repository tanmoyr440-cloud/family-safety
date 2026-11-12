"""Insurance policy entity representing owner's life, health, and general insurance policies."""

from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum


class PolicyType(StrEnum):
    """Recognized insurance policy categories."""

    HEALTH = "HEALTH"
    TERM_LIFE = "TERM_LIFE"
    MOTOR = "MOTOR"
    CRITICAL_ILLNESS = "CRITICAL_ILLNESS"
    OTHER = "OTHER"


def mask_policy_number(raw_policy: str) -> str:
    """Mask sensitive policy number showing only trailing characters."""
    clean = raw_policy.strip().replace(" ", "").replace("-", "")
    if len(clean) <= 4:
        return clean
    return f"XXXX{clean[-4:]}"


@dataclass
class InsurancePolicy:
    """Owner's registered insurance policy for emergency packet and cashless claim hub."""

    id: str
    owner_id: str
    policy_name: str
    policy_type: str
    policy_number: str
    policy_number_masked: str
    insurer_name: str
    sum_insured_paise: int
    premium_amount_paise: int | None = None
    premium_due_date: date | None = None
    cashless_tpa_name: str | None = None
    tpa_id_number: str | None = None
    emergency_helpline: str | None = None
    claim_email: str | None = None
    nominee_name: str | None = None
    nominee_relation: str | None = None
    hospital_cashless_notes: str | None = None
    created_at: datetime | None = None
