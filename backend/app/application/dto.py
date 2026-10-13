from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.domain.policies.escalation_policy import ChannelKind


@dataclass
class OutboxMessage:
    """Outbox queue entry for reliable, transactional delivery."""

    id: str
    dedupe_key: str
    channel: ChannelKind
    recipient: str
    template_id: str
    payload: dict[str, Any]
    next_attempt_at: datetime
    status: str = "PENDING"
    attempts: int = 0
    last_error: str | None = None
    sent_at: datetime | None = None


@dataclass(frozen=True)
class EvaluationReport:
    """Summary of a monitor evaluation execution."""

    owner_id: str
    current_stage: str
    messages_queued: int


@dataclass(frozen=True)
class LoanEvaluationReport:
    """Summary of a loan obligations evaluation execution."""

    loan_id: str
    actions_count: int
    messages_queued: int


@dataclass(frozen=True)
class EmergencyPacketDTO:
    """Assembled emergency packet presented to parents or downloaded."""

    owner_name: str
    explanation: str
    groww_holdings_summary: str
    loans: list[dict[str, Any]]
    document_manifest: list[dict[str, Any]]
    assembled_at: datetime
    bank_accounts: list[dict[str, Any]] = field(default_factory=list)
    version: str = "1.0"
