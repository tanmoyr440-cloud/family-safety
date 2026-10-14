"""Port protocol for fetching live official stock and equity market quotes."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class StockQuoteDTO:
    """Live equity/stock market quote details."""

    isin: str | None
    symbol: str
    company_name: str
    exchange: str
    price: float
    as_of: str


class StockQuoteSource(Protocol):
    """Protocol for querying stock/equity market prices."""

    async def get_quote(
        self,
        isin: str | None,
        symbol: str | None = None,
        name: str | None = None,
    ) -> StockQuoteDTO | None:
        """Fetch live quote for a given ISIN, ticker symbol, or stock name."""
        ...
