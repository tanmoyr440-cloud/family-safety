from typing import Any

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_health_endpoint(client: AsyncClient) -> None:
    """Test root health endpoint returns ok status."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_api_v1_health_endpoint(client: AsyncClient) -> None:
    """Test /api/v1/health returns ok status."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_api_v1_scheduler_health_endpoint(
    client: AsyncClient,
    db_session_factory: Any,
) -> None:
    """Test /api/v1/health/scheduler returns ok status."""
    from app.interfaces.worker.heartbeat import record_heartbeat

    await record_heartbeat(db_session_factory, job_name="test_health_endpoint", success=True)
    response = await client.get("/api/v1/health/scheduler")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "heartbeat_at" in data
