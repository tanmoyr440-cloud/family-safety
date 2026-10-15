"""WebSocket router for real-time live stock market price feeds."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import structlog

from app.infrastructure.market_data.stock_ticker_broadcaster import (
    get_stock_ticker_broadcaster,
)

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["stocks"])


@router.websocket("/ws/stocks")
async def stock_ticks_websocket(websocket: WebSocket) -> None:
    """Real-time live market feed WebSocket connection for Indian equities.
    
    Streams live tick-by-tick price updates, direction ('up', 'down', 'same'),
    percentage change, and day high/low. Clients can also send {"action": "subscribe", "symbols": [...]}
    or {"action": "ping"}.
    """
    broadcaster = get_stock_ticker_broadcaster()
    await broadcaster.connect(websocket)
    try:
        while True:
            text_data = await websocket.receive_text()
            await broadcaster.handle_client_message(websocket, text_data)
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket)
    except Exception as exc:
        logger.debug("WebSocket client disconnected or exception occurred", error=str(exc))
        broadcaster.disconnect(websocket)


@router.get("/stocks/live", summary="Get current live stock market snapshot")
async def get_live_stocks() -> list[dict[str, Any]]:
    """Retrieve the current live price snapshot for all tracked stocks."""
    broadcaster = get_stock_ticker_broadcaster()
    return broadcaster.get_snapshot()
