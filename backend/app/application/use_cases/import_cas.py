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
            existing_by_isin = {h.isin: h for h in existing if h.isin}
            existing_by_name = {h.scheme_name.lower(): h for h in existing}
            existing_by_key = {
                (h.scheme_name.lower(), h.folio_masked): h
                for h in existing
            }
            existing_by_code = {h.scheme_code: h for h in existing if h.scheme_code and h.scheme_code > 100000}

            for item in parsed_items:
                scheme_code = 100000
                fund_house = "Mutual Fund AMC"
                official_name = item.scheme_name

                # Folio / Demat masking
                raw_folio = item.folio.strip() if item.folio else None
                folio_masked = None
                if raw_folio:
                    if len(raw_folio) > 4:
                        folio_masked = f"XXXX{raw_folio[-4:]}"
                    else:
                        folio_masked = raw_folio

                is_stock = item.asset_type == "STOCK" or (
                    item.isin is not None and item.isin.startswith(("INE", "IN9", "IN0"))
                )
                asset_type = "STOCK" if is_stock else "MUTUAL_FUND"

                if not is_stock:
                    # Check ISIN registry (instantaneous & offline)
                    isin_info = None
                    if item.isin:
                        try:
                            from casparser_isin import MFISINDb

                            mf_db = MFISINDb()
                            res = mf_db.direct_isin_lookup(item.isin)
                            if res:
                                isin_info = res[0]
                        except Exception:
                            isin_info = None

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
                    elif isin_info:
                        try:
                            scheme_code = int(isin_info["amfi_code"])
                        except (ValueError, TypeError):
                            scheme_code = 100000 + (abs(hash(item.isin or item.scheme_name)) % 800000)
                        official_name = isin_info.get("name") or item.scheme_name
                        nav_info = await self._source.get_latest_nav(scheme_code)
                        if nav_info:
                            fund_house = nav_info.fund_house
                            official_name = nav_info.scheme_name
                        else:
                            name_parts = official_name.split()
                            fund_house = f"{name_parts[0].title()} Mutual Fund" if name_parts else "Mutual Fund AMC"
                    else:
                        # Fallback for MF when offline or not in open AMFI registry
                        unique_id = item.isin or item.scheme_name
                        scheme_code = 100000 + (abs(hash(unique_id)) % 800000)
                else:
                    # Demat Equity holding (Stocks or CDSL Demat Equity Funds)
                    fund_house = "CDSL Demat Equity"
                    unique_id = item.isin or item.scheme_name
                    scheme_code = 200000 + (abs(hash(unique_id)) % 700000)
                    official_name = item.scheme_name

                    # 1. For stocks (INE...), look up ticker in ISINDb
                    if item.isin and not item.isin.startswith("INF"):
                        try:
                            from casparser_isin import ISINDb

                            eq_db = ISINDb()
                            eq_info = eq_db.isin_lookup(item.isin)
                            if eq_info:
                                if eq_info.name:
                                    official_name = eq_info.name
                                if eq_info.symbol:
                                    fund_house = f"{eq_info.symbol} · {eq_info.exchange or 'NSE'}"
                                elif eq_info.issuer:
                                    fund_house = eq_info.issuer
                        except Exception:
                            pass

                    # 2. For CDSL Demat Equity funds / ETFs (INF...), resolve AMFI scheme code and fund house
                    if item.isin and item.isin.startswith("INF"):
                        fund_house = "CDSL Demat Equity Fund"
                        try:
                            from casparser_isin import MFISINDb

                            mf_db = MFISINDb()
                            res = mf_db.direct_isin_lookup(item.isin)
                            if res and res[0].get("amfi_code"):
                                try:
                                    scheme_code = int(res[0]["amfi_code"])
                                except (ValueError, TypeError):
                                    pass
                                if res[0].get("name"):
                                    official_name = res[0]["name"]
                        except Exception:
                            pass

                        if scheme_code >= 200000:
                            search_term = re.sub(
                                r"\s*-\s*(?:DIRECT|REGULAR|PLAN|GROWTH|IDCW|DIVIDEND|DP|RP|DIR|REG|GR)\b.*$",
                                "",
                                item.scheme_name,
                                flags=re.IGNORECASE,
                            ).strip(" -:")
                            words = search_term.split()
                            if len(words) > 4:
                                search_term = " ".join(words[:4])
                            if search_term:
                                search_results = await self._source.search_schemes(search_term)
                                if search_results:
                                    best = self._select_best_scheme_match(search_results, item.scheme_name)
                                    scheme_code = best.scheme_code
                                    official_name = best.scheme_name

                        if scheme_code < 200000:
                            nav_info = await self._source.get_latest_nav(scheme_code)
                            if nav_info and nav_info.fund_house:
                                fund_house = f"{nav_info.fund_house} (Demat)"

                # Check if already exists for this owner (matching ISIN first)
                match = (
                    (existing_by_isin.get(item.isin) if item.isin else None)
                    or existing_by_key.get((official_name.lower(), folio_masked))
                    or existing_by_name.get(official_name.lower())
                    or existing_by_code.get(scheme_code)
                )
                if match:
                    # Update units, folio, and refresh timestamp for monthly refresh
                    match.units = item.units
                    if raw_folio:
                        match.folio = raw_folio
                    match.folio_masked = folio_masked or match.folio_masked
                    match.asset_type = asset_type
                    match.isin = item.isin or match.isin
                    match.created_at = self._clock.now()
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
                        folio=raw_folio,
                        folio_masked=folio_masked,
                        asset_type=asset_type,
                        isin=item.isin,
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
