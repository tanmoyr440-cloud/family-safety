"""CDSL, NSDL, CAMS & KFintech CAS (Consolidated Account Statement) PDF Parser."""

import io
import re
from dataclasses import dataclass
from typing import BinaryIO

from pypdf import PdfReader


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


# Common regex patterns across CDSL, NSDL, CAMS & KFintech CAS PDFs
_FOLIO_RE = re.compile(
    r"(?:Folio\s*(?:No|Number)?[:\.\s]+)([0-9A-Z\/\-]+)",
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
    def parse_pdf(
        cls,
        pdf_file: bytes | BinaryIO,
        password: str | None = None,
    ) -> list[ParsedCasHolding]:
        """Extract holdings from PDF bytes or stream."""
        stream = io.BytesIO(pdf_file) if isinstance(pdf_file, bytes) else pdf_file

        try:
            reader = PdfReader(stream)
        except Exception as exc:
            raise CasParsingError(f"Failed to read PDF file: {exc}") from exc

        if reader.is_encrypted:
            cleaned_pw = (password or "").strip()
            candidates: list[str] = []
            if cleaned_pw:
                candidates.extend(
                    [
                        cleaned_pw,
                        cleaned_pw.upper(),
                        cleaned_pw.lower(),
                        cleaned_pw.replace(" ", ""),
                        cleaned_pw.replace(" ", "").upper(),
                        cleaned_pw.replace("-", ""),
                        cleaned_pw.replace("-", "").upper(),
                    ]
                )

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
    def _try_parse_tabular_line(cls, line: str) -> tuple[str, str, float] | None:
        """Parse a single line representing a CDSL or NSDL table row.

        Returns (isin, scheme_name, units) if matched, else None.
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
            num_start_idx = None
            for i in range(len(tokens) - 1, -1, -1):
                tok = tokens[i].replace(",", "")
                try:
                    float(tok)
                    num_start_idx = i
                except ValueError:
                    break

            if num_start_idx is not None and num_start_idx > 0:
                # Check if token immediately before num_start_idx is an index prefix (e.g. NIFTY 50)
                prev_word = tokens[num_start_idx - 1].upper().strip(" -:")
                if prev_word in _INDEX_PREFIX_KEYWORDS and num_start_idx + 1 < len(tokens):
                    num_start_idx += 1

                name_tokens = tokens[:num_start_idx]
                scheme_name = " ".join(name_tokens).strip(" -:")
                if len(scheme_name) >= 3:
                    try:
                        units = float(tokens[num_start_idx].replace(",", ""))
                        if units > 0:
                            return isin, scheme_name, units
                    except (ValueError, IndexError):
                        pass

        # Case 2: ISIN is in the middle of the row (name appears before ISIN)
        if before and not re.match(r"^\d+[\.\)]?$", before):
            clean_name = re.sub(r"^\d+[\.\)]?\s+", "", before).strip(" -:")
            tokens = after.split()
            if tokens and len(clean_name) >= 3:
                try:
                    units = float(tokens[0].replace(",", ""))
                    if units > 0:
                        return isin, clean_name, units
                except ValueError:
                    pass

        return None

    @classmethod
    def parse_text(cls, text: str) -> list[ParsedCasHolding]:
        """Parse raw extracted text from a CDSL, NSDL, CAMS, or KFintech CAS statement."""
        holdings: list[ParsedCasHolding] = []
        lines = [line.strip() for line in text.splitlines() if line.strip()]

        current_folio: str | None = None
        current_demat_account: str | None = None
        current_scheme: str | None = None
        current_isin: str | None = None

        for line in lines:
            upper_line = line.upper()

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
                isin, scheme_name, units = tabular_res
                holdings.append(
                    ParsedCasHolding(
                        scheme_name=scheme_name,
                        units=units,
                        folio=current_folio or current_demat_account,
                        isin=isin,
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
                        holdings.append(
                            ParsedCasHolding(
                                scheme_name=current_scheme,
                                units=units_val,
                                folio=current_folio or current_demat_account,
                                isin=current_isin,
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
            # (e.g. Line 1: ISIN/Name, Line 2: Name/ISIN, Line 3: Units)
            if (current_scheme and current_isin) or (current_scheme and current_folio):
                tokens = line.split()
                if tokens:
                    try:
                        first_num = float(tokens[0].replace(",", ""))
                        if first_num > 0 and len(tokens[0]) <= 15:
                            holdings.append(
                                ParsedCasHolding(
                                    scheme_name=current_scheme,
                                    units=first_num,
                                    folio=current_folio or current_demat_account,
                                    isin=current_isin,
                                )
                            )
                            current_scheme = None
                            current_isin = None
                            continue
                    except ValueError:
                        pass

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

        # Deduplicate holdings by (scheme_name, isin/folio)
        unique_holdings: list[ParsedCasHolding] = []
        seen: set[tuple[str, str | None]] = set()

        for h in holdings:
            key = (h.scheme_name.lower(), h.isin or h.folio)
            if key not in seen:
                seen.add(key)
                unique_holdings.append(h)

        return unique_holdings
