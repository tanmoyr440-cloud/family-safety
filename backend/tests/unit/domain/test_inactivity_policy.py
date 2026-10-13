"""Unit tests for InactivityPolicy and boundaries."""

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.domain.entities.inactivity_monitor import (
    InactivityConfig,
    InactivityMonitor,
    InactivityStage,
)
from app.domain.errors import InvalidThresholds, PauseTooLong
from app.domain.policies.inactivity_policy import InactivityPolicy


class TestInactivityPolicyBoundaries:
    """Boundary tests specified in references/testing.md."""

    @pytest.fixture
    def default_config(self) -> InactivityConfig:
        return InactivityConfig(
            threshold_days=90,
            warning_days=(60, 80),
        )

    @pytest.mark.parametrize(
        ("days_idle", "expected_stage"),
        [
            (0, InactivityStage.OK),
            (1, InactivityStage.OK),
            (59, InactivityStage.OK),
            (60, InactivityStage.WARN_OWNER_1),
            (79, InactivityStage.WARN_OWNER_1),
            (80, InactivityStage.WARN_OWNER_2),
            (89, InactivityStage.WARN_OWNER_2),
            (90, InactivityStage.NOTIFY_PARENTS),
            (91, InactivityStage.NOTIFY_PARENTS),
            (365, InactivityStage.NOTIFY_PARENTS),
        ],
    )
    def test_inactivity_stage_boundaries(
        self,
        default_config: InactivityConfig,
        days_idle: int,
        expected_stage: InactivityStage,
    ) -> None:
        tz = ZoneInfo("Asia/Kolkata")
        base_time = datetime(2026, 1, 1, 10, 0, tzinfo=tz)
        now = base_time + timedelta(days=days_idle)

        stage = InactivityPolicy.evaluate(
            last_activity_at=base_time,
            now=now,
            config=default_config,
            paused_until=None,
            timezone=tz,
        )
        assert stage == expected_stage

    def test_timezone_calendar_day_calculation_ist(
        self,
    ) -> None:
        """Verify days_idle calculation accounts for owner's timezone around midnight IST."""

        tz = ZoneInfo("Asia/Kolkata")
        # 23:30 IST on Jan 1
        last_activity = datetime(2026, 1, 1, 23, 30, tzinfo=tz)
        # 00:30 IST on Jan 2 (1 hour elapsed, but 1 calendar day later across midnight)
        now = datetime(2026, 1, 2, 0, 30, tzinfo=tz)

        days = InactivityPolicy.compute_days_idle(
            last_activity_at=last_activity,
            now=now,
            timezone=tz,
        )
        assert days == 1

    def test_paused_monitor_evaluates_as_ok(
        self,
        default_config: InactivityConfig,
    ) -> None:
        """A paused monitor evaluates as OK while now < paused_until."""
        tz = ZoneInfo("Asia/Kolkata")
        last_activity = datetime(2026, 1, 1, 10, 0, tzinfo=tz)
        now = last_activity + timedelta(days=95)  # idle for 95 days
        paused_until = now + timedelta(days=5)

        stage = InactivityPolicy.evaluate(
            last_activity_at=last_activity,
            now=now,
            config=default_config,
            paused_until=paused_until,
            timezone=tz,
        )
        assert stage == InactivityStage.OK

    def test_after_pause_ends_idle_clock_restarts_from_pause_end(
        self,
        default_config: InactivityConfig,
    ) -> None:
        """After pause ends, idle clock restarts from the pause end."""
        tz = ZoneInfo("Asia/Kolkata")
        last_activity = datetime(2026, 1, 1, 10, 0, tzinfo=tz)
        pause_end = datetime(2026, 2, 1, 10, 0, tzinfo=tz)
        # 60 days after pause ended -> WARN_OWNER_1
        now = pause_end + timedelta(days=60)

        stage = InactivityPolicy.evaluate(
            last_activity_at=last_activity,
            now=now,
            config=default_config,
            paused_until=pause_end,
            timezone=tz,
        )
        assert stage == InactivityStage.WARN_OWNER_1


class TestInactivityMonitorAggregate:
    """Tests for InactivityMonitor aggregate root and invariants."""

    def test_invalid_config_warnings_exceed_threshold(self) -> None:
        with pytest.raises(InvalidThresholds):
            InactivityConfig(threshold_days=90, warning_days=(60, 95))

    def test_invalid_config_warnings_not_strictly_increasing(self) -> None:
        with pytest.raises(InvalidThresholds):
            InactivityConfig(threshold_days=90, warning_days=(80, 60))

    def test_pause_too_long_raises_error(self) -> None:
        now = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
        monitor = InactivityMonitor(
            owner_id="owner-123",
            started_at=now,
            last_activity_at=now,
        )
        with pytest.raises(PauseTooLong):
            monitor.pause(until=now + timedelta(days=61), now=now, max_pause_days=60)

    def test_activity_resets_stage_and_closes_episode(self) -> None:
        now = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
        monitor = InactivityMonitor(
            owner_id="owner-123",
            started_at=now,
            last_activity_at=now,
        )
        initial_episode = monitor.episode_id

        # Advance monitor into warning stage
        monitor.advance_stage(InactivityStage.WARN_OWNER_1)
        status_after_advance: InactivityStage = monitor.status
        assert status_after_advance == InactivityStage.WARN_OWNER_1

        # Record activity
        new_activity_time = now + timedelta(days=70)
        monitor.record_activity(new_activity_time)

        status_after_activity: InactivityStage = monitor.status
        assert status_after_activity == InactivityStage.OK
        assert monitor.last_activity_at == new_activity_time
        assert monitor.episode_id != initial_episode
