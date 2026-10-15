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
    new_tick = broadcaster._generate_tick(base_tick)

    assert isinstance(new_tick, LiveStockTick)
    assert new_tick.symbol == "TCS"
    assert new_tick.direction in ("up", "down", "same")
    assert new_tick.price > 0
    assert new_tick.day_high >= new_tick.price
    assert new_tick.day_low <= new_tick.price


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
