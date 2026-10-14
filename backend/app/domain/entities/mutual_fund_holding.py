"""Mutual fund holding entity."""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class MutualFundHolding:
    """Owner's registered mutual fund investment for safety net tracking."""

    id: str
    owner_id: str
    scheme_code: int
    scheme_name: str
    fund_house: str
    units: float
    folio_masked: str | None = None
    asset_type: str = "MUTUAL_FUND"
    isin: str | None = None
    created_at: datetime | None = None

    def calculate_value_paise(self, nav: float | None) -> int:
        """Calculate current valuation in integer paise based on latest NAV or share price."""
        if nav is None or nav < 0 or self.units < 0:
            return 0
        return int(round(self.units * nav * 100))
