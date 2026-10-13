"""Use case: ImportCas."""

import uuid
from dataclasses import dataclass
from datetime import datetime

from app.application.ports.clock import Clock
from app.application.ports.mutual_fund_source import MutualFundSource
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.entities.mutual_fund_holding import MutualFundHolding
from app.infrastructure.cas.cas_parser import CasParser, ParsedCasHolding


@dataclass(frozen=True)
class CasImportSummaryDTO:
    """Summary result of a CAS statement import."""

    imported_count: int
    holdings: list[MutualFundHolding]


class ImportCas:
    """Parses CAMS/KFintech CAS statement and imports holdings into safety net."""

    def __init__(
        self,
        uow: UnitOfWork,
        source: MutualFundSource,
        clock: Clock,
    ) -> None:
        self._uow = uow
        self._source = source
        self._clock = clock

    async def execute(
        self,
        owner_id: str,
        pdf_bytes: bytes,
        password: str | None = None,
    ) -> CasImportSummaryDTO:
        """Parse CAS PDF and register mutual fund holdings with SEBI/AMFI metadata."""
        parsed_items: list[ParsedCasHolding] = CasParser.parse_pdf(pdf_bytes, password)
        if not parsed_items:
            return CasImportSummaryDTO(imported_count=0, holdings=[])

        imported_holdings: list[MutualFundHolding] = []

        async with self._uow:
            # Load existing holdings for this owner
            existing = await self._uow.mutual_funds.get_holdings_for_owner(owner_id)
            existing_by_name = {h.scheme_name.lower(): h for h in existing}

            for item in parsed_items:
                # 1. Resolve SEBI scheme code & AMC from public registry
                scheme_code = 100000
                fund_house = "Mutual Fund AMC"
                official_name = item.scheme_name

                # Search by scheme name in SEBI/AMFI registry
                search_results = await self._source.search_schemes(item.scheme_name[:30])
                if search_results:
                    scheme_code = search_results[0].scheme_code
                    official_name = search_results[0].scheme_name
                    # Get fund house from NAV details
                    nav_info = await self._source.get_latest_nav(scheme_code)
                    if nav_info:
                        fund_house = nav_info.fund_house
                        official_name = nav_info.scheme_name

                # Folio masking
                folio_masked = None
                if item.folio:
                    cleaned_folio = item.folio.strip()
                    if len(cleaned_folio) > 4:
                        folio_masked = f"XXXX{cleaned_folio[-4:]}"
                    else:
                        folio_masked = cleaned_folio

                # Check if already exists for this owner
                match = existing_by_name.get(official_name.lower())
                if match:
                    # Update units
                    match.units = item.units
                    match.folio_masked = folio_masked or match.folio_masked
                    await self._uow.mutual_funds.save(match)
                    imported_holdings.append(match)
                else:
                    new_holding = MutualFundHolding(
                        id=str(uuid.uuid4()),
                        owner_id=owner_id,
                        scheme_code=scheme_code,
                        scheme_name=official_name,
                        fund_house=fund_house,
                        units=item.units,
                        folio_masked=folio_masked,
                        created_at=self._clock.now(),
                    )
                    await self._uow.mutual_funds.save(new_holding)
                    imported_holdings.append(new_holding)

            await self._uow.commit()

        return CasImportSummaryDTO(
            imported_count=len(imported_holdings),
            holdings=imported_holdings,
        )
