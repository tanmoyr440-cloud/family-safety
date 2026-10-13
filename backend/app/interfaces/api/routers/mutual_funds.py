"""Mutual funds integration router querying SEBI/AMFI public data feeds."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status

from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.import_cas import ImportCas
from app.application.use_cases.manage_mutual_funds import ManageMutualFunds
from app.domain.entities.owner import Owner
from app.infrastructure.cas.cas_parser import CasDecryptionError, CasParsingError
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
)


class SystemClock(Clock):
    """System clock provider."""

    def now(self) -> datetime:
        return datetime.now(UTC)


clock = SystemClock()
mf_adapter = SebiAmfiMutualFundAdapter()
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
    "/mutual-funds/holdings",
    response_model=list[MutualFundHoldingResponse],
    operation_id="listMutualFundHoldings",
    summary="List mutual fund holdings with live SEBI/AMFI valuations",
)
async def list_mutual_fund_holdings(
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> list[MutualFundHoldingResponse]:
    """Retrieve all registered holdings for owner with real-time SEBI/AMFI valuations."""
    use_case = ManageMutualFunds(uow=uow, source=mf_adapter, clock=clock)
    holdings = await use_case.get_holdings_with_valuations(current_owner.id)
    return [
        MutualFundHoldingResponse(
            id=h.id,
            scheme_code=h.scheme_code,
            scheme_name=h.scheme_name,
            fund_house=h.fund_house,
            units=h.units,
            folio_masked=h.folio_masked,
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
    use_case = ManageMutualFunds(uow=uow, source=mf_adapter, clock=clock)
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
        latest_nav=latest_nav,
        nav_date=nav_date,
        value_paise=value_paise,
        created_at=holding.created_at,
    )


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
    use_case = ManageMutualFunds(uow=uow, source=mf_adapter, clock=clock)
    await use_case.delete_holding(owner_id=current_owner.id, holding_id=id)
    return ActionResponse(message="Mutual fund holding removed successfully.")


@router.post(
    "/mutual-funds/import-cas",
    response_model=CasImportResponse,
    operation_id="importCasStatement",
    summary="Import portfolio from CAMS / KFintech Consolidated Account Statement (CAS) PDF",
)
async def import_cas_statement(
    file: UploadFile = File(..., description="CAS PDF statement file"),
    password: str | None = Form(default=None, description="PDF password (typically PAN or DOB)"),
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> CasImportResponse:
    """Parse encrypted or unencrypted CAS PDF, map to SEBI/AMFI registry, and import holdings."""
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

    # Fetch NAVs for imported holdings to populate response
    manage_use_case = ManageMutualFunds(uow=uow, source=mf_adapter, clock=clock)
    response_holdings = []
    total_val_paise = 0

    for h in summary.holdings:
        nav_dto = await manage_use_case.get_scheme_nav(h.scheme_code)
        latest_nav = nav_dto.nav if nav_dto else None
        nav_date = nav_dto.nav_date if nav_dto else None
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

