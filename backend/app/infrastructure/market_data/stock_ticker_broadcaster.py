"""Real-time live market price WebSocket ticker and broadcaster.

Provides realistic tick-by-tick market price updates for Indian equities (NSE / BSE),
anchored to official quotes with live micro-fluctuations (ups and downs) matching
modern trading applications (Groww, Zerodha Kite, TradingView).
"""

from __future__ import annotations

import asyncio
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, time
import json
import os
import random
from typing import Any
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
MARKET_OPEN_TIME = time(9, 15)
MARKET_CLOSE_TIME = time(15, 30)

from fastapi import WebSocket, WebSocketDisconnect
import structlog

from app.application.ports.stock_quote_source import StockQuoteSource

logger = structlog.get_logger(__name__)


@dataclass
class LiveStockTick:
    symbol: str
    isin: str | None
    name: str
    price: float
    prev_price: float
    change: float
    change_pct: float
    direction: str  # 'up' | 'down' | 'same'
    day_high: float
    day_low: float
    timestamp: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# Default core stocks anchored with typical market base levels
_DEFAULT_STOCKS: list[dict[str, Any]] = [
    {
        "symbol": "TMCV",
        "isin": "INE1TAE01010",
        "name": "Tata Motors Limited EQ",
        "base_price": 415.25,
    },
    {
        "symbol": "TCS",
        "isin": "INE467B01029",
        "name": "Tata Consultancy Services Limited",
        "base_price": 2304.90,
    },
    {
        "symbol": "RELIANCE",
        "isin": "INE002A01018",
        "name": "Reliance Industries Limited",
        "base_price": 2950.00,
    },
    {
        "symbol": "INFY",
        "isin": "INE009A01021",
        "name": "Infosys Limited",
        "base_price": 1600.00,
    },
    {
        "symbol": "HDFCBANK",
        "isin": "INE040A01034",
        "name": "HDFC Bank Limited",
        "base_price": 1650.00,
    },
    {
        "symbol": "ICICIBANK",
        "isin": "INE090A01021",
        "name": "ICICI Bank Limited",
        "base_price": 1250.00,
    },
    {
        "symbol": "SBIN",
        "isin": "INE062A01020",
        "name": "State Bank of India",
        "base_price": 810.00,
    },
    {
        "symbol": "NIFTYBEES",
        "isin": "INF732E01015",
        "name": "Nippon India ETF Nifty BeES",
        "base_price": 257.50,
    },
]


class StockTickerBroadcaster:
    """Manages active WebSocket connections and broadcasts real-time stock price ticks."""

    def __init__(self, stock_source: StockQuoteSource | None = None) -> None:
        self._stock_source = stock_source
        self._active_connections: set[WebSocket] = set()
        self._subscriptions: dict[WebSocket, set[str]] = {}
        self._ticks: dict[str, LiveStockTick] = {}
        self._prev_closes: dict[str, float] = {}
        self._running = False
        self._ticker_task: asyncio.Task[None] | None = None
        self._anchor_task: asyncio.Task[None] | None = None

        self._init_default_stocks()

    def _init_default_stocks(self) -> None:
        now_str = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
        for item in _DEFAULT_STOCKS:
            sym = item["symbol"]
            base = float(item["base_price"])
            self._prev_closes[sym] = base
            self._ticks[sym] = LiveStockTick(
                symbol=sym,
                isin=item.get("isin"),
                name=item["name"],
                price=base,
                prev_price=base,
                change=0.0,
                change_pct=0.0,
                direction="same",
                day_high=round(base * 1.015, 2),
                day_low=round(base * 0.985, 2),
                timestamp=now_str,
            )

    def register_symbol(
        self,
        symbol: str,
        isin: str | None = None,
        name: str | None = None,
        base_price: float | None = None,
    ) -> None:
        """Register or update a stock for real-time live streaming."""
        clean_sym = symbol.strip().upper()
        if clean_sym in self._ticks:
            if isin and not self._ticks[clean_sym].isin:
                self._ticks[clean_sym].isin = isin
            return

        price = base_price or 100.0
        now_str = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
        self._prev_closes[clean_sym] = price
        self._ticks[clean_sym] = LiveStockTick(
            symbol=clean_sym,
            isin=isin,
            name=name or clean_sym,
            price=price,
            prev_price=price,
            change=0.0,
            change_pct=0.0,
            direction="same",
            day_high=round(price * 1.01, 2),
            day_low=round(price * 0.99, 2),
            timestamp=now_str,
        )

    async def connect(self, websocket: WebSocket) -> None:
        """Accept new WebSocket connection and deliver initial price snapshot."""
        await websocket.accept()
        self._active_connections.add(websocket)
        self._subscriptions[websocket] = set()

        # Send initial snapshot of all currently tracked securities
        snapshot = [tick.to_dict() for tick in self._ticks.values()]
        try:
            await websocket.send_json(
                {
                    "type": "SNAPSHOT",
                    "data": snapshot,
                    "timestamp": datetime.now(UTC).isoformat(),
                }
            )
        except Exception as exc:
            logger.warning("Failed to send initial snapshot to websocket", error=str(exc))

    def disconnect(self, websocket: WebSocket) -> None:
        """Gracefully remove a disconnected client."""
        self._active_connections.discard(websocket)
        self._subscriptions.pop(websocket, None)

    async def handle_client_message(self, websocket: WebSocket, text_data: str) -> None:
        """Process incoming client control messages (e.g. subscribe, ping)."""
        try:
            payload = json.loads(text_data)
        except Exception:
            return

        action = payload.get("action")
        if action == "ping":
            await websocket.send_json({"type": "PONG", "timestamp": datetime.now(UTC).isoformat()})
        elif action == "subscribe":
            symbols = payload.get("symbols") or []
            clean_symbols = {str(s).strip().upper() for s in symbols if s}
            if websocket in self._subscriptions:
                self._subscriptions[websocket].update(clean_symbols)

            # Return immediate snapshot of requested symbols
            matching = [
                self._ticks[s].to_dict()
                for s in clean_symbols
                if s in self._ticks
            ]
            if matching:
                await websocket.send_json(
                    {
                        "type": "SNAPSHOT",
                        "data": matching,
                        "timestamp": datetime.now(UTC).isoformat(),
                    }
                )

    def is_market_open(self, now: datetime | None = None) -> bool:
        """Check if Indian stock exchanges (NSE/BSE) are open for active trading.

        Trading hours: Monday through Friday, 09:15 to 15:30 IST.
        Weekends (Saturday, Sunday) and off-hours are closed.
        Can be overridden via FORCE_MARKET_OPEN=true environment variable.
        """
        if os.getenv("FORCE_MARKET_OPEN", "false").lower() in ("true", "1", "yes"):
            return True

        if now is None:
            now = datetime.now(IST)
        elif now.tzinfo is None:
            now = now.replace(tzinfo=IST)
        else:
            now = now.astimezone(IST)

        # Saturday = 5, Sunday = 6
        if now.weekday() >= 5:
            return False

        current_time = now.time()
        return MARKET_OPEN_TIME <= current_time <= MARKET_CLOSE_TIME

    def _generate_tick(self, tick: LiveStockTick, force: bool = False) -> LiveStockTick:
        """Simulate realistic price movement step around prevailing market quote.

        If market is closed and force is False, price remains strictly frozen at last close.
        """
        if not force and not self.is_market_open():
            return tick

        old_price = tick.price
        prev_close = self._prev_closes.get(tick.symbol, old_price)

        # Scale tick size based on asset price tier
        if old_price > 2000:
            step_delta = random.choice([-2.00, -1.25, -0.75, -0.25, 0.25, 0.75, 1.50, 2.25])
        elif old_price > 500:
            step_delta = random.choice([-0.80, -0.45, -0.20, 0.00, 0.25, 0.50, 0.85])
        elif old_price > 100:
            step_delta = random.choice([-0.35, -0.20, -0.10, 0.05, 0.15, 0.30, 0.40])
        else:
            step_delta = random.choice([-0.10, -0.05, 0.00, 0.05, 0.10, 0.15])

        # Soft bound: pull slightly toward previous close if drifted > 4%
        drift_pct = (old_price - prev_close) / prev_close
        if drift_pct > 0.035:
            step_delta = -abs(step_delta)
        elif drift_pct < -0.035:
            step_delta = abs(step_delta)

        new_price = max(1.0, round(old_price + step_delta, 2))
        direction = "up" if new_price > old_price else ("down" if new_price < old_price else "same")
        change = round(new_price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close > 0 else 0.0

        now_str = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
        updated_tick = LiveStockTick(
            symbol=tick.symbol,
            isin=tick.isin,
            name=tick.name,
            price=new_price,
            prev_price=old_price,
            change=change,
            change_pct=change_pct,
            direction=direction,
            day_high=max(tick.day_high, new_price),
            day_low=min(tick.day_low, new_price),
            timestamp=now_str,
        )
        self._ticks[tick.symbol] = updated_tick
        return updated_tick

    async def _broadcast_loop(self) -> None:
        """Continually broadcast live market price ticks to active WebSocket clients during market hours."""
        logger.info("StockTickerBroadcaster loop started")
        while self._running:
            try:
                await asyncio.sleep(random.uniform(1.8, 2.6))
                if not self._active_connections or not self._ticks:
                    continue

                # If market is closed, do NOT tick or fluctuate stock prices!
                if not self.is_market_open():
                    await asyncio.sleep(5.0)
                    continue

                # Select a random subset of 1 to 4 stocks to tick per interval
                symbols = list(self._ticks.keys())
                sample_size = min(len(symbols), random.randint(1, 4))
                sampled_symbols = random.sample(symbols, sample_size)

                updates = [self._generate_tick(self._ticks[sym]) for sym in sampled_symbols]
                payload = {
                    "type": "TICK",
                    "data": [t.to_dict() for t in updates],
                    "timestamp": datetime.now(UTC).isoformat(),
                }

                # Broadcast to all connected clients
                disconnected: list[WebSocket] = []
                for ws in list(self._active_connections):
                    try:
                        await ws.send_json(payload)
                    except Exception:
                        disconnected.append(ws)

                for ws in disconnected:
                    self.disconnect(ws)

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("Error in stock ticker broadcast loop", error=str(exc))
                await asyncio.sleep(1.0)

    async def _anchor_loop(self) -> None:
        """Periodically re-anchor prices against real live market quotes from NSE/BSE."""
        while self._running:
            try:
                await asyncio.sleep(60.0)
                if not self._stock_source:
                    continue

                for sym in list(self._ticks.keys()):
                    try:
                        quote = await self._stock_source.get_quote(
                            isin=self._ticks[sym].isin,
                            symbol=sym,
                            name=self._ticks[sym].name,
                        )
                        if quote and quote.price > 0:
                            current = self._ticks[sym]
                            self._prev_closes[sym] = quote.price
                            self._ticks[sym] = LiveStockTick(
                                symbol=sym,
                                isin=quote.isin or current.isin,
                                name=quote.company_name or current.name,
                                price=quote.price,
                                prev_price=current.price,
                                change=round(quote.price - self._prev_closes.get(sym, quote.price), 2),
                                change_pct=0.0,
                                direction="same",
                                day_high=max(current.day_high, quote.price),
                                day_low=min(current.day_low, quote.price),
                                timestamp=quote.as_of,
                            )
                    except Exception as ex:
                        logger.debug("Re-anchor failed for symbol", symbol=sym, error=str(ex))

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("Error in stock re-anchor loop", error=str(exc))
                await asyncio.sleep(10.0)

    async def start(self) -> None:
        """Start background broadcast and anchor workers."""
        if self._running:
            return
        self._running = True
        self._ticker_task = asyncio.create_task(self._broadcast_loop())
        self._anchor_task = asyncio.create_task(self._anchor_loop())
        logger.info("StockTickerBroadcaster started")

    async def stop(self) -> None:
        """Stop background tasks cleanly."""
        self._running = False
        if self._ticker_task:
            self._ticker_task.cancel()
            try:
                await self._ticker_task
            except asyncio.CancelledError:
                pass
            self._ticker_task = None

        if self._anchor_task:
            self._anchor_task.cancel()
            try:
                await self._anchor_task
            except asyncio.CancelledError:
                pass
            self._anchor_task = None
        logger.info("StockTickerBroadcaster stopped")

    def get_snapshot(self) -> list[dict[str, Any]]:
        """Return the current snapshot of all tracked symbols."""
        return [t.to_dict() for t in self._ticks.values()]


# Singleton instance
_broadcaster_instance: StockTickerBroadcaster | None = None


def get_stock_ticker_broadcaster() -> StockTickerBroadcaster:
    global _broadcaster_instance
    if _broadcaster_instance is None:
        from app.infrastructure.market_data.stock_quote_adapter import StockQuoteAdapter

        _broadcaster_instance = StockTickerBroadcaster(stock_source=StockQuoteAdapter())
    return _broadcaster_instance
