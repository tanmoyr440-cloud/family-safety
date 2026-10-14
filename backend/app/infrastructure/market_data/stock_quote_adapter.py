"""Stock & Equity market quote adapter.

Fetches live market prices for Indian equities listed on the National Stock Exchange (NSE)
and Bombay Stock Exchange (BSE) using official ticker data and public market feeds.
Includes ISIN resolution, symbol mapping, in-memory TTL caching, and resilient fallbacks.
"""

from datetime import UTC, datetime
import re
import time
from typing import Any

import httpx
import structlog

from app.application.ports.stock_quote_source import StockQuoteDTO, StockQuoteSource

logger = structlog.get_logger(__name__)

# Fallback known ISIN -> (Symbol, Company Name) mappings for top Indian bluechips
_KNOWN_ISIN_MAP: dict[str, tuple[str, str]] = {
    "INE002A01018": ("RELIANCE", "Reliance Industries Limited"),
    "INE467B01029": ("TCS", "Tata Consultancy Services Limited"),
    "INE009A01021": ("INFY", "Infosys Limited"),
    "INE040A01034": ("HDFCBANK", "HDFC Bank Limited"),
    "INE090A01021": ("ICICIBANK", "ICICI Bank Limited"),
    "INE062A01020": ("SBIN", "State Bank of India"),
    "INE397D01024": ("BHARTIARTL", "Bharti Airtel Limited"),
    "INE154A01025": ("ITC", "ITC Limited"),
    "INE237A01028": ("KOTAKBANK", "Kotak Mahindra Bank Limited"),
    "INE018A01030": ("LT", "Larsen & Toubro Limited"),
    "INE238A01034": ("AXISBANK", "Axis Bank Limited"),
    "INE155A01022": ("TATAMOTORS", "Tata Motors Limited"),
    "INE585B01010": ("MARUTI", "Maruti Suzuki India Limited"),
    "INE075A01022": ("WIPRO", "Wipro Limited"),
    "INE296A01024": ("BAJFINANCE", "Bajaj Finance Limited"),
    "INE522F01014": ("COALINDIA", "Coal India Limited"),
    "INE752E01010": ("POWERGRID", "Power Grid Corporation of India Limited"),
    "INE733E01010": ("NTPC", "NTPC Limited"),
}


class StockQuoteAdapter(StockQuoteSource):
    """Adapter querying live stock quotes for NSE / BSE listed equities."""

    def __init__(
        self,
        timeout_seconds: float = 6.0,
        cache_ttl_seconds: int = 900,  # 15 minutes cache
    ) -> None:
        self._timeout = timeout_seconds
        self._cache_ttl = cache_ttl_seconds
        # In-memory quote cache: key -> (StockQuoteDTO, monotonic_timestamp)
        self._cache: dict[str, tuple[StockQuoteDTO, float]] = {}
        self._isin_db: Any = None
        self._init_isin_db()

    def _init_isin_db(self) -> None:
        try:
            from casparser_isin import ISINDb

            self._isin_db = ISINDb()
        except Exception as exc:
            logger.warning("Could not initialize casparser_isin ISINDb", error=str(exc))
            self._isin_db = None

    def resolve_symbol(
        self, isin: str | None, symbol: str | None = None, name: str | None = None
    ) -> tuple[str | None, str | None]:
        """Resolve ticker symbol and company name from ISIN or stock name."""
        if symbol:
            clean_sym = symbol.strip().upper().replace(".NS", "").replace(".BO", "")
            return clean_sym, name or clean_sym

        clean_isin = isin.strip().upper() if isin else None
        if clean_isin and clean_isin in _KNOWN_ISIN_MAP:
            sym, comp_name = _KNOWN_ISIN_MAP[clean_isin]
            return sym, comp_name

        if clean_isin and self._isin_db is not None:
            try:
                data = self._isin_db.isin_lookup(clean_isin)
                if data and data.symbol:
                    return str(data.symbol).strip().upper(), str(data.name or data.issuer or data.symbol)
            except Exception as exc:
                logger.debug("ISIN lookup failed in ISINDb", isin=clean_isin, error=str(exc))

        # Heuristic from name: if first token resembles a valid Indian ticker
        if name:
            clean_name = re.sub(
                r"\b(?:LTD|LIMITED|CORP|INDUSTRIES|ENTERPRISES|HOLDINGS|EQ|NEW|FV|RE\..*|RS\..*)\b.*$",
                "",
                name,
                flags=re.IGNORECASE,
            ).strip()
            tokens = clean_name.split()
            if tokens and len(tokens[0]) >= 2 and tokens[0].isalnum():
                return tokens[0].upper(), name

        return None, name

    async def get_quote(
        self,
        isin: str | None,
        symbol: str | None = None,
        name: str | None = None,
    ) -> StockQuoteDTO | None:
        """Fetch live quote for equity by ISIN or symbol."""
        resolved_sym, resolved_name = self.resolve_symbol(isin, symbol, name)
        if not resolved_sym:
            return None

        cache_key = (isin or resolved_sym).upper()
        now_mono = time.monotonic()
        if cache_key in self._cache:
            cached_dto, cached_time = self._cache[cache_key]
            if now_mono - cached_time < self._cache_ttl:
                return cached_dto

        # Query Yahoo Finance chart API for NSE (.NS), then BSE (.BO)
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
        }

        for exchange, ticker_suffix in [("NSE", ".NS"), ("BSE", ".BO")]:
            ticker = f"{resolved_sym}{ticker_suffix}"
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
            try:
                async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=True) as client:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code != 200:
                        continue

                    data = resp.json()
                    chart = data.get("chart") or {}
                    results = chart.get("result") or []
                    if not results or not isinstance(results, list):
                        continue

                    meta = results[0].get("meta") or {}
                    raw_price = meta.get("regularMarketPrice")
                    if raw_price is None or float(raw_price) <= 0:
                        continue

                    market_price = float(raw_price)
                    raw_time = meta.get("regularMarketTime")
                    if raw_time:
                        as_of_dt = datetime.fromtimestamp(int(raw_time), tz=UTC)
                        as_of_str = as_of_dt.strftime("%Y-%m-%d %H:%M UTC")
                    else:
                        as_of_str = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")

                    dto = StockQuoteDTO(
                        isin=isin,
                        symbol=resolved_sym,
                        company_name=resolved_name or resolved_sym,
                        exchange=exchange,
                        price=market_price,
                        as_of=as_of_str,
                    )
                    self._cache[cache_key] = (dto, now_mono)
                    return dto

            except Exception as exc:
                logger.debug(
                    "Stock quote fetch failed for ticker",
                    ticker=ticker,
                    error=str(exc),
                )
                continue

        return None
