"""CAMS & KFintech CAS (Consolidated Account Statement) PDF Parser."""

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


# Common regex patterns across CAMS, KFintech, CDSL & NSDL CAS PDFs
_FOLIO_RE = re.compile(
    r"(?:Folio\s*(?:No|Number)?[:\.\s]+)([0-9A-Z\/\-]+)",
    re.IGNORECASE,
)
_ISIN_RE = re.compile(r"\b(INF[0-9A-Z]{9})\b")
_UNITS_RE = re.compile(
    r"(?:Closing\s*Unit\s*Balance|Balance\s*Units|Total\s*Units|Unit\s*Balance|Closing\s*Balance)"
    r"\s*[:\s\-]+\s*([0-9,]+\.?[0-9]*)",
    re.IGNORECASE,
)
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
)


class CasParser:
    """Extracts mutual fund holdings from CAMS/KFintech Consolidated Account Statements."""

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
        """Extract mutual fund holdings from PDF bytes or stream."""
        stream = io.BytesIO(pdf_file) if isinstance(pdf_file, bytes) else pdf_file

        try:
            reader = PdfReader(stream)
        except Exception as exc:
            raise CasParsingError(f"Failed to read PDF file: {exc}") from exc

        if reader.is_encrypted:
            cleaned_pw = (password or "").strip()
            # Try provided password first, then uppercase PAN attempt
            decrypted = False
            for pw_candidate in [cleaned_pw, cleaned_pw.upper(), cleaned_pw.lower()]:
                if pw_candidate:
                    try:
                        res = reader.decrypt(pw_candidate)
                        if res in (1, 2):  # 1 = user pw, 2 = owner pw
                            decrypted = True
                            break
                    except Exception:
                        continue

            if not decrypted:
                raise CasDecryptionError(
                    "Password incorrect or required. CAS statements from CAMS/KFintech "
                    "are usually protected by your PAN in UPPERCASE or DOB (DDMMYYYY)."
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
    def parse_text(cls, text: str) -> list[ParsedCasHolding]:
        """Parse raw extracted text from a CAS statement."""
        holdings: list[ParsedCasHolding] = []
        lines = [line.strip() for line in text.splitlines() if line.strip()]

        current_folio: str | None = None
        current_scheme: str | None = None
        current_isin: str | None = None

        for line in lines:
            # 1. Check for Folio
            folio_match = _FOLIO_RE.search(line)
            if folio_match:
                cand = folio_match.group(1).strip()
                if len(cand) >= 4 and not cand.lower().startswith("nil"):
                    current_folio = cand

            # 2. Check for ISIN
            isin_match = _ISIN_RE.search(line)
            if isin_match:
                current_isin = isin_match.group(1).strip()

            # 3. Check for Scheme Name candidate
            upper_line = line.upper()
            if (
                any(kw in upper_line for kw in _SCHEME_KEYWORDS)
                and len(line) >= 8
                and not line.startswith("Page ")
                and not line.startswith("Date:")
                and not line.startswith("Email:")
                and not line.startswith("PAN:")
                and not "Consolidated Account Statement" in line
            ):
                # Clean prefix artifacts like "1. ", "Scheme: "
                clean_scheme = re.sub(
                    r"^(?:\d+[\.\)]\s*|Scheme\s*[:\-]\s*)", "", line, flags=re.IGNORECASE
                ).strip()
                if len(clean_scheme) >= 8:
                    current_scheme = clean_scheme

            # 4. Check for Units Balance
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
                                folio=current_folio,
                                isin=current_isin,
                            )
                        )
                        # Reset scheme to avoid duplicate assignments for same line
                        current_scheme = None
                        current_isin = None
                except ValueError:
                    continue

        # Deduplicate holdings by (scheme_name, folio)
        unique_holdings: list[ParsedCasHolding] = []
        seen: set[tuple[str, str | None]] = set()

        for h in holdings:
            key = (h.scheme_name.lower(), h.folio)
            if key not in seen:
                seen.add(key)
                unique_holdings.append(h)

        return unique_holdings
