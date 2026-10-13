"""Inactivity monitor entity and configuration."""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import StrEnum

from app.domain.errors import InvalidThresholds, PauseTooLong


class InactivityStage(StrEnum):
    """Stages of inactivity escalation."""

    OK = "OK"
    WARN_OWNER_1 = "WARN_OWNER_1"
    WARN_OWNER_2 = "WARN_OWNER_2"
    NOTIFY_PARENTS = "NOTIFY_PARENTS"
    PAUSED = "PAUSED"


@dataclass(frozen=True)
class InactivityConfig:
    """Inactivity evaluation configuration thresholds."""

    threshold_days: int = 90
    warning_days: tuple[int, ...] = (60, 80)

    def __post_init__(self) -> None:
        if self.threshold_days <= 0:
            raise InvalidThresholds("threshold_days must be positive")
        if not self.warning_days:
            raise InvalidThresholds("warning_days must not be empty")

        # Check strictly increasing and less than threshold
        prev = 0
        for w in self.warning_days:
            if w <= prev:
                raise InvalidThresholds(
                    f"warning_days must be strictly increasing, got {self.warning_days}",
                )
            if w >= self.threshold_days:
                raise InvalidThresholds(
                    f"Warning day {w} cannot be >= threshold {self.threshold_days}",
                )
            prev = w


@dataclass
class InactivityMonitor:
    """Aggregate root tracking owner investment activity and escalation episode."""

    owner_id: str
    started_at: datetime
    last_activity_at: datetime
    config: InactivityConfig = field(default_factory=InactivityConfig)
    status: InactivityStage = InactivityStage.OK
    episode_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    paused_until: datetime | None = None

    def record_activity(self, occurred_at: datetime) -> None:
        """Record a new activity signal. Resets stage to OK and opens a new episode if needed."""
        if occurred_at >= self.last_activity_at:
            self.last_activity_at = occurred_at

        # If previous status was an escalated stage, reset and rotate episode
        if self.status != InactivityStage.OK:
            self.status = InactivityStage.OK
            self.episode_id = str(uuid.uuid4())

    def advance_stage(self, new_stage: InactivityStage) -> None:
        """Advance monitor to a new escalation stage."""
        self.status = new_stage

    def pause(
        self,
        until: datetime,
        now: datetime,
        max_pause_days: int = 60,
    ) -> None:
        """Pause monitoring until a specific future date."""
        if until <= now:
            raise PauseTooLong("Pause end must be in the future")
        if (until - now) > timedelta(days=max_pause_days):
            raise PauseTooLong(
                f"Pause exceeds maximum allowed duration of {max_pause_days} days",
            )
        self.paused_until = until
        self.status = InactivityStage.PAUSED
