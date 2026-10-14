"""Unit tests for ImportCas use case."""

from datetime import UTC, datetime
from unittest.mock import patch

import pytest

from app.application.ports.mutual_fund_source import (
    MutualFundNavDTO,
    MutualFundSchemeDTO,
    MutualFundSource,
)
from app.application.use_cases.import_cas import ImportCas
from app.infrastructure.cas.cas_parser import ParsedCasHolding
from tests.fakes.fake_clock import FakeClock
from tests.fakes.in_memory_uow import InMemoryUnitOfWork


class FakeMutualFundSource(MutualFundSource):
    """Fake SEBI/AMFI source for use case testing."""

    def __init__(self) -> None:
        self.schemes: list[MutualFundSchemeDTO] = [
            MutualFundSchemeDTO(scheme_code=130501, scheme_name="HDFC Small Cap Fund - Regular Plan - IDCW"),
            MutualFundSchemeDTO(scheme_code=130502, scheme_name="HDFC Small Cap Fund - Regular Plan - Growth"),
            MutualFundSchemeDTO(scheme_code=130503, scheme_name="HDFC Small Cap Fund - Direct Plan - Growth"),
        ]

    async def search_schemes(self, query: str) -> list[MutualFundSchemeDTO]:
        q = query.upper()
        return [s for s in self.schemes if all(w in s.scheme_name.upper() for w in q.split()[:2])]

    async def get_latest_nav(self, scheme_code: int) -> MutualFundNavDTO | None:
        if scheme_code == 102414:
            return MutualFundNavDTO(
                scheme_code=102414,
                scheme_name="SBI Contra Fund - Regular Plan - Growth",
                fund_house="SBI Mutual Fund",
                scheme_type="Open Ended Schemes",
                scheme_category="Equity - Contra",
                isin_growth="INF200K01362",
                nav=412.50,
                nav_date="2026-01-15",
            )
        return MutualFundNavDTO(
            scheme_code=scheme_code,
            scheme_name="HDFC Small Cap Fund - Direct Plan - Growth",
            fund_house="HDFC Mutual Fund",
            scheme_type="Open Ended Schemes",
            scheme_category="Equity - Small Cap",
            isin_growth="INF179K01BE2",
            nav=145.50,
            nav_date="2026-01-15",
        )


@pytest.fixture
def uow() -> InMemoryUnitOfWork:
    return InMemoryUnitOfWork()


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock(datetime(2026, 1, 15, 10, 0, tzinfo=UTC))


@pytest.fixture
def source() -> FakeMutualFundSource:
    return FakeMutualFundSource()


@pytest.mark.asyncio
async def test_import_cas_empty(uow: InMemoryUnitOfWork, clock: FakeClock, source: FakeMutualFundSource) -> None:
    use_case = ImportCas(uow=uow, source=source, clock=clock)
    with patch("app.application.use_cases.import_cas.CasParser.parse_pdf", return_value=[]):
        summary = await use_case.execute(owner_id="owner-1", pdf_bytes=b"%PDF-mock")
        assert summary.imported_count == 0
        assert summary.holdings == []


@pytest.mark.asyncio
async def test_import_cas_cdsl_mixed_portfolio(
    uow: InMemoryUnitOfWork, clock: FakeClock, source: FakeMutualFundSource
) -> None:
    use_case = ImportCas(uow=uow, source=source, clock=clock)

    mock_parsed = [
        ParsedCasHolding(
            scheme_name="RELIANCE INDUSTRIES LTD",
            units=10.0,
            folio="1208160012345678",
            isin="INE002A01018",
        ),
        ParsedCasHolding(
            scheme_name="HDFC Small Cap Fund - Direct Plan - Growth",
            units=250.5,
            folio="1208160012345678",
            isin="INF179K01BE2",
        ),
    ]

    with patch("app.application.use_cases.import_cas.CasParser.parse_pdf", return_value=mock_parsed):
        summary = await use_case.execute(owner_id="owner-1", pdf_bytes=b"%PDF-mock", password="ABCDE1234F")

        assert summary.imported_count == 2
        assert uow.committed is True

        # Check Demat Equity
        reliance = next(h for h in summary.holdings if "RELIANCE" in h.scheme_name)
        assert reliance.fund_house == "CDSL Demat Equity"
        assert reliance.units == 10.0
        assert reliance.folio_masked == "XXXX5678"

        # Check Mutual Fund
        hdfc = next(h for h in summary.holdings if "HDFC" in h.scheme_name)
        assert hdfc.fund_house == "HDFC Mutual Fund"
        assert hdfc.scheme_code == 130503  # Direct Plan picked!
        assert hdfc.units == 250.5
        assert hdfc.folio_masked == "XXXX5678"


@pytest.mark.asyncio
async def test_import_cas_updates_existing_units(
    uow: InMemoryUnitOfWork, clock: FakeClock, source: FakeMutualFundSource
) -> None:
    use_case = ImportCas(uow=uow, source=source, clock=clock)

    mock_parsed_initial = [
        ParsedCasHolding(
            scheme_name="RELIANCE INDUSTRIES LTD",
            units=10.0,
            folio="1208160012345678",
            isin="INE002A01018",
        ),
    ]
    with patch("app.application.use_cases.import_cas.CasParser.parse_pdf", return_value=mock_parsed_initial):
        await use_case.execute(owner_id="owner-1", pdf_bytes=b"%PDF-mock")

    # Second import with updated units
    mock_parsed_updated = [
        ParsedCasHolding(
            scheme_name="RELIANCE INDUSTRIES LTD",
            units=15.0,
            folio="1208160012345678",
            isin="INE002A01018",
        ),
    ]
    with patch("app.application.use_cases.import_cas.CasParser.parse_pdf", return_value=mock_parsed_updated):
        summary = await use_case.execute(owner_id="owner-1", pdf_bytes=b"%PDF-mock")

        assert summary.imported_count == 1
        assert summary.holdings[0].units == 15.0
        # Verify in repo
        stored = await uow.mutual_funds.get_holdings_for_owner("owner-1")
        assert len(stored) == 1
        assert stored[0].units == 15.0


@pytest.mark.asyncio
async def test_import_cas_with_isin_lookup_resolution(
    uow: InMemoryUnitOfWork, clock: FakeClock, source: FakeMutualFundSource
) -> None:
    """Verify holding is accurately resolved using offline AMFI ISIN database when search_schemes has no match."""
    use_case = ImportCas(uow=uow, source=source, clock=clock)

    mock_parsed = [
        ParsedCasHolding(
            scheme_name="SBI Contra Fund - Growth",
            units=21.088,
            folio="34012653",
            isin="INF200K01362",
        ),
    ]
    with patch("app.application.use_cases.import_cas.CasParser.parse_pdf", return_value=mock_parsed):
        summary = await use_case.execute(owner_id="owner-1", pdf_bytes=b"%PDF-mock")

        assert summary.imported_count == 1
        holding = summary.holdings[0]
        assert holding.scheme_code == 102414
        assert "SBI CONTRA FUND" in holding.scheme_name.upper()
        assert holding.units == 21.088
        assert holding.folio_masked == "XXXX2653"
        assert "SBI" in holding.fund_house

