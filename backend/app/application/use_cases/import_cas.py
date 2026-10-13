"""Use case: ImportCas."""

import re
import uuid
from dataclasses import dataclass
from datetime import datetime

from app.application.ports.clock import Clock
from app.application.ports.mutual_fund_source import (
    MutualFundSchemeDTO,
    MutualFundSource,
)
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.entities.mutual_fund_holding import MutualFundHolding
from app.infrastructure.cas.cas_parser import CasParser, ParsedCasHolding


@dataclass(frozen=True)
class CasImportSummaryDTO:
    """Summary result of a CAS statement import."""

    imported_count: int
    holdings: list[MutualFundHolding]


class ImportCas:
    """Parses CDSL, NSDL, CAMS, and KFintech CAS statements and imports holdings into safety net."""

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
        """Parse CAS PDF and register mutual fund & demat equity holdings with SEBI/AMFI metadata."""
        parsed_items: list[ParsedCasHolding] = CasParser.parse_pdf(pdf_bytes, password)
        if not parsed_items:
            return CasImportSummaryDTO(imported_count=0, holdings=[])

        imported_holdings: list[MutualFundHolding] = []

        async with self._uow:
            # Load existing holdings for this owner
            existing = await self._uow.mutual_funds.get_holdings_for_owner(owner_id)
            existing_by_name = {h.scheme_name.lower(): h for h in existing}
            existing_by_key = {
                (h.scheme_name.lower(), h.folio_masked): h
                for h in existing
            }

            for item in parsed_items:
                scheme_code = 100000
                fund_house = "Mutual Fund AMC"
                official_name = item.scheme_name

                # Folio / Demat masking
                folio_masked = None
                if item.folio:
                    cleaned_folio = item.folio.strip()
                    if len(cleaned_folio) > 4:
                        folio_masked = f"XXXX{cleaned_folio[-4:]}"
                    else:
                        folio_masked = cleaned_folio

                is_mf = item.isin is None or item.isin.startswith("INF")

                if is_mf:
                    # Clean scheme name for AMFI search:
                    # Remove trailing plan/growth suffixes that break SEBI/AMFI searches
                    search_term = re.sub(
                        r"\s*-\s*(?:DIRECT|REGULAR|PLAN|GROWTH|IDCW|DIVIDEND|DP|RP|DIR|REG|GR)\b.*$",
                        "",
                        item.scheme_name,
                        flags=re.IGNORECASE,
                    ).strip(" -:")
                    words = search_term.split()
                    if len(words) > 4:
                        search_term = " ".join(words[:4])

                    search_results = await self._source.search_schemes(search_term) if search_term else []
                    if search_results:
                        # Select candidate matching direct/growth options if present in original name
                        best_match = self._select_best_scheme_match(search_results, item.scheme_name)
                        scheme_code = best_match.scheme_code
                        official_name = best_match.scheme_name

                        # Get fund house from NAV details
                        nav_info = await self._source.get_latest_nav(scheme_code)
                        if nav_info:
                            fund_house = nav_info.fund_house
                            official_name = nav_info.scheme_name
                    else:
                        # Fallback for MF when offline or not in open AMFI registry
                        unique_id = item.isin or item.scheme_name
                        scheme_code = 100000 + (abs(hash(unique_id)) % 800000)
                else:
                    # Demat Equity holding (INE... or corporate demat asset)
                    fund_house = "CDSL Demat Equity"
                    unique_id = item.isin or item.scheme_name
                    scheme_code = 200000 + (abs(hash(unique_id)) % 700000)

                # Check if already exists for this owner
                match = existing_by_key.get((official_name.lower(), folio_masked)) or existing_by_name.get(
                    official_name.lower()
                )
                if match:
                    # Update units and folio
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

    @staticmethod
    def _select_best_scheme_match(
        candidates: list[MutualFundSchemeDTO],
        original_name: str,
    ) -> MutualFundSchemeDTO:
        """Find the candidate matching plan and growth/IDCW preference if possible."""
        is_direct = "DIRECT" in original_name.upper()
        is_growth = "GROWTH" in original_name.upper()

        for cand in candidates:
            cand_u = cand.scheme_name.upper()
            if is_direct and "DIRECT" not in cand_u:
                continue
            if is_growth and "GROWTH" not in cand_u:
                continue
            return cand

        return candidates[0]
