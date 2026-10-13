"""Unit tests for BankAccount domain entity, account masking, and IFSC validation."""

import pytest

from app.domain.entities.bank_account import (
    BankAccount,
    is_valid_ifsc,
    mask_bank_account_number,
    normalize_ifsc,
)


def test_mask_bank_account_number() -> None:
    assert mask_bank_account_number("123456789012") == "XXXX9012"
    assert mask_bank_account_number("1234 5678 9012") == "XXXX9012"
    assert mask_bank_account_number("501002345678") == "XXXX5678"
    assert mask_bank_account_number("1234") == "1234"
    assert mask_bank_account_number("12") == "12"


def test_ifsc_normalization() -> None:
    assert normalize_ifsc(" sbin0001234 ") == "SBIN0001234"
    assert normalize_ifsc("hdfc0000001") == "HDFC0000001"


def test_ifsc_validation() -> None:
    # Valid IFSC codes
    assert is_valid_ifsc("SBIN0001234") is True
    assert is_valid_ifsc("HDFC0000001") is True
    assert is_valid_ifsc("ICIC0006282") is True
    assert is_valid_ifsc("UTIB0000004") is True
    assert is_valid_ifsc("sbin0001234") is True  # auto normalized

    # Invalid IFSC codes
    assert is_valid_ifsc("SBIN1001234") is False  # 5th char must be 0
    assert is_valid_ifsc("SBI0001234") is False  # too short
    assert is_valid_ifsc("SBIN00012345") is False  # too long
    assert is_valid_ifsc("12340001234") is False  # bank code must be letters
    assert is_valid_ifsc("") is False


def test_bank_account_creation() -> None:
    account = BankAccount(
        id="ba-1",
        owner_id="owner-1",
        bank_name="HDFC Bank",
        account_number_masked="XXXX1234",
        ifsc_code="HDFC0000001",
        branch_name="Indiranagar Branch",
        account_type="SAVINGS",
        holder_name="Tanmoy Sengupta",
    )
    assert account.id == "ba-1"
    assert account.bank_name == "HDFC Bank"
    assert account.account_number_masked == "XXXX1234"
    assert account.ifsc_code == "HDFC0000001"
    assert account.account_type == "SAVINGS"
