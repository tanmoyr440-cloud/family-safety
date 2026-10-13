"""Append-only audit event logging service."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import AuditEventModel


def _sanitize_metadata(metadata: dict[str, Any] | None) -> dict[str, Any]:
    """Redact sensitive fields from audit event metadata."""
    if not metadata:
        return {}
    sanitized: dict[str, Any] = {}
    sensitive_keys = {"token", "secret", "password", "otp", "key"}
    for k, v in metadata.items():
        if any(s in k.lower() for s in sensitive_keys):
            sanitized[k] = "[REDACTED]"
        else:
            sanitized[k] = v
    return sanitized


async def record_audit_event(
    session: AsyncSession,
    actor_type: str,
    action: str,
    subject_type: str,
    actor_id: str | None = None,
    subject_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> str:
    """Record an append-only audit event.

    Actor types: OWNER, PARENT, SYSTEM, ANONYMOUS
    """
    event_id = str(uuid.uuid4())
    event = AuditEventModel(
        id=event_id,
        at=datetime.now(UTC),
        actor_type=actor_type,
        actor_id=actor_id,
        action=action,
        subject_type=subject_type,
        subject_id=subject_id,
        metadata_json=_sanitize_metadata(metadata),
    )
    session.add(event)
    return event_id
