"""Mutual funds integration router querying SEBI/AMFI public data feeds."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status

from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.import_cas import ImportCas
from app.application.use_cases.manage_mutual_funds import ManageMutualFunds
from app.domain.entities.owner import Owner
from app.infrastructure.cas.cas_parser import CasDecryptionError, CasParsingError
from app.infrastructure.market_data.stock_quote_adapter import StockQuoteAdapter
from app.infrastructure.mutual_funds.sebi_amfi_adapter import SebiAmfiMutualFundAdapter
from app.interfaces.api.dependencies import get_current_owner, get_uow
from app.interfaces.api.errors import BadRequestException, NotFoundException
from app.interfaces.api.schemas import (
    ActionResponse,
    AddMutualFundHoldingRequest,
    CasImportResponse,
    MutualFundHoldingResponse,
    MutualFundNavResponse,
    MutualFundSchemeResponse,
    PortfolioSummaryResponse,
)


class SystemClock(Clock):
    """System clock provider."""

    def now(self) -> datetime:
        return datetime.now(UTC)


clock = SystemClock()
mf_adapter = SebiAmfiMutualFundAdapter()
stock_adapter = StockQuoteAdapter()
router = APIRouter(tags=["mutual-funds"])


@router.get(
    "/mutual-funds/search",
    response_model=list[MutualFundSchemeResponse],
    operation_id="searchMutualFunds",
    summary="Search SEBI-registered mutual fund schemes",
)
async def search_mutual_funds(
    q: str = Query(..., min_length=2, description="Scheme name search term"),
    _current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> list[MutualFundSchemeResponse]:
    """Search all SEBI-registered mutual fund schemes across AMCs."""
    use_case = ManageMutualFunds(uow=uow, source=mf_adapter, clock=clock)
    schemes = await use_case.search_schemes(q)
    return [
        MutualFundSchemeResponse(scheme_code=s.scheme_code, scheme_name=s.scheme_name)
        for s in schemes
    ]


@router.get(
    "/mutual-funds/{scheme_code}/nav",
    response_model=MutualFundNavResponse,
    operation_id="getMutualFundNav",
    summary="Get latest NAV from SEBI/AMFI public registry",
)
async def get_mutual_fund_nav(
    scheme_code: int,
    _current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> MutualFundNavResponse:
    """Fetch latest daily NAV, AMC fund house, category, and ISIN from SEBI/AMFI feed."""
    use_case = ManageMutualFunds(uow=uow, source=mf_adapter, clock=clock)
    nav_dto = await use_case.get_scheme_nav(scheme_code)
    if not nav_dto:
        raise NotFoundException(f"Mutual fund scheme {scheme_code} not found in SEBI/AMFI registry.")

    return MutualFundNavResponse(
        scheme_code=nav_dto.scheme_code,
        scheme_name=nav_dto.scheme_name,
        fund_house=nav_dto.fund_house,
        scheme_type=nav_dto.scheme_type,
        scheme_category=nav_dto.scheme_category,
        isin_growth=nav_dto.isin_growth,
        nav=nav_dto.nav,
        nav_date=nav_dto.nav_date,
    )


@router.get(
    "/mutual-funds/summary",
    response_model=PortfolioSummaryResponse,
    operation_id="getPortfolioSummary",
    summary="Get portfolio snapshot summary, asset breakdown, and monthly freshness reminder",
)
async def get_portfolio_summary(
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioSummaryResponse:
    """Compute portfolio summary metrics, breakdown across Mutual Funds & Stocks, and monthly refresh status."""
    use_case = ManageMutualFunds(uow=uow, source=mf_adapter, clock=clock, stock_source=stock_adapter)
    holdings = await use_case.get_holdings_with_valuations(current_owner.id)

    if not holdings:
        return PortfolioSummaryResponse(
            last_updated_at=None,
            days_since_update=None,
            is_stale=False,
            reminder_message="No portfolio holdings recorded yet. Upload your monthly CAS statement to track your mutual funds and stocks.",
            mf_count=0,
            stock_count=0,
            total_mf_value_paise=0,
            total_stock_value_paise=0,
            total_portfolio_value_paise=0,
        )

    mf_holdings = [h for h in holdings if h.asset_type == "MUTUAL_FUND"]
    stock_holdings = [h for h in holdings if h.asset_type == "STOCK"]

    total_mf_val = sum(h.value_paise for h in mf_holdings)
    total_stock_val = sum(h.value_paise for h in stock_holdings)
    total_portfolio_val = total_mf_val + total_stock_val

    # Determine freshness from latest created_at
    valid_dates = [h.created_at for h in holdings if h.created_at is not None]
    last_updated = max(valid_dates) if valid_dates else None

    days_since = (clock.now() - last_updated).days if last_updated else 0
    is_stale = days_since >= 30

    if is_stale:
        reminder = (
            f"Monthly Portfolio Refresh Due: Your portfolio holdings snapshot was last updated {days_since} days ago. "
            "Please upload your latest monthly CAS statement to sync current units, stock holdings, and valuations."
        )
    else:
        next_in = max(1, 30 - days_since)
        reminder = (
            f"Portfolio snapshot is up to date (updated {days_since} days ago). "
            f"Next monthly refresh recommended in ~{next_in} days."
        )

    return PortfolioSummaryResponse(
        last_updated_at=last_updated,
        days_since_update=days_since,
        is_stale=is_stale,
        reminder_message=reminder,
        mf_count=len(mf_holdings),
        stock_count=len(stock_holdings),
        total_mf_value_paise=total_mf_val,
        total_stock_value_paise=total_stock_val,
        total_portfolio_value_paise=total_portfolio_val,
    )


@router.get(
    "/mutual-funds/holdings",
    response_model=list[MutualFundHoldingResponse],
    operation_id="listMutualFundHoldings",
    summary="List mutual fund and stock holdings with live valuations",
)
async def list_mutual_fund_holdings(
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> list[MutualFundHoldingResponse]:
    """Retrieve all registered holdings for owner with real-time SEBI/AMFI and NSE/BSE valuations."""
    use_case = ManageMutualFunds(uow=uow, source=mf_adapter, clock=clock, stock_source=stock_adapter)
    holdings = await use_case.get_holdings_with_valuations(current_owner.id)
    return [
        MutualFundHoldingResponse(
            id=h.id,
            scheme_code=h.scheme_code,
            scheme_name=h.scheme_name,
            fund_house=h.fund_house,
            units=h.units,
            folio_masked=h.folio_masked,
            asset_type=h.asset_type,
            isin=h.isin,
            latest_nav=h.latest_nav,
            nav_date=h.nav_date,
            value_paise=h.value_paise,
            created_at=h.created_at,
        )
        for h in holdings
    ]


@router.post(
    "/mutual-funds/holdings",
    response_model=MutualFundHoldingResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="addMutualFundHolding",
    summary="Add a mutual fund holding to portfolio",
)
async def add_mutual_fund_holding(
    body: AddMutualFundHoldingRequest,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> MutualFundHoldingResponse:
    """Register a new mutual fund holding with official metadata fetched from SEBI/AMFI."""
    use_case = ManageMutualFunds(uow=uow, source=mf_adapter, clock=clock, stock_source=stock_adapter)
    holding = await use_case.add_holding(
        owner_id=current_owner.id,
        scheme_code=body.scheme_code,
        units=body.units,
        folio_number=body.folio_number,
    )

    # Compute current valuation for immediate response
    nav_dto = await use_case.get_scheme_nav(holding.scheme_code)
    latest_nav = nav_dto.nav if nav_dto else None
    nav_date = nav_dto.nav_date if nav_dto else None
    value_paise = holding.calculate_value_paise(latest_nav) if latest_nav is not None else 0

    return MutualFundHoldingResponse(
        id=holding.id,
        scheme_code=holding.scheme_code,
        scheme_name=holding.scheme_name,
        fund_house=holding.fund_house,
        units=holding.units,
        folio_masked=holding.folio_masked,
        asset_type=holding.asset_type,
        isin=holding.isin,
        latest_nav=latest_nav,
        nav_date=nav_date,
        value_paise=value_paise,
        created_at=holding.created_at,
    )


@router.delete(
    "/mutual-funds/holdings",
    response_model=ActionResponse,
    operation_id="clearAllMutualFundHoldings",
    summary="Clear all mutual fund holdings snapshot data",
)
async def clear_all_mutual_fund_holdings(
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> ActionResponse:
    """Delete all mutual fund holdings in owner's portfolio snapshot."""
    use_case = ManageMutualFunds(uow=uow, source=mf_adapter, clock=clock, stock_source=stock_adapter)
    count = await use_case.delete_all_holdings(owner_id=current_owner.id)
    return ActionResponse(message=f"Successfully removed {count} portfolio holdings.")


@router.delete(
    "/mutual-funds/holdings/{id}",
    response_model=ActionResponse,
    operation_id="deleteMutualFundHolding",
    summary="Remove a mutual fund holding",
)
async def delete_mutual_fund_holding(
    id: str,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> ActionResponse:
    """Delete a mutual fund holding from owner's portfolio."""
    use_case = ManageMutualFunds(uow=uow, source=mf_adapter, clock=clock, stock_source=stock_adapter)
    await use_case.delete_holding(owner_id=current_owner.id, holding_id=id)
    return ActionResponse(message="Mutual fund holding removed successfully.")



@router.post(
    "/mutual-funds/import-cas",
    response_model=CasImportResponse,
    operation_id="importCasStatement",
    summary="Import portfolio from CDSL / NSDL / CAMS / KFintech Consolidated Account Statement (CAS) PDF",
)
async def import_cas_statement(
    file: UploadFile = File(..., description="CAS PDF statement file"),
    password: str | None = Form(default=None, description="PDF password (typically PAN or DOB)"),
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> CasImportResponse:
    """Parse encrypted or unencrypted CAS PDF (CDSL, NSDL, CAMS, KFintech), map to SEBI/AMFI registry, and import holdings."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise BadRequestException("Please upload a valid PDF file.")

    content = await file.read()
    if not content:
        raise BadRequestException("Uploaded PDF file is empty.")

    use_case = ImportCas(uow=uow, source=mf_adapter, clock=clock)
    try:
        summary = await use_case.execute(
            owner_id=current_owner.id,
            pdf_bytes=content,
            password=password,
        )
    except CasDecryptionError as e:
        raise BadRequestException(str(e))
    except CasParsingError as e:
        raise BadRequestException(str(e))
    except Exception as e:
        raise BadRequestException(f"Failed to process CAS PDF: {e}")

    # Fetch NAVs / stock prices for imported holdings to populate response
    manage_use_case = ManageMutualFunds(uow=uow, source=mf_adapter, clock=clock, stock_source=stock_adapter)
    response_holdings = []
    total_val_paise = 0

    for h in summary.holdings:
        latest_nav = None
        nav_date = None

        if h.asset_type == "STOCK":
            quote = await stock_adapter.get_quote(isin=h.isin, name=h.scheme_name)
            if quote:
                latest_nav = quote.price
                nav_date = quote.as_of
        else:
            nav_dto = await manage_use_case.get_scheme_nav(h.scheme_code)
            if nav_dto:
                latest_nav = nav_dto.nav
                nav_date = nav_dto.nav_date

        value_paise = h.calculate_value_paise(latest_nav) if latest_nav is not None else 0
        total_val_paise += value_paise

        response_holdings.append(
            MutualFundHoldingResponse(
                id=h.id,
                scheme_code=h.scheme_code,
                scheme_name=h.scheme_name,
                fund_house=h.fund_house,
                units=h.units,
                folio_masked=h.folio_masked,
                asset_type=h.asset_type,
                isin=h.isin,
                latest_nav=latest_nav,
                nav_date=nav_date,
                value_paise=value_paise,
                created_at=h.created_at,
            )
        )

    return CasImportResponse(
        imported_count=summary.imported_count,
        total_value_paise=total_val_paise,
        message=f"Successfully imported {summary.imported_count} holdings from CAS statement.",
        holdings=response_holdings,
    )

