"""Health check endpoints."""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.interfaces.api.dependencies import get_session_factory
from app.interfaces.worker.heartbeat import check_scheduler_health

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    """Health check response payload."""

    status: str = Field(default="ok", description="Overall service status")
    version: str = Field(default="0.1.0", description="Backend version")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Current server timestamp in UTC",
    )


class SchedulerHealthResponse(BaseModel):
    """Scheduler health check response payload."""

    status: str = Field(default="ok", description="Scheduler status")
    heartbeat_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Last scheduler heartbeat timestamp in UTC",
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    operation_id="getHealth",
    summary="Service health check",
)
async def get_health() -> HealthResponse:
    """Return health status of the API service."""
    return HealthResponse()


@router.get(
    "/health/scheduler",
    response_model=SchedulerHealthResponse,
    operation_id="getSchedulerHealth",
    summary="Scheduler worker health check",
)
async def get_scheduler_health() -> Any:
    """Return health status of the background scheduler worker."""
    session_factory = get_session_factory()
    is_healthy, latest_success, detail = await check_scheduler_health(
        session_factory, max_stale_hours=36
    )

    if latest_success is None:
        # Default fresh state
        return SchedulerHealthResponse(status="ok", heartbeat_at=datetime.now(UTC))

    if not is_healthy:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "heartbeat_at": latest_success.isoformat(),
                "detail": detail or "Scheduler heartbeat stale (>36 hours).",
            },
        )

    return SchedulerHealthResponse(
        status="ok",
        heartbeat_at=latest_success,
    )
