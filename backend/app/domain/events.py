"""Domain event definitions.

Plain immutable dataclasses representing domain occurrences.
"""

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class InactivityStageChanged:
    """Emitted when an owner's inactivity stage advances or resets."""

    owner_id: str
    episode_id: str
    old_stage: str
    new_stage: str
    occurred_at: datetime


@dataclass(frozen=True)
class InstallmentMissed:
    """Emitted when an installment becomes missed past due date and grace period."""

    loan_id: str
    year_month: str
    amount_paise: int
    due_date: str
    occurred_at: datetime


@dataclass(frozen=True)
class InstallmentPaid:
    """Emitted when an installment is marked paid."""

    loan_id: str
    year_month: str
    paid_at: str
    occurred_at: datetime


@dataclass(frozen=True)
class ContactVerified:
    """Emitted when a contact completes consent verification."""

    contact_id: str
    owner_id: str
    verified_at: datetime


@dataclass(frozen=True)
class MonitoringPaused:
    """Emitted when an owner pauses monitoring."""

    owner_id: str
    paused_until: datetime
    occurred_at: datetime


@dataclass(frozen=True)
class EscalationSkipped:
    """Emitted when an unverified contact is skipped during escalation."""

    contact_id: str
    owner_id: str
    reason: str
    occurred_at: datetime
