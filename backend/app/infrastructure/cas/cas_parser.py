"""CDSL, NSDL, CAMS & KFintech CAS (Consolidated Account Statement) PDF Parser."""

import io
import re
from dataclasses import dataclass
from typing import Any, BinaryIO

import structlog
from pypdf import PdfReader

logger = structlog.get_logger(__name__)


class CasDecryptionError(Exception):
    """Raised when CAS PDF is password-protected and password fails."""


class CasParsingError(Exception):
    """Raised when CAS PDF cannot be read or parsed."""


@dataclass(frozen=True)
class ParsedCasHolding:
    """Holding extracted from a CAS statement."""

    scheme_name: str
    units: float
    folio: str | None = None
    isin: str | None = None
    nav: float | None = None
    value_inr: float | None = None
    asset_type: str = "MUTUAL_FUND"


# Common regex patterns across CDSL, NSDL, CAMS & KFintech CAS PDFs
# Lookahead (?=[A-Z0-9\/\-]*\d) ensures the folio contains at least one digit and never captures words like 'Cumulative'
_FOLIO_RE = re.compile(
    r"(?:Folio\s*(?:No|Number)?[:\.\s]+)(?=[A-Z0-9\/\-]*\d)([0-9A-Z\/\-]+)",
    re.IGNORECASE,
)
_BO_ID_RE = re.compile(
    r"(?:BO\s*ID|Client\s*ID|DP\s*ID|Demat\s*Account(?:\s*No)?|Beneficiary\s*(?:Owner\s*)?ID)[:\.\s]+([0-9A-Z]{8,16})",
    re.IGNORECASE,
)
# Valid Indian 12-character ISIN (ISO 6166 compliant: IN + 9 alphanumeric + 1 check digit)
_ISIN_RE = re.compile(r"\b(IN[A-Z0-9]{9}[0-9])\b")
_UNITS_RE = re.compile(
    r"(?:Closing\s*Unit\s*Balance|Balance\s*Units|Total\s*Units|Unit\s*Balance|Closing\s*Balance)"
    r"\s*[:\s\-]+\s*([0-9,]+\.?[0-9]*)",
    re.IGNORECASE,
)

# Known scheme & equity keywords
_SCHEME_KEYWORDS = (
    "FUND",
    "GROWTH",
    "DIRECT",
    "REGULAR",
    "INDEX",
    "EQUITY",
    "DEBT",
    "CAP",
    "OPPORTUNITIES",
    "BLUECHIP",
    "LIQUID",
    "SAVER",
    "PLAN",
    "ETF",
    "LTD",
    "LIMITED",
    "CORP",
    "INDUSTRIES",
    "HOLDINGS",
    "ENTERPRISES",
    "BANK",
    "SECURITIES",
    "FINANCE",
    "SERVICES",
)

# Index prefixes where trailing numbers belong to the name (e.g. NIFTY 50, TOP 100)
_INDEX_PREFIX_KEYWORDS = {
    "NIFTY",
    "SENSEX",
    "TOP",
    "BHARAT",
    "ALPHA",
    "NEXT",
    "NV",
    "MIDCAP",
    "SMALLCAP",
    "LARGECAP",
    "CRISIL",
    "SERIES",
}

_IGNORE_LINE_STARTS = (
    "PAGE ",
    "DATE:",
    "EMAIL:",
    "PAN:",
    "CONSOLIDATED ACCOUNT STATEMENT",
    "CENTRAL DEPOSITORY",
    "NATIONAL SECURITIES",
    "STATEMENT FOR",
    "STATEMENT OF HOLDINGS",
    "EQUITY SHARES",
    "MUTUAL FUNDS",
    "SR NO",
    "SR. NO",
    "ISIN SECURITY NAME",
)


class CasParser:
    """Extracts mutual fund and demat equity holdings from CDSL, NSDL, CAMS, and KFintech CAS statements."""

    @classmethod
    def parse(
        cls,
        pdf_file: bytes | BinaryIO,
        password: str | None = None,
    ) -> list[ParsedCasHolding]:
        """Convenience alias for parse_pdf."""
        return cls.parse_pdf(pdf_file, password)

    @classmethod
    def _parse_with_casparser(
        cls,
        pdf_bytes: bytes,
        password_candidates: list[str],
    ) -> list[ParsedCasHolding] | None:
        """Attempt to parse PDF using casparser library (handles CAMS, KFintech, CDSL, NSDL)."""
        try:
            import casparser
            from casparser.exceptions import IncorrectPasswordError
            from casparser.types import CASData, NSDLCASData
        except ImportError:
            return None

        cands = password_candidates if password_candidates else [""]

        for pw in cands:
            try:
                stream = io.BytesIO(pdf_bytes)
                data = casparser.read_cas_pdf(stream, password=pw, output="dict")
                holdings: list[ParsedCasHolding] = []

                if isinstance(data, CASData):
                    for folio in data.folios:
                        folio_str = str(folio.folio).strip() if folio.folio else None
                        for scheme in folio.schemes:
                            try:
                                units = float(scheme.close)
                            except (ValueError, TypeError):
                                continue
                            if units <= 0:
                                continue
                            nav = None
                            val = None
                            if scheme.valuation:
                                try:
                                    if scheme.valuation.nav is not None:
                                        nav = float(scheme.valuation.nav)
                                    if scheme.valuation.value is not None:
                                        val = float(scheme.valuation.value)
                                except (ValueError, TypeError):
                                    pass
                            holdings.append(
                                ParsedCasHolding(
                                    scheme_name=scheme.scheme,
                                    units=units,
                                    folio=folio_str,
                                    isin=scheme.isin,
                                    nav=nav,
                                    value_inr=val,
                                    asset_type="MUTUAL_FUND",
                                )
                            )

                elif isinstance(data, NSDLCASData):
                    for acc in data.accounts:
                        dp = acc.dp_id or ""
                        cl = acc.client_id or ""
                        acc_id = f"{dp}{cl}".strip() or cl or dp or None
                        is_demat_account = bool(
                            dp or cl or (acc.type and acc.type.upper() in ("CDSL", "NSDL"))
                        )
                        is_cdsl = bool(
                            (data.file_type and "CDSL" in str(data.file_type).upper())
                            or (acc.type and "CDSL" in str(acc.type).upper())
                        )

                        for mf in acc.mutual_funds:
                            try:
                                units = float(mf.balance)
                            except (ValueError, TypeError):
                                continue
                            if units <= 0:
                                continue
                            nav = float(mf.nav) if mf.nav is not None else None
                            val = float(mf.value) if mf.value is not None else None
                            name = mf.name or mf.isin

                            # CDSL Demat Equity funds should be under Stocks & Equities
                            name_u = name.upper()
                            is_equity_indicator = any(
                                kw in name_u
                                for kw in (
                                    "EQUITY",
                                    "ETF",
                                    "INDEX",
                                    "BEES",
                                    "CAP",
                                    "GROWTH",
                                    "BLUECHIP",
                                    "OPPORTUNITIES",
                                    "SAVER",
                                    "ELSS",
                                    "VALUE",
                                    "CONTRA",
                                    "FOCUSED",
                                    "NIFTY",
                                    "SENSEX",
                                    "MIDCAP",
                                    "SMALLCAP",
                                    "LARGECAP",
                                )
                            ) or getattr(mf, "type", None) == "EQUITY"

                            if (is_demat_account and is_equity_indicator) or (is_cdsl and is_demat_account):
                                asset_type = "STOCK"
                            else:
                                asset_type = "MUTUAL_FUND"

                            holdings.append(
                                ParsedCasHolding(
                                    scheme_name=name,
                                    units=units,
                                    folio=mf.folio or acc_id,
                                    isin=mf.isin,
                                    nav=nav,
                                    value_inr=val,
                                    asset_type=asset_type,
                                )
                            )

                        for eq in acc.equities:
                            try:
                                units = float(eq.num_shares)
                            except (ValueError, TypeError):
                                continue
                            if units <= 0:
                                continue
                            price = float(eq.price) if eq.price is not None else None
                            val = float(eq.value) if eq.value is not None else None
                            name = eq.name or eq.symbol or eq.isin
                            holdings.append(
                                ParsedCasHolding(
                                    scheme_name=name,
                                    units=units,
                                    folio=acc_id,
                                    isin=eq.isin,
                                    nav=price,
                                    value_inr=val,
                                    asset_type="STOCK",
                                )
                            )

                if holdings:
                    return cls._deduplicate_holdings(holdings)

            except IncorrectPasswordError:
                continue
            except Exception as exc:
                logger.warning("casparser attempt failed, falling back to text parsing", error=str(exc))
                break

        return None

    @classmethod
    def parse_pdf(
        cls,
        pdf_file: bytes | BinaryIO,
        password: str | None = None,
    ) -> list[ParsedCasHolding]:
        """Extract holdings from PDF bytes or stream."""
        pdf_bytes = pdf_file.read() if hasattr(pdf_file, "read") else pdf_file
        cleaned_pw = (password or "").strip()
        candidates: list[str] = []
        if cleaned_pw:
            for cand in [
                cleaned_pw,
                cleaned_pw.upper(),
                cleaned_pw.lower(),
                cleaned_pw.replace(" ", ""),
                cleaned_pw.replace(" ", "").upper(),
                cleaned_pw.replace("-", ""),
                cleaned_pw.replace("-", "").upper(),
            ]:
                if cand not in candidates:
                    candidates.append(cand)

        # 1. Attempt native parsing via casparser
        casparser_holdings = cls._parse_with_casparser(pdf_bytes, candidates)
        if casparser_holdings:
            return casparser_holdings

        # 2. Fall back to pypdf decryption and extraction
        stream = io.BytesIO(pdf_bytes)
        try:
            reader = PdfReader(stream)
        except Exception as exc:
            raise CasParsingError(f"Failed to read PDF file: {exc}") from exc

        if reader.is_encrypted:
            decrypted = False
            for pw_candidate in candidates:
                try:
                    res = reader.decrypt(pw_candidate)
                    if res in (1, 2):  # 1 = user pw, 2 = owner pw
                        decrypted = True
                        break
                except Exception:
                    continue

            if not decrypted:
                raise CasDecryptionError(
                    "Password incorrect or required. CAS statements from CDSL, NSDL, CAMS, or KFintech "
                    "are usually protected by your PAN in UPPERCASE (e.g., ABCDE1234F), "
                    "or PAN + Date of Birth (DDMMYYYY), or DOB (DDMMYYYY)."
                )

        full_text_pages: list[str] = []
        for page in reader.pages:
            try:
                extracted = page.extract_text() or ""
                if extracted:
                    full_text_pages.append(extracted)
            except Exception:
                continue

        full_text = "\n".join(full_text_pages)
        return cls.parse_text(full_text)

    @classmethod
    def _parse_tail_tokens(
        cls,
        tokens: list[str],
    ) -> dict[str, Any] | None:
        """Extract units, folio, nav, and value from the numeric/identifier tail of a tabular row."""
        if not tokens:
            return None

        first_tok = tokens[0].strip()
        is_non_numeric_folio = ("/" in first_tok or "-" in first_tok) and any(c.isdigit() for c in first_tok)

        if is_non_numeric_folio:
            folio = first_tok
            rest = tokens[1:]
        else:
            folio = None
            rest = tokens

        nums: list[float] = []
        for t in rest:
            try:
                nums.append(float(t.replace(",", "")))
            except ValueError:
                break

        if folio is not None:
            if not nums:
                return None
            units = nums[0]
            nav = nums[1] if len(nums) > 1 else None
            val = nums[2] if len(nums) > 2 else None
            if len(nums) >= 4 and abs(nums[0] - nums[1]) < 1e-4:
                units = nums[0]
                nav = nums[2]
                val = nums[3]
            return {"units": units, "folio": folio, "nav": nav, "value": val}

        if len(nums) >= 4:
            # If nums[0] == nums[1], this is [Current Balance, Free Balance, Price, Value]
            if abs(nums[0] - nums[1]) < 1e-4:
                return {"units": nums[0], "folio": None, "nav": nums[2], "value": nums[3]}
            # If nums[1] * nums[2] ≈ nums[3], nums[0] is an integer folio (e.g. 34012653 21.088 412.50 8,698.83)
            prod_1_2 = nums[1] * nums[2]
            if abs(prod_1_2 - nums[3]) < max(1.0, nums[3] * 0.05):
                f_str = str(int(nums[0])) if nums[0].is_integer() else tokens[0]
                return {"units": nums[1], "folio": f_str, "nav": nums[2], "value": nums[3]}
            # Or if nums[0] * nums[2] ≈ nums[3]
            prod_0_2 = nums[0] * nums[2]
            if abs(prod_0_2 - nums[3]) < max(1.0, nums[3] * 0.05):
                return {"units": nums[0], "folio": None, "nav": nums[2], "value": nums[3]}

        if len(nums) == 3:
            # Check if nums[0] * nums[1] ≈ nums[2] (units * price ≈ value)
            if abs(nums[0] * nums[1] - nums[2]) < max(1.0, nums[2] * 0.05):
                return {"units": nums[0], "folio": None, "nav": nums[1], "value": nums[2]}

        if len(nums) >= 2:
            # If first token is large integer without decimal point (e.g. 34012653) and second token has decimal or is units
            if "." not in tokens[0] and len(tokens[0]) >= 6 and ("." in tokens[1] or nums[1] < nums[0]):
                return {
                    "units": nums[1],
                    "folio": tokens[0],
                    "nav": nums[2] if len(nums) > 2 else None,
                    "value": nums[3] if len(nums) > 3 else None,
                }
            return {"units": nums[0], "folio": None, "nav": nums[1], "value": nums[2] if len(nums) > 2 else None}

        if len(nums) == 1:
            return {"units": nums[0], "folio": None, "nav": None, "value": None}

        return None

    @classmethod
    def _try_parse_tabular_line(
        cls, line: str
    ) -> tuple[str, str, float, str | None, float | None, float | None] | None:
        """Parse a single line representing a CDSL or NSDL table row.

        Returns (isin, scheme_name, units, folio, nav, value_inr) if matched, else None.
        """
        m = _ISIN_RE.search(line)
        if not m:
            return None

        isin = m.group(1)
        before = line[:m.start()].strip()
        after = line[m.end():].strip()

        # Case 1: ISIN is at the start of the row (or after optional serial number)
        is_serial_before = (not before) or bool(re.match(r"^\d+[\.\)]?$", before))
        if is_serial_before:
            tokens = after.split()
            tail_start = None
            for i in range(len(tokens) - 1, -1, -1):
                tok = tokens[i].replace(",", "")
                try:
                    float(tok)
                    tail_start = i
                except ValueError:
                    if ("/" in tok or "-" in tok) and any(c.isdigit() for c in tok) and i > 0:
                        tail_start = i
                    break

            if tail_start is not None and tail_start > 0:
                # Check if token immediately before tail_start is an index prefix (e.g. NIFTY 50)
                prev_word = tokens[tail_start - 1].upper().strip(" -:")
                if prev_word in _INDEX_PREFIX_KEYWORDS and tail_start + 1 < len(tokens):
                    tail_start += 1

                name_tokens = tokens[:tail_start]
                scheme_name = " ".join(name_tokens).strip(" -:")
                if len(scheme_name) >= 3:
                    tail_info = cls._parse_tail_tokens(tokens[tail_start:])
                    if tail_info and tail_info["units"] > 0:
                        return (
                            isin,
                            scheme_name,
                            tail_info["units"],
                            tail_info.get("folio"),
                            tail_info.get("nav"),
                            tail_info.get("value"),
                        )

        # Case 2: ISIN is in the middle of the row (name appears before ISIN)
        if before and not re.match(r"^\d+[\.\)]?$", before):
            clean_name = re.sub(r"^\d+[\.\)]?\s+", "", before).strip(" -:")
            tokens = after.split()
            if tokens and len(clean_name) >= 3:
                tail_info = cls._parse_tail_tokens(tokens)
                if tail_info and tail_info["units"] > 0:
                    return (
                        isin,
                        clean_name,
                        tail_info["units"],
                        tail_info.get("folio"),
                        tail_info.get("nav"),
                        tail_info.get("value"),
                    )

        return None

    @classmethod
    def _classify_asset_type(
        cls,
        isin: str | None,
        scheme_name: str,
        current_section: str | None = None,
        is_demat: bool = False,
    ) -> str:
        """Classify asset as MUTUAL_FUND or STOCK based on ISIN, Demat context, section, and naming."""
        isin_u = isin.strip().upper() if isin else ""
        name_u = scheme_name.upper()

        # 1. Standard Indian Demat Equities (INE..., IN9..., IN0...)
        if isin_u.startswith(("INE", "IN9", "IN0")):
            return "STOCK"

        # Explicit Debt / Liquid / Cash funds are always MUTUAL_FUND
        is_debt_or_liquid = any(
            kw in name_u
            for kw in (
                "LIQUID",
                "DEBT",
                "OVERNIGHT",
                "MONEY MARKET",
                "GILT",
                "BOND",
                "TREASURY",
                "FLOATER",
            )
        )
        if is_debt_or_liquid:
            return "MUTUAL_FUND"

        # 2. CDSL / NSDL Demat Account Holdings:
        # In CDSL statements, Demat equity funds, ETFs, and Demat shares belong under Stocks & Equities
        is_equity_indicator = any(
            kw in name_u
            for kw in (
                "EQUITY",
                "ETF",
                "INDEX",
                "BEES",
                "CAP",
                "BLUECHIP",
                "OPPORTUNITIES",
                "ELSS",
                "VALUE",
                "CONTRA",
                "FOCUSED",
                "NIFTY",
                "SENSEX",
                "MIDCAP",
                "SMALLCAP",
                "LARGECAP",
                "SHARES",
            )
        )

        # If holding is under an explicit Demat Holdings statement or Equity Shares section
        if current_section == "STOCK":
            return "STOCK"

        # If held in Demat account with equity characteristics (CDSL Demat Equity funds)
        if is_demat and is_equity_indicator and current_section != "MUTUAL_FUND":
            return "STOCK"

        # If name explicitly says "EQUITY FUND" or "ETF" or "BEES" in Demat mode
        if is_demat and any(kw in name_u for kw in ("EQUITY FUND", "ETF", "BEES")):
            return "STOCK"

        # 3. Standard Mutual Funds in AMC/RTA Folios (CAMS / KFintech) or Mutual Funds section
        if isin_u.startswith("INF"):
            return "MUTUAL_FUND"

        if current_section == "MUTUAL_FUND":
            return "MUTUAL_FUND"

        is_mf = any(
            kw in name_u
            for kw in (
                "FUND",
                "GROWTH",
                "DIRECT",
                "REGULAR",
                "INDEX",
                "CAP",
                "ELSS",
                "SAVER",
                "OPPORTUNITIES",
                "BLUECHIP",
                "LIQUID",
                "SCHEME",
                "ETF",
            )
        )
        is_stock = any(
            kw in name_u
            for kw in (
                " LTD",
                " LIMITED",
                " CORP",
                " INDUSTRIES",
                " ENTERPRISES",
                " HOLDINGS",
                " PHARMA",
                " MOTORS",
                " STEEL",
            )
        )
        if is_stock and not is_mf:
            return "STOCK"
        return "MUTUAL_FUND"

    @classmethod
    def parse_text(cls, text: str) -> list[ParsedCasHolding]:
        """Parse raw extracted text from a CDSL, NSDL, CAMS, or KFintech CAS statement."""
        holdings: list[ParsedCasHolding] = []
        lines = [line.strip() for line in text.splitlines() if line.strip()]

        current_folio: str | None = None
        current_demat_account: str | None = None
        current_scheme: str | None = None
        current_isin: str | None = None
        current_section: str | None = None

        for line in lines:
            upper_line = line.upper()

            # Track section headers (CDSL / NSDL statement sections)
            if any(
                sec in upper_line
                for sec in (
                    "EQUITY SHARES",
                    "STATEMENT OF HOLDINGS - EQUITIES",
                    "EQUITIES",
                    "HOLDING STATEMENT",
                    "STATEMENT OF HOLDINGS",
                )
            ):
                current_section = "STOCK"
            elif any(
                sec in upper_line
                for sec in ("MUTUAL FUNDS", "STATEMENT OF HOLDINGS - MUTUAL FUNDS", "MUTUAL FUND FOLIOS")
            ):
                current_section = "MUTUAL_FUND"

            # 1. Detect Demat account / BO ID
            bo_match = _BO_ID_RE.search(line)
            if bo_match:
                cand = bo_match.group(1).strip()
                if len(cand) >= 8:
                    current_demat_account = cand

            # 2. Detect Folio
            folio_match = _FOLIO_RE.search(line)
            if folio_match:
                cand = folio_match.group(1).strip()
                if len(cand) >= 4 and not cand.lower().startswith("nil"):
                    current_folio = cand

            # 3. Try single-line tabular extraction (CDSL / NSDL format)
            tabular_res = cls._try_parse_tabular_line(line)
            if tabular_res:
                isin, scheme_name, units, line_folio, nav_val, val_val = tabular_res
                is_demat_line = bool(
                    current_demat_account
                    or (line_folio and len(line_folio) >= 8 and line_folio.isdigit())
                )
                asset_type = cls._classify_asset_type(
                    isin, scheme_name, current_section, is_demat=is_demat_line
                )
                holdings.append(
                    ParsedCasHolding(
                        scheme_name=scheme_name,
                        units=units,
                        folio=line_folio or current_folio or current_demat_account,
                        isin=isin,
                        nav=nav_val,
                        value_inr=val_val,
                        asset_type=asset_type,
                    )
                )
                current_scheme = None
                current_isin = None
                continue

            # 4. Check for explicit units match (CAMS / KFintech format)
            units_match = _UNITS_RE.search(line)
            if units_match and current_scheme:
                raw_units = units_match.group(1).replace(",", "").strip()
                try:
                    units_val = float(raw_units)
                    if units_val > 0:
                        is_demat_line = bool(
                            current_demat_account
                            or (current_folio and len(current_folio) >= 8 and current_folio.isdigit())
                        )
                        asset_type = cls._classify_asset_type(
                            current_isin, current_scheme, current_section, is_demat=is_demat_line
                        )
                        holdings.append(
                            ParsedCasHolding(
                                scheme_name=current_scheme,
                                units=units_val,
                                folio=current_folio or current_demat_account,
                                isin=current_isin,
                                asset_type=asset_type,
                            )
                        )
                        current_scheme = None
                        current_isin = None
                        continue
                except ValueError:
                    pass

            # 5. Check for standalone ISIN line
            isin_match = _ISIN_RE.search(line)
            if isin_match:
                clean_isin = isin_match.group(1).strip()
                clean_line = re.sub(r"^(?:ISIN\s*[:\-]\s*)", "", line, flags=re.IGNORECASE).strip()
                if clean_line == clean_isin or line.startswith("ISIN:"):
                    current_isin = clean_isin
                    continue

            # 6. Check for multi-line numeric units line
            # When pypdf outputs table cells vertically:
            # (e.g. Line 1: ISIN/Name, Line 2: Name/ISIN, Line 3: Units / Numbers)
            if (current_scheme and current_isin) or (current_scheme and current_folio):
                tokens = line.split()
                if tokens:
                    tail_info = cls._parse_tail_tokens(tokens)
                    if tail_info and tail_info["units"] > 0:
                        asset_type = cls._classify_asset_type(current_isin, current_scheme, current_section)
                        holdings.append(
                            ParsedCasHolding(
                                scheme_name=current_scheme,
                                units=tail_info["units"],
                                folio=tail_info.get("folio") or current_folio or current_demat_account,
                                isin=current_isin,
                                nav=tail_info.get("nav"),
                                value_inr=tail_info.get("value"),
                                asset_type=asset_type,
                            )
                        )
                        current_scheme = None
                        current_isin = None
                        continue

            # 7. Check for Scheme Name candidate
            if any(upper_line.startswith(p) for p in _IGNORE_LINE_STARTS):
                continue

            if (
                any(kw in upper_line for kw in _SCHEME_KEYWORDS)
                or (current_isin is not None)
            ) and len(line) >= 4:
                clean_scheme = re.sub(
                    r"^(?:\d+[\.\)]\s*|Scheme\s*[:\-]\s*|Security\s*[:\-]\s*)",
                    "",
                    line,
                    flags=re.IGNORECASE,
                ).strip(" -:")
                if len(clean_scheme) >= 4 and not clean_scheme.upper().startswith("TOTAL"):
                    current_scheme = clean_scheme

        return cls._deduplicate_holdings(holdings)

    @classmethod
    def _deduplicate_holdings(cls, holdings: list[ParsedCasHolding]) -> list[ParsedCasHolding]:
        """Deduplicate holdings by (scheme_name, isin/folio, asset_type)."""
        unique_holdings: list[ParsedCasHolding] = []
        seen: set[tuple[str, str | None, str]] = set()

        for h in holdings:
            key = (h.scheme_name.lower(), h.isin or h.folio, h.asset_type)
            if key not in seen:
                seen.add(key)
                unique_holdings.append(h)

        return unique_holdings

