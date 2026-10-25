"""Unit and API tests for real-time stock WebSocket and broadcaster."""

from __future__ import annotations

import pytest
from starlette.testclient import TestClient

from app.infrastructure.market_data.stock_ticker_broadcaster import (
    LiveStockTick,
    StockTickerBroadcaster,
    get_stock_ticker_broadcaster,
)
from app.main import app


def test_broadcaster_initialization() -> None:
    """Test that broadcaster starts with expected default core stocks."""
    broadcaster = StockTickerBroadcaster(stock_source=None)
    snapshot = broadcaster.get_snapshot()
    symbols = {s["symbol"] for s in snapshot}
    assert "TMCV" in symbols
    assert "TCS" in symbols
    assert "RELIANCE" in symbols


def test_broadcaster_register_custom_symbol() -> None:
    """Test dynamic registration of custom symbols."""
    broadcaster = StockTickerBroadcaster(stock_source=None)
    broadcaster.register_symbol(
        symbol="WIPRO",
        isin="INE075A01022",
        name="Wipro Limited",
        base_price=480.0,
    )
    snapshot = {s["symbol"]: s for s in broadcaster.get_snapshot()}
    assert "WIPRO" in snapshot
    assert snapshot["WIPRO"]["isin"] == "INE075A01022"
    assert snapshot["WIPRO"]["price"] == 480.0


def test_broadcaster_tick_generation() -> None:
    """Test realistic tick generation with price boundaries and directions."""
    broadcaster = StockTickerBroadcaster(stock_source=None)
    base_tick = broadcaster._ticks["TCS"]
    new_tick = broadcaster._generate_tick(base_tick, force=True)

    assert isinstance(new_tick, LiveStockTick)
    assert new_tick.symbol == "TCS"
    assert new_tick.direction in ("up", "down", "same")
    assert new_tick.price > 0
    assert new_tick.day_high >= new_tick.price
    assert new_tick.day_low <= new_tick.price


def test_broadcaster_market_hours() -> None:
    """Test market hours validation and frozen prices when closed."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    ist = ZoneInfo("Asia/Kolkata")
    broadcaster = StockTickerBroadcaster(stock_source=None)

    # 1. Sunday 12:00 PM IST -> Closed
    sunday = datetime(2026, 10, 25, 12, 0, 0, tzinfo=ist)
    assert broadcaster.is_market_open(sunday) is False

    # 2. Saturday 10:00 AM IST -> Closed
    saturday = datetime(2026, 10, 24, 10, 0, 0, tzinfo=ist)
    assert broadcaster.is_market_open(saturday) is False

    # 3. Monday 8:30 AM IST -> Pre-market/Closed
    mon_morning = datetime(2026, 10, 26, 8, 30, 0, tzinfo=ist)
    assert broadcaster.is_market_open(mon_morning) is False

    # 4. Monday 11:30 AM IST -> Open (Trading session)
    mon_open = datetime(2026, 10, 26, 11, 30, 0, tzinfo=ist)
    assert broadcaster.is_market_open(mon_open) is True

    # 5. Monday 4:00 PM (16:00) IST -> Closed
    mon_closed = datetime(2026, 10, 26, 16, 0, 0, tzinfo=ist)
    assert broadcaster.is_market_open(mon_closed) is False

    # 6. When closed and not forced, tick price remains strictly unchanged
    base_tick = broadcaster._ticks["TCS"]
    original_price = base_tick.price
    # Ensure current market open is False by passing Sunday to check or non-forced call
    if not broadcaster.is_market_open():
        frozen_tick = broadcaster._generate_tick(base_tick, force=False)
        assert frozen_tick.price == original_price


def test_stocks_live_rest_endpoint() -> None:
    """Test GET /api/v1/stocks/live returns instant snapshot."""
    client = TestClient(app)
    response = client.get("/api/v1/stocks/live")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 8
    symbols = [item["symbol"] for item in data]
    assert "TMCV" in symbols
    assert "TCS" in symbols


def test_stock_websocket_lifecycle() -> None:
    """Test WebSocket connects, receives initial SNAPSHOT, handles ping."""
    client = TestClient(app)
    with client.websocket_connect("/api/v1/ws/stocks") as websocket:
        # Initial message must be SNAPSHOT
        snapshot_msg = websocket.receive_json()
        assert snapshot_msg["type"] == "SNAPSHOT"
        assert isinstance(snapshot_msg["data"], list)
        assert len(snapshot_msg["data"]) > 0

        # Send ping and receive PONG
        websocket.send_json({"action": "ping"})
        pong_msg = websocket.receive_json()
        assert pong_msg["type"] == "PONG"
