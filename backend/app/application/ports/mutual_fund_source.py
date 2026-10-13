"""Port protocol for fetching SEBI/AMFI mutual fund public data."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class MutualFundSchemeDTO:
    """Mutual fund scheme metadata from SEBI/AMFI registry."""

    scheme_code: int
    scheme_name: str


@dataclass(frozen=True)
class MutualFundNavDTO:
    """Daily Net Asset Value (NAV) details from SEBI/AMFI."""

    scheme_code: int
    scheme_name: str
    fund_house: str
    scheme_type: str | None
    scheme_category: str | None
    isin_growth: str | None
    nav: float
    nav_date: str


class MutualFundSource(Protocol):
    """Protocol for querying public SEBI/AMFI mutual fund data."""

    async def search_schemes(self, query: str) -> list[MutualFundSchemeDTO]:
        """Search registered mutual fund schemes by name or keywords."""
        ...

    async def get_latest_nav(self, scheme_code: int) -> MutualFundNavDTO | None:
        """Fetch latest daily NAV and scheme details for a scheme code."""
        ...
