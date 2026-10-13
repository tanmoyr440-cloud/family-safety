"""Inactivity policy for deciding escalation stages based on idle days."""

from datetime import datetime
from zoneinfo import ZoneInfo

from app.domain.entities.inactivity_monitor import (
    InactivityConfig,
    InactivityStage,
)


class InactivityPolicy:
    """Pure domain policy evaluating investment inactivity stages."""

    @staticmethod
    def compute_days_idle(
        last_activity_at: datetime,
        now: datetime,
        timezone: ZoneInfo,
    ) -> int:
        """Compute calendar days idle based on owner's local timezone dates."""
        last_local = last_activity_at.astimezone(timezone)
        now_local = now.astimezone(timezone)

        delta = (now_local.date() - last_local.date()).days
        return max(0, delta)

    @classmethod
    def evaluate(
        cls,
        last_activity_at: datetime,
        now: datetime,
        config: InactivityConfig,
        paused_until: datetime | None,
        timezone: ZoneInfo,
    ) -> InactivityStage:
        """Evaluate current stage according to idle days and pause status.

        Rules:
        - While now < paused_until, stage is OK.
        - After pause ends, idle clock restarts from paused_until.
        - Whole days in owner's timezone dictate stage transitions:
            < warning_days[0] -> OK
            warning_days[0] .. warning_days[1]-1 -> WARN_OWNER_1
            warning_days[1] .. threshold_days-1 -> WARN_OWNER_2
            >= threshold_days -> NOTIFY_PARENTS
        """
        if paused_until is not None:
            if now < paused_until:
                return InactivityStage.OK
            effective_start = max(last_activity_at, paused_until)
        else:
            effective_start = last_activity_at

        days_idle = cls.compute_days_idle(effective_start, now, timezone)

        if days_idle >= config.threshold_days:
            return InactivityStage.NOTIFY_PARENTS

        w1 = config.warning_days[0]
        w2 = config.warning_days[1]

        if days_idle >= w2:
            return InactivityStage.WARN_OWNER_2
        if days_idle >= w1:
            return InactivityStage.WARN_OWNER_1

        return InactivityStage.OK
