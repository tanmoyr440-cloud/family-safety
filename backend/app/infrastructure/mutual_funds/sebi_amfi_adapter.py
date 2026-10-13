"""SEBI / AMFI Mutual Fund Public Data Adapter.

Documentation & Source References:
    - Official AMFI Daily NAV Feed: https://www.amfiindia.com/spages/NAVAll.txt
    - Open SEBI/AMFI JSON API: https://api.mfapi.in/

This adapter queries the public SEBI/AMFI mutual fund feed to search schemes,
retrieve official fund house and category metadata, and fetch latest daily NAVs.
Includes resilient fallback, caching, and timeout protections.
"""

import time
from typing import Any

import httpx
import structlog

from app.application.ports.mutual_fund_source import (
    MutualFundNavDTO,
    MutualFundSchemeDTO,
    MutualFundSource,
)

logger = structlog.get_logger(__name__)

MFAPI_BASE_URL = "https://api.mfapi.in/mf"
AMFI_RAW_NAV_URL = "https://www.amfiindia.com/spages/NAVAll.txt"


class SebiAmfiMutualFundAdapter(MutualFundSource):
    """Adapter implementing MutualFundSource using SEBI/AMFI public data feeds."""

    def __init__(
        self,
        base_url: str = MFAPI_BASE_URL,
        timeout_seconds: float = 8.0,
        cache_ttl_seconds: int = 3600,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds
        self._cache_ttl = cache_ttl_seconds
        # In-memory NAV cache: scheme_code -> (nav_dto, cached_at_monotonic)
        self._nav_cache: dict[int, tuple[MutualFundNavDTO, float]] = {}

    async def search_schemes(self, query: str) -> list[MutualFundSchemeDTO]:
        """Search registered mutual fund schemes by name or keywords."""
        cleaned_query = query.strip()
        if not cleaned_query or len(cleaned_query) < 2:
            return []

        search_url = f"{self._base_url}/search"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(search_url, params={"q": cleaned_query})
                if response.status_code != 200:
                    logger.warning(
                        "SEBI/AMFI scheme search failed with non-200 status",
                        status_code=response.status_code,
                        query=cleaned_query,
                    )
                    return []

                data = response.json()
                if not isinstance(data, list):
                    return []

                results: list[MutualFundSchemeDTO] = []
                for item in data[:30]:  # Limit top 30 matches
                    if isinstance(item, dict) and "schemeCode" in item and "schemeName" in item:
                        try:
                            code = int(item["schemeCode"])
                            name = str(item["schemeName"]).strip()
                            results.append(MutualFundSchemeDTO(scheme_code=code, scheme_name=name))
                        except (ValueError, TypeError):
                            continue

                return results

        except Exception as exc:
            logger.error(
                "Error searching SEBI/AMFI mutual funds",
                query=cleaned_query,
                error=str(exc),
            )
            return []

    async def get_latest_nav(self, scheme_code: int) -> MutualFundNavDTO | None:
        """Fetch latest daily NAV and scheme details for a given scheme code."""
        now_mono = time.monotonic()
        if scheme_code in self._nav_cache:
            cached_dto, cached_time = self._nav_cache[scheme_code]
            if now_mono - cached_time < self._cache_ttl:
                return cached_dto

        url = f"{self._base_url}/{scheme_code}/latest"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    logger.warning(
                        "SEBI/AMFI NAV lookup failed with non-200 status",
                        scheme_code=scheme_code,
                        status_code=response.status_code,
                    )
                    return None

                data = response.json()
                if not isinstance(data, dict):
                    return None

                meta = data.get("meta") or {}
                nav_data_list = data.get("data") or []

                if not nav_data_list or not isinstance(nav_data_list, list):
                    return None

                latest_entry = nav_data_list[0]
                if not isinstance(latest_entry, dict):
                    return None

                raw_nav = latest_entry.get("nav")
                nav_date = str(latest_entry.get("date", ""))
                try:
                    nav_val = float(raw_nav)
                except (ValueError, TypeError):
                    return None

                fund_house = str(meta.get("fund_house") or "Mutual Fund AMC").strip()
                scheme_name = str(meta.get("scheme_name") or f"Scheme {scheme_code}").strip()
                scheme_type = meta.get("scheme_type")
                scheme_category = meta.get("scheme_category")
                isin_growth = meta.get("isin_growth")

                dto = MutualFundNavDTO(
                    scheme_code=scheme_code,
                    scheme_name=scheme_name,
                    fund_house=fund_house,
                    scheme_type=str(scheme_type) if scheme_type else None,
                    scheme_category=str(scheme_category) if scheme_category else None,
                    isin_growth=str(isin_growth) if isin_growth else None,
                    nav=nav_val,
                    nav_date=nav_date,
                )

                self._nav_cache[scheme_code] = (dto, now_mono)
                return dto

        except Exception as exc:
            logger.error(
                "Error retrieving SEBI/AMFI NAV",
                scheme_code=scheme_code,
                error=str(exc),
            )
            return None
