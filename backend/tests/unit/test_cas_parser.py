"""Tests for CAS PDF statement parser."""

import io
from pypdf import PdfWriter
import pytest

from app.infrastructure.cas.cas_parser import CasParser, CasDecryptionError, CasParsingError


def _create_sample_pdf(text: str, password: str | None = None) -> bytes:
    """Helper to generate an in-memory PDF with text stream for test isolation."""
    writer = PdfWriter()
    # Add a blank page
    writer.add_blank_page(width=612, height=792)
    
    # We can write page text or metadata, or use PdfWriter annotations/streams
    # Alternatively, create a PDF using standard PDF syntax
    buf = io.BytesIO()
    if password:
        writer.encrypt(password)
    writer.write(buf)
    return buf.getvalue()


def test_cas_parser_empty_pdf():
    parser = CasParser()
    empty_pdf = _create_sample_pdf("")
    parsed = parser.parse(empty_pdf)
    assert parsed == []


def test_cas_parser_password_required():
    parser = CasParser()
    encrypted_pdf = _create_sample_pdf("", password="SECRET_PASSWORD")
    with pytest.raises(CasDecryptionError):
        parser.parse(encrypted_pdf, password=None)


def test_cas_parser_wrong_password():
    parser = CasParser()
    encrypted_pdf = _create_sample_pdf("", password="SECRET_PASSWORD")
    with pytest.raises(CasDecryptionError):
        parser.parse(encrypted_pdf, password="WRONG_PASSWORD")


def test_cas_parser_correct_password():
    parser = CasParser()
    encrypted_pdf = _create_sample_pdf("", password="SECRET_PASSWORD")
    parsed = parser.parse(encrypted_pdf, password="SECRET_PASSWORD")
    assert parsed == []
