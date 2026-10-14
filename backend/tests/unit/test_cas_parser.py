"""Tests for CAS PDF statement parser (CDSL, NSDL, CAMS, KFintech)."""

import io
from pypdf import PdfWriter
import pytest

from app.infrastructure.cas.cas_parser import CasParser, CasDecryptionError, CasParsingError


def _create_sample_pdf(password: str | None = None) -> bytes:
    """Helper to generate an in-memory PDF with text stream for test isolation."""
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    if password:
        writer.encrypt(password)
    writer.write(buf)
    return buf.getvalue()


def test_cas_parser_empty_pdf():
    parser = CasParser()
    empty_pdf = _create_sample_pdf()
    parsed = parser.parse(empty_pdf)
    assert parsed == []


def test_cas_parser_password_required():
    parser = CasParser()
    encrypted_pdf = _create_sample_pdf(password="SECRET_PASSWORD")
    with pytest.raises(CasDecryptionError):
        parser.parse(encrypted_pdf, password=None)


def test_cas_parser_wrong_password():
    parser = CasParser()
    encrypted_pdf = _create_sample_pdf(password="SECRET_PASSWORD")
    with pytest.raises(CasDecryptionError):
        parser.parse(encrypted_pdf, password="WRONG_PASSWORD")


def test_cas_parser_correct_password():
    parser = CasParser()
    encrypted_pdf = _create_sample_pdf(password="SECRET_PASSWORD")
    parsed = parser.parse(encrypted_pdf, password="SECRET_PASSWORD")
    assert parsed == []


def test_cas_parser_case_insensitive_password():
    parser = CasParser()
    encrypted_pdf = _create_sample_pdf(password="ABCDE1234F")
    # Provide lowercase password, parser should uppercase automatically
    parsed = parser.parse(encrypted_pdf, password="abcde1234f")
    assert parsed == []


def test_parse_cdsl_tabular_statement():
    sample_text = """
    CENTRAL DEPOSITORY SERVICES (INDIA) LIMITED
    CONSOLIDATED ACCOUNT STATEMENT
    Period: 01-Jan-2024 to 31-Jan-2024
    BO ID: 1208160012345678
    Name: Tanmoy Ray  PAN: ABCDE1234F

    STATEMENT OF HOLDINGS
    EQUITY SHARES
    Sr No. ISIN Security Name Current Balance Free Balance Market Price Value (INR)
    1 INE002A01018 RELIANCE INDUSTRIES LTD 10.000 10.000 2950.00 29500.00
    2 INE009A01021 INFOSYS LTD 25.000 25.000 1600.00 40000.00
    3 INE123A01010 TATA MOTORS LIMITED 50 50 950.00 47500.00

    MUTUAL FUNDS
    1 INF209K01165 ADITYA BIRLA SUN LIFE LIQUID FUND - GROWTH 150.250 150.250 345.12 51854.28
    2 INF179K01BE2 HDFC SMALL CAP FUND - DIRECT PLAN - GROWTH 250.500 250.500 120.50 30185.25
    """
    holdings = CasParser.parse_text(sample_text)
    assert len(holdings) == 5

    reliance = next(h for h in holdings if "RELIANCE" in h.scheme_name)
    assert reliance.isin == "INE002A01018"
    assert reliance.units == 10.0
    assert reliance.folio == "1208160012345678"
    assert reliance.asset_type == "STOCK"

    infosys = next(h for h in holdings if "INFOSYS" in h.scheme_name)
    assert infosys.isin == "INE009A01021"
    assert infosys.units == 25.0
    assert infosys.asset_type == "STOCK"

    tata = next(h for h in holdings if "TATA" in h.scheme_name)
    assert tata.isin == "INE123A01010"
    assert tata.units == 50.0
    assert tata.asset_type == "STOCK"

    birla = next(h for h in holdings if "ADITYA BIRLA" in h.scheme_name)
    assert birla.isin == "INF209K01165"
    assert birla.units == 150.25
    assert birla.asset_type == "MUTUAL_FUND"

    hdfc = next(h for h in holdings if "HDFC" in h.scheme_name)
    assert hdfc.isin == "INF179K01BE2"
    assert hdfc.units == 250.5
    assert hdfc.asset_type == "MUTUAL_FUND"


def test_parse_cdsl_name_first_statement():
    sample_text = """
    CONSOLIDATED ACCOUNT STATEMENT
    Client ID: 1208160098765432
    EQUITY SHARES
    RELIANCE INDUSTRIES LTD INE002A01018 15.000 2950.00 44250.00
    INFOSYS LTD INE009A01021 30.000 1600.00 48000.00
    ADITYA BIRLA SUN LIFE LIQUID FUND - GROWTH INF209K01165 75.500 345.12 26056.56
    """
    holdings = CasParser.parse_text(sample_text)
    assert len(holdings) == 3

    reliance = next(h for h in holdings if "RELIANCE" in h.scheme_name)
    assert reliance.isin == "INE002A01018"
    assert reliance.units == 15.0
    assert reliance.folio == "1208160098765432"

    birla = next(h for h in holdings if "ADITYA BIRLA" in h.scheme_name)
    assert birla.isin == "INF209K01165"
    assert birla.units == 75.5


def test_parse_cdsl_multiline_cells():
    sample_text = """
    BO ID : 1208160012345678
    INE002A01018
    RELIANCE INDUSTRIES LTD
    10.000
    10.000
    2950.00
    29500.00
    INF209K01165
    ADITYA BIRLA SUN LIFE LIQUID FUND - GROWTH
    150.250
    150.250
    345.12
    51854.28
    """
    holdings = CasParser.parse_text(sample_text)
    assert len(holdings) == 2

    reliance = holdings[0]
    assert reliance.isin == "INE002A01018"
    assert "RELIANCE" in reliance.scheme_name
    assert reliance.units == 10.0
    assert reliance.folio == "1208160012345678"

    birla = holdings[1]
    assert birla.isin == "INF209K01165"
    assert "ADITYA BIRLA" in birla.scheme_name
    assert birla.units == 150.25


def test_parse_cams_kfintech_statement():
    sample_text = """
    Consolidated Account Statement
    Folio No: 12345678/90
    HDFC TOP 100 FUND - DIRECT PLAN - GROWTH
    ISIN: INF179K01BE2
    Closing Unit Balance: 245.890

    Folio No: 98765432
    ICICI PRUDENTIAL BLUECHIP FUND - GROWTH
    Balance Units: 500.123
    """
    holdings = CasParser.parse_text(sample_text)
    assert len(holdings) == 2

    hdfc = next(h for h in holdings if "HDFC" in h.scheme_name)
    assert hdfc.folio == "12345678/90"
    assert hdfc.units == 245.89
    assert hdfc.isin == "INF179K01BE2"

    icici = next(h for h in holdings if "ICICI" in h.scheme_name)
    assert icici.folio == "98765432"
    assert icici.units == 500.123


def test_parse_scheme_names_containing_index_numbers():
    sample_text = """
    BO ID: 1208160055555555
    1 INF200K01010 NIPPON INDIA ETF NIFTY 50 100.000 250.00 25000.00
    2 INF179K01111 HDFC TOP 100 FUND 50.000 120.00 6000.00
    3 INE001A01010 BHARAT 22 ETF 200.000 75.00 15000.00
    """
    holdings = CasParser.parse_text(sample_text)
    assert len(holdings) == 3

    nifty = next(h for h in holdings if "NIFTY" in h.scheme_name)
    assert "NIFTY 50" in nifty.scheme_name
    assert nifty.units == 100.0

    top100 = next(h for h in holdings if "TOP 100" in h.scheme_name)
    assert "TOP 100" in top100.scheme_name
    assert top100.units == 50.0

    bharat = next(h for h in holdings if "BHARAT 22" in h.scheme_name)
    assert "BHARAT 22" in bharat.scheme_name
    assert bharat.units == 200.0


def test_parse_cdsl_mutual_fund_with_folio_and_units():
    """Verify CDSL Section 3 line where folio number precedes unit balance."""
    sample_text = """
    CENTRAL DEPOSITORY SERVICES (INDIA) LIMITED
    CONSOLIDATED ACCOUNT STATEMENT
    BO ID: 1208160012345678
    MUTUAL FUNDS
    Sr No. ISIN Security Name Folio No. Current Balance Market Price Value (INR)
    1 INF200K01362 SBI Contra Fund - Growth 34012653 21.088 412.50 8,698.83
    """
    holdings = CasParser.parse_text(sample_text)
    assert len(holdings) == 1
    sbi = holdings[0]
    assert sbi.isin == "INF200K01362"
    assert "SBI Contra Fund" in sbi.scheme_name
    assert sbi.units == 21.088  # MUST NOT be 34012653 (the folio number)!
    assert sbi.folio == "34012653"
    assert sbi.nav == 412.50
    assert sbi.value_inr == 8698.83


def test_parse_cdsl_mutual_fund_name_first_with_folio_slash():
    """Verify holding extraction when folio contains slashes and name precedes ISIN."""
    sample_text = """
    BO ID: 1208160099999999
    HDFC Small Cap Fund INF179K01BE2 12345/67 250.500 120.50 30185.25
    """
    holdings = CasParser.parse_text(sample_text)
    assert len(holdings) == 1
    hdfc = holdings[0]
    assert hdfc.isin == "INF179K01BE2"
    assert hdfc.units == 250.500
    assert hdfc.folio == "12345/67"
    assert hdfc.nav == 120.50
    assert hdfc.value_inr == 30185.25


def test_folio_header_does_not_capture_cumulative_word():
    """Verify header 'Folio No. Cumulative Closing Balance' does not capture 'Cumulative' as folio."""
    sample_text = """
    CONSOLIDATED ACCOUNT STATEMENT
    Folio No. Cumulative Closing Balance (Units)
    1 INF200K01362 SBI Contra Fund - Growth 34012653 21.088 412.50 8,698.83
    """
    holdings = CasParser.parse_text(sample_text)
    assert len(holdings) == 1
    sbi = holdings[0]
    assert sbi.folio != "Cumulative"
    assert sbi.folio == "34012653"


def test_classify_cdsl_demat_equity_funds_under_stocks():
    """Verify CDSL Demat equity funds and ETFs held in Demat account are categorized as STOCK."""
    sample_text = """
    CENTRAL DEPOSITORY SERVICES (INDIA) LIMITED
    STATEMENT OF HOLDINGS - DEMAT
    BO ID: 1208160012345678
    HOLDING STATEMENT AS ON 30-SEP-2026
    RELIANCE INDUSTRIES LTD INE002A01018 10.000 2950.00 29500.00
    NIPPON INDIA ETF NIFTY BEES INF732E01015 100.000 257.50 25750.00
    GROWW NIFTY TOTAL MARKET INDEX FUND INF917V01014 500.000 15.20 7600.00
    PARAG PARIKH FLEXI CAP EQUITY FUND INF879O01019 250.000 78.40 19600.00
    """
    holdings = CasParser.parse_text(sample_text)
    assert len(holdings) == 4

    reliance = next(h for h in holdings if "RELIANCE" in h.scheme_name)
    assert reliance.asset_type == "STOCK"

    nifty_bees = next(h for h in holdings if "BEES" in h.scheme_name)
    assert nifty_bees.asset_type == "STOCK"

    groww_index = next(h for h in holdings if "GROWW" in h.scheme_name)
    assert groww_index.asset_type == "STOCK"

    parag_parikh = next(h for h in holdings if "PARAG PARIKH" in h.scheme_name)
    assert parag_parikh.asset_type == "STOCK"


def test_classify_cams_regular_mutual_fund_as_mutual_fund():
    """Verify standard CAMS AMC folio mutual fund is categorized as MUTUAL_FUND."""
    sample_text = """
    COMPUTER AGE MANAGEMENT SERVICES LIMITED
    CONSOLIDATED ACCOUNT STATEMENT
    MUTUAL FUNDS
    Folio No: 12345678/90
    HDFC Liquid Fund - Growth
    ISIN: INF179K01103
    Closing Balance: 45.250
    """
    holdings = CasParser.parse_text(sample_text)
    assert len(holdings) == 1
    assert holdings[0].asset_type == "MUTUAL_FUND"


