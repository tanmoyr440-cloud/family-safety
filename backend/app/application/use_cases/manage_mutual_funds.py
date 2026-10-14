"""Use case: ManageMutualFunds."""

import uuid
from dataclasses import dataclass
from datetime import datetime

from app.application.ports.clock import Clock
from app.application.ports.mutual_fund_source import (
    MutualFundNavDTO,
    MutualFundSchemeDTO,
    MutualFundSource,
)
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.entities.mutual_fund_holding import MutualFundHolding


from app.application.ports.stock_quote_source import StockQuoteSource


@dataclass(frozen=True)
class MutualFundHoldingValuationDTO:
    """Holding with live SEBI/AMFI or NSE/BSE stock valuation details."""

    id: str
    owner_id: str
    scheme_code: int
    scheme_name: str
    fund_house: str
    units: float
    folio_masked: str | None
    latest_nav: float | None
    nav_date: str | None
    value_paise: int
    asset_type: str = "MUTUAL_FUND"
    isin: str | None = None
    created_at: datetime | None = None


class ManageMutualFunds:
    """Use case orchestrating mutual fund scheme searches, stock quotes, and owner holdings."""

    def __init__(
        self,
        uow: UnitOfWork,
        source: MutualFundSource,
        clock: Clock,
        stock_source: StockQuoteSource | None = None,
    ) -> None:
        self._uow = uow
        self._source = source
        self._clock = clock
        self._stock_source = stock_source

    async def search_schemes(self, query: str) -> list[MutualFundSchemeDTO]:
        """Search registered mutual fund schemes by query string."""
        return await self._source.search_schemes(query)

    async def get_scheme_nav(self, scheme_code: int) -> MutualFundNavDTO | None:
        """Fetch latest daily NAV and metadata for a scheme."""
        return await self._source.get_latest_nav(scheme_code)

    async def get_holdings_with_valuations(
        self, owner_id: str
    ) -> list[MutualFundHoldingValuationDTO]:
        """Fetch owner's registered holdings with live SEBI/AMFI and official stock valuations."""
        async with self._uow:
            holdings = await self._uow.mutual_funds.get_holdings_for_owner(owner_id)

        results: list[MutualFundHoldingValuationDTO] = []
        for h in holdings:
            latest_nav: float | None = None
            nav_date: str | None = None

            if h.asset_type == "STOCK":
                # 1. Query live stock quote feed (NSE / BSE / Yahoo Finance)
                if self._stock_source is not None:
                    quote = await self._stock_source.get_quote(isin=h.isin, name=h.scheme_name)
                    if quote:
                        latest_nav = quote.price
                        nav_date = quote.as_of

                # 2. For Demat Equity Funds / ETFs without live ticker, fall back to official AMFI NAV
                if latest_nav is None and h.scheme_code != 0:
                    nav_dto = await self._source.get_latest_nav(h.scheme_code)
                    if nav_dto:
                        latest_nav = nav_dto.nav
                        nav_date = nav_dto.nav_date
            else:
                nav_dto = await self._source.get_latest_nav(h.scheme_code)
                if nav_dto:
                    latest_nav = nav_dto.nav
                    nav_date = nav_dto.nav_date

            value_paise = h.calculate_value_paise(latest_nav) if latest_nav is not None else 0

            results.append(
                MutualFundHoldingValuationDTO(
                    id=h.id,
                    owner_id=h.owner_id,
                    scheme_code=h.scheme_code,
                    scheme_name=h.scheme_name,
                    fund_house=h.fund_house,
                    units=h.units,
                    folio_masked=h.folio_masked,
                    latest_nav=latest_nav,
                    nav_date=nav_date,
                    value_paise=value_paise,
                    asset_type=h.asset_type,
                    isin=h.isin,
                    created_at=h.created_at,
                )
            )
        return results

    async def add_holding(
        self,
        owner_id: str,
        scheme_code: int,
        units: float,
        folio_number: str | None = None,
    ) -> MutualFundHolding:
        """Register a new mutual fund holding and record scheme metadata."""
        # Query official metadata from SEBI/AMFI public API
        nav_info = await self._source.get_latest_nav(scheme_code)
        scheme_name = nav_info.scheme_name if nav_info else f"Scheme {scheme_code}"
        fund_house = nav_info.fund_house if nav_info else "Mutual Fund AMC"

        folio_masked = None
        if folio_number:
            clean_folio = folio_number.strip()
            if len(clean_folio) > 4:
                folio_masked = f"XXXX{clean_folio[-4:]}"
            else:
                folio_masked = clean_folio

        holding = MutualFundHolding(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            scheme_code=scheme_code,
            scheme_name=scheme_name,
            fund_house=fund_house,
            units=units,
            folio_masked=folio_masked,
            created_at=self._clock.now(),
        )

        async with self._uow:
            await self._uow.mutual_funds.save(holding)
            await self._uow.commit()

        return holding

    async def delete_holding(self, owner_id: str, holding_id: str) -> None:
        """Delete an existing mutual fund holding."""
        async with self._uow:
            holding = await self._uow.mutual_funds.get_by_id(holding_id)
            if holding and holding.owner_id == owner_id:
                await self._uow.mutual_funds.delete(holding_id)
                await self._uow.commit()

    async def delete_all_holdings(self, owner_id: str) -> int:
        """Delete all mutual fund holdings for an owner snapshot."""
        async with self._uow:
            count = await self._uow.mutual_funds.delete_for_owner(owner_id)
            await self._uow.commit()
            return count

