"""Contract and unit tests for GrowwActivityAdapter.

Documentation Reference:
    https://groww.in/trade-api/docs/python-sdk

Invariants tested:
1. ActivitySignalSource port implementation returns UTC timestamp of most recent order.
2. Expired Groww authentication (GrowwAPIAuthenticationException or GrowwAPIAuthorisationException)
   falls back to returning None so monitoring defaults to manual check-ins without crashing.
3. Holdings refresh parses verified portfolio structures from recorded SDK responses.
4. When feature flag GROWW_ADAPTER_ENABLED is false, fetch_latest_activity returns None
   and refresh_holdings raises GrowwFeatureDisabledError without invoking SDK.
5. All tests use recorded response fixtures; zero live external network calls are made.
"""

import uuid
from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from growwapi import GrowwAPI
from growwapi.groww.exceptions import (
    GrowwAPIAuthenticationException,
    GrowwAPIAuthorisationException,
    GrowwAPIException,
)
from httpx import AsyncClient

from app.config import Settings
from app.infrastructure.groww.adapter import GrowwActivityAdapter
from app.infrastructure.groww.exceptions import (
    GrowwAuthenticationExpiredError,
    GrowwFeatureDisabledError,
)

RECORDED_ORDERS_PAYLOAD = {
    "order_list": [
        {
            "groww_order_id": "GROWW-ORD-001",
            "exchange_order_id": "NSE-9901",
            "order_status": "EXECUTED",
            "trading_symbol": "TCS",
            "created_at": "2026-09-01T09:30:00Z",
            "exchange_time": "2026-09-01T09:30:02Z",
        },
        {
            "groww_order_id": "GROWW-ORD-002",
            "exchange_order_id": "NSE-9902",
            "order_status": "EXECUTED",
            "trading_symbol": "INFY",
            "created_at": "2026-10-05T14:20:15Z",
            "exchange_time": "2026-10-05T14:20:16Z",
        },
        {
            "groww_order_id": "GROWW-ORD-003",
            "exchange_order_id": "NSE-9903",
            "order_status": "CANCELLED",
            "trading_symbol": "HDFCBANK",
            "created_at": "2026-09-20T11:00:00Z",
            "exchange_time": "2026-09-20T11:00:01Z",
        },
    ]
}

RECORDED_HOLDINGS_PAYLOAD = {
    "user_holdings": [
        {
            "isin": "INE467B01029",
            "trading_symbol": "TCS",
            "quantity": 10,
            "average_price": 3800.0,
            "close_price": 3900.0,
            "demat_type": "CDSL",
        },
        {
            "isin": "INE009A01021",
            "trading_symbol": "INFY",
            "quantity": 25,
            "average_price": 1750.0,
            "close_price": 1810.0,
            "demat_type": "CDSL",
        },
    ]
}


@pytest.fixture
def enabled_settings() -> Settings:
    """Settings instance with Groww feature flag enabled."""
    return Settings(
        groww_adapter_enabled=True,
        groww_api_key="mock_api_key",
        groww_api_secret="mock_secret",
        groww_api_totp="123456",
    )


@pytest.fixture
def disabled_settings() -> Settings:
    """Settings instance with Groww feature flag disabled."""
    return Settings(
        groww_adapter_enabled=False,
    )


@pytest.mark.asyncio
async def test_feature_flag_disabled(disabled_settings: Settings) -> None:
    """When feature flag is off, activity fetch returns None and refresh raises error."""
    mock_client = MagicMock(spec=GrowwAPI)
    adapter = GrowwActivityAdapter(config=disabled_settings, client=mock_client)

    assert not adapter.is_enabled

    # 1. Activity check returns None without contacting SDK
    latest_dt = await adapter.fetch_latest_activity("owner_123")
    assert latest_dt is None
    mock_client.get_order_list.assert_not_called()

    # 2. Holdings refresh raises GrowwFeatureDisabledError
    with pytest.raises(GrowwFeatureDisabledError):
        await adapter.refresh_holdings("owner_123")
    mock_client.get_holdings_for_user.assert_not_called()


@pytest.mark.asyncio
async def test_fetch_latest_activity_success(enabled_settings: Settings) -> None:
    """Verifies that the latest order timestamp is extracted and converted to UTC datetime."""
    mock_client = MagicMock(spec=GrowwAPI)
    mock_client.get_order_list.return_value = RECORDED_ORDERS_PAYLOAD

    adapter = GrowwActivityAdapter(config=enabled_settings, client=mock_client)
    latest_dt = await adapter.fetch_latest_activity("owner_123")

    mock_client.get_order_list.assert_called_once_with(page=0, page_size=25)
    assert latest_dt is not None
    # 2026-10-05T14:20:15Z is the latest timestamp in fixture
    expected_dt = datetime(2026, 10, 5, 14, 20, 15, tzinfo=UTC)
    assert latest_dt == expected_dt


@pytest.mark.asyncio
async def test_fetch_latest_activity_empty_orders(enabled_settings: Settings) -> None:
    """Verifies that an empty order list returns None."""
    mock_client = MagicMock(spec=GrowwAPI)
    mock_client.get_order_list.return_value = {"order_list": []}

    adapter = GrowwActivityAdapter(config=enabled_settings, client=mock_client)
    latest_dt = await adapter.fetch_latest_activity("owner_123")

    assert latest_dt is None


@pytest.mark.asyncio
async def test_fetch_latest_activity_auth_expired_fallback(
    enabled_settings: Settings,
) -> None:
    """When authentication has expired (401), adapter logs warning and returns None."""
    mock_client = MagicMock(spec=GrowwAPI)
    mock_client.get_order_list.side_effect = GrowwAPIAuthenticationException()

    adapter = GrowwActivityAdapter(config=enabled_settings, client=mock_client)
    latest_dt = await adapter.fetch_latest_activity("owner_123")

    # Graceful fallback to check-in monitoring
    assert latest_dt is None


@pytest.mark.asyncio
async def test_fetch_latest_activity_authorisation_failed_fallback(
    enabled_settings: Settings,
) -> None:
    """When authorization fails (403), adapter logs warning and returns None."""
    mock_client = MagicMock(spec=GrowwAPI)
    mock_client.get_order_list.side_effect = GrowwAPIAuthorisationException()

    adapter = GrowwActivityAdapter(config=enabled_settings, client=mock_client)
    latest_dt = await adapter.fetch_latest_activity("owner_123")

    assert latest_dt is None


@pytest.mark.asyncio
async def test_fetch_latest_activity_general_error_fallback(
    enabled_settings: Settings,
) -> None:
    """When an unexpected API failure occurs, adapter safely falls back to None."""
    mock_client = MagicMock(spec=GrowwAPI)
    mock_client.get_order_list.side_effect = GrowwAPIException(code="500", msg="Server Error")

    adapter = GrowwActivityAdapter(config=enabled_settings, client=mock_client)
    latest_dt = await adapter.fetch_latest_activity("owner_123")

    assert latest_dt is None


@pytest.mark.asyncio
async def test_refresh_holdings_success(enabled_settings: Settings) -> None:
    """Verifies that holdings snapshot is parsed and returned with count and timestamp."""
    mock_client = MagicMock(spec=GrowwAPI)
    mock_client.get_holdings_for_user.return_value = RECORDED_HOLDINGS_PAYLOAD

    adapter = GrowwActivityAdapter(config=enabled_settings, client=mock_client)
    result = await adapter.refresh_holdings("owner_123")

    mock_client.get_holdings_for_user.assert_called_once_with(timeout=10)
    assert result["holdings_count"] == 2
    assert len(result["holdings"]) == 2
    assert result["holdings"][0]["trading_symbol"] == "TCS"
    assert "refreshed_at" in result


@pytest.mark.asyncio
async def test_refresh_holdings_auth_expired(enabled_settings: Settings) -> None:
    """When authentication expires during holdings refresh, raises expired error."""
    mock_client = MagicMock(spec=GrowwAPI)
    mock_client.get_holdings_for_user.side_effect = GrowwAPIAuthenticationException()

    adapter = GrowwActivityAdapter(config=enabled_settings, client=mock_client)

    with pytest.raises(GrowwAuthenticationExpiredError):
        await adapter.refresh_holdings("owner_123")


@pytest.mark.asyncio
async def test_client_lazy_initialization(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verifies adapter resolves client via GrowwAPI.get_access_token when none injected."""
    cfg = Settings(
        groww_adapter_enabled=True,
        groww_api_key="real_api_key_123",
        groww_api_secret="secret_abc",
        groww_api_totp="654321",
    )

    token_mock = MagicMock(return_value="mock_jwt_token")
    monkeypatch.setattr(GrowwAPI, "get_access_token", token_mock)

    client_instance = MagicMock(spec=GrowwAPI)
    client_instance.get_order_list.return_value = {"order_list": []}

    mock_groww_cls = MagicMock()
    mock_groww_cls.get_access_token = token_mock
    mock_groww_cls.return_value = client_instance
    monkeypatch.setattr("app.infrastructure.groww.adapter.GrowwAPI", mock_groww_cls)

    adapter = GrowwActivityAdapter(config=cfg)
    result = await adapter.fetch_latest_activity("owner_123")

    assert result is None
    token_mock.assert_called_once_with(
        api_key="real_api_key_123",
        secret="secret_abc",
        totp="654321",
    )
    mock_groww_cls.assert_called_once_with(token="mock_jwt_token")


@pytest.mark.asyncio
async def test_api_refresh_holdings_flow(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verifies POST /accounts/groww/refresh-holdings under enabled, disabled, and expired auth."""
    from app.config import settings

    # Register and authenticate
    tag = str(uuid.uuid4())[:8]
    email = f"groww_owner_{tag}@example.com"
    payload = {
        "name": "Groww Owner",
        "email": email,
        "phone": "+919876543210",
        "password": "Password123!",
    }
    reg_resp = await client.post("/api/v1/auth/register", json=payload)
    assert reg_resp.status_code == 201
    csrf = reg_resp.cookies["csrf_token"]
    client.cookies.set("access_token", reg_resp.cookies["access_token"])
    headers = {"X-CSRF-Token": csrf}

    # 1. Feature disabled -> 400 FEATURE_DISABLED
    monkeypatch.setattr(settings, "groww_adapter_enabled", False)
    disabled_resp = await client.post("/api/v1/accounts/groww/refresh-holdings", headers=headers)
    assert disabled_resp.status_code == 400
    assert disabled_resp.json()["code"] == "FEATURE_DISABLED"

    # 2. Feature enabled and auth expired -> 401 GROWW_AUTH_EXPIRED
    monkeypatch.setattr(settings, "groww_adapter_enabled", True)

    async def _mock_expired(*_args, **_kwargs):
        raise GrowwAuthenticationExpiredError("Expired")

    monkeypatch.setattr(GrowwActivityAdapter, "refresh_holdings", _mock_expired)
    expired_resp = await client.post("/api/v1/accounts/groww/refresh-holdings", headers=headers)
    assert expired_resp.status_code == 401
    assert expired_resp.json()["code"] == "GROWW_AUTH_EXPIRED"

    # 3. Feature enabled and success -> 200
    async def _mock_success(*_args, **_kwargs):
        return {"holdings": [], "holdings_count": 0, "refreshed_at": "2026-10-11T12:00:00Z"}

    monkeypatch.setattr(GrowwActivityAdapter, "refresh_holdings", _mock_success)
    success_resp = await client.post("/api/v1/accounts/groww/refresh-holdings", headers=headers)
    assert success_resp.status_code == 200
    assert success_resp.json()["success"] is True
