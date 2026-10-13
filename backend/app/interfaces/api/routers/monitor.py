"""Activity and Inactivity Monitor router conforming to api-contract.md."""

from datetime import UTC, datetime, time, timedelta

from fastapi import APIRouter, Depends

from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.pause_monitoring import PauseMonitoring
from app.application.use_cases.record_activity import RecordActivity
from app.domain.entities.inactivity_monitor import (
    InactivityConfig,
    InactivityMonitor,
    InactivityStage,
)
from app.domain.entities.owner import Owner
from app.interfaces.api.dependencies import (
    get_current_owner,
    get_uow,
    rate_limit_auth,
)
from app.interfaces.api.errors import (
    NotFoundException,
    ValidationException,
)
from app.interfaces.api.schemas import (
    ActionResponse,
    CheckInResponse,
    MonitorNextStage,
    MonitorStatusResponse,
    PauseMonitorRequest,
    UpdateMonitorConfigRequest,
)
from app.interfaces.api.security import (
    decode_checkin_token,
)


class SystemClock(Clock):
    """System clock provider."""

    def now(self) -> datetime:
        return datetime.now(UTC)


clock = SystemClock()
router = APIRouter(tags=["monitor"])


@router.post(
    "/activity/check-in",
    response_model=CheckInResponse,
    operation_id="recordCheckIn",
    summary="Record authenticated owner activity",
)
async def check_in(
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> CheckInResponse:
    """Record one-tap activity signal from authenticated owner."""
    use_case = RecordActivity(uow=uow, clock=clock)
    recorded_at = await use_case.execute(owner_id=current_owner.id)
    return CheckInResponse(recorded_at=recorded_at)


@router.post(
    "/activity/check-in/link/{token}",
    response_model=CheckInResponse,
    operation_id="recordCheckInMagicLink",
    summary="Record activity via magic check-in link",
    dependencies=[Depends(rate_limit_auth)],
)
async def check_in_magic_link(
    token: str,
    uow: UnitOfWork = Depends(get_uow),
) -> CheckInResponse:
    """Record activity using signed magic link token without requiring login."""
    owner_id = decode_checkin_token(token)
    use_case = RecordActivity(uow=uow, clock=clock)
    recorded_at = await use_case.execute(owner_id=owner_id)
    return CheckInResponse(recorded_at=recorded_at)


@router.get(
    "/monitor",
    response_model=MonitorStatusResponse,
    operation_id="getMonitor",
    summary="Get current monitor status",
)
async def get_monitor(
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> MonitorStatusResponse:
    """Return inactivity monitor configuration, status, and idle days."""
    now = clock.now()
    async with uow:
        monitor = await uow.monitors.get_for_owner(current_owner.id)
        if not monitor:
            # Create default monitor if one doesn't exist yet
            monitor = InactivityMonitor(
                owner_id=current_owner.id,
                started_at=now,
                last_activity_at=now,
            )
            await uow.monitors.save(monitor)
            await uow.commit()

    last_act = (
        monitor.last_activity_at.replace(tzinfo=UTC)
        if monitor.last_activity_at and monitor.last_activity_at.tzinfo is None
        else monitor.last_activity_at
    )
    paused_until = (
        monitor.paused_until.replace(tzinfo=UTC)
        if monitor.paused_until and monitor.paused_until.tzinfo is None
        else monitor.paused_until
    )
    is_paused = monitor.status == InactivityStage.PAUSED or (
        paused_until is not None and paused_until > now
    )
    days_idle = (now - last_act).days if last_act else 0

    status_str = "PAUSED" if is_paused else monitor.status.value

    # Compute next stage estimate
    next_stage: MonitorNextStage | None = None
    if not is_paused and monitor.last_activity_at:
        threshold = monitor.config.threshold_days
        warnings = list(monitor.config.warning_days)

        if days_idle < (warnings[0] if warnings else threshold):
            target_days = warnings[0] if warnings else threshold
            stage_name = "WARN_OWNER_1" if warnings else "NOTIFY_PARENTS"
            next_date = (monitor.last_activity_at + timedelta(days=target_days)).date()
            next_stage = MonitorNextStage(stage=stage_name, at=next_date)
        elif len(warnings) > 1 and days_idle < warnings[1]:
            next_date = (monitor.last_activity_at + timedelta(days=warnings[1])).date()
            next_stage = MonitorNextStage(stage="WARN_OWNER_2", at=next_date)
        elif days_idle < threshold:
            next_date = (monitor.last_activity_at + timedelta(days=threshold)).date()
            next_stage = MonitorNextStage(stage="NOTIFY_PARENTS", at=next_date)

    paused_until_date = monitor.paused_until.date() if is_paused and monitor.paused_until else None

    return MonitorStatusResponse(
        status=status_str,
        last_activity_at=monitor.last_activity_at,
        days_idle=max(0, days_idle),
        threshold_days=monitor.config.threshold_days,
        warning_days=list(monitor.config.warning_days),
        next_stage=next_stage,
        paused_until=paused_until_date,
        scheduler_healthy=True,
    )


@router.put(
    "/monitor/config",
    response_model=ActionResponse,
    operation_id="updateMonitorConfig",
    summary="Update monitor thresholds",
)
async def update_monitor_config(
    body: UpdateMonitorConfigRequest,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> ActionResponse:
    """Update warning and threshold day settings."""
    # Validate warning days are strictly ascending and strictly less than threshold
    for i, w in enumerate(body.warning_days):
        if w >= body.threshold_days:
            raise ValidationException(
                "Each warning day threshold must be strictly less than the final threshold days."
            )
        if i > 0 and w <= body.warning_days[i - 1]:
            raise ValidationException("Warning days must be provided in strictly ascending order.")

    new_config = InactivityConfig(
        threshold_days=body.threshold_days,
        warning_days=tuple(body.warning_days),
    )

    async with uow:
        monitor = await uow.monitors.get_for_owner(current_owner.id)
        if not monitor:
            raise NotFoundException("Monitor not found.")
        monitor.config = new_config
        await uow.monitors.save(monitor)
        await uow.commit()

    return ActionResponse(message="Monitor configuration updated.")


@router.post(
    "/monitor/pause",
    response_model=ActionResponse,
    operation_id="pauseMonitor",
    summary="Pause inactivity monitoring",
)
async def pause_monitor(
    body: PauseMonitorRequest,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> ActionResponse:
    """Pause monitoring until specified date."""
    pause_until_dt = datetime.combine(body.until, time(23, 59, 59, tzinfo=UTC))
    use_case = PauseMonitoring(uow=uow, clock=clock)
    await use_case.execute(owner_id=current_owner.id, until=pause_until_dt)
    return ActionResponse(message=f"Monitoring paused until {body.until.isoformat()}.")


@router.delete(
    "/monitor/pause",
    response_model=ActionResponse,
    operation_id="resumeMonitor",
    summary="Resume inactivity monitoring",
)
async def resume_monitor(
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> ActionResponse:
    """Resume paused monitoring."""
    async with uow:
        monitor = await uow.monitors.get_for_owner(current_owner.id)
        if not monitor:
            raise NotFoundException("Monitor not found.")
        monitor.status = InactivityStage.OK
        monitor.paused_until = None
        await uow.monitors.save(monitor)
        await uow.commit()

    return ActionResponse(message="Monitoring resumed.")
