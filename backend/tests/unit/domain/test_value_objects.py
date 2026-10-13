"""Unit tests for domain value objects."""

from datetime import date
from decimal import Decimal
from typing import cast

import pytest

from app.domain.errors import (
    InvalidDays,
    InvalidDueDay,
    InvalidEmailAddress,
    InvalidMoney,
    InvalidPhoneNumber,
)
from app.domain.value_objects.days import Days
from app.domain.value_objects.due_day import DueDay
from app.domain.value_objects.email_address import EmailAddress
from app.domain.value_objects.money import Money
from app.domain.value_objects.phone_number import PhoneNumber


class TestMoney:
    """Tests for Money value object."""

    def test_create_with_integer_paise(self) -> None:
        m = Money(1_616_600)
        assert m.paise == 1_616_600

    def test_from_rupees_decimal(self) -> None:
        m = Money.from_rupees(Decimal("16166.00"))
        assert m.paise == 1_616_600

    def test_from_rupees_rejects_non_decimal(self) -> None:
        with pytest.raises(TypeError, match="rupees must be a Decimal"):
            Money.from_rupees(16166.0)  # type: ignore[arg-type]

    def test_reject_float(self) -> None:
        with pytest.raises(TypeError, match="paise must be an int"):
            Money(16166.50)  # type: ignore[arg-type]

    def test_reject_boolean(self) -> None:
        bool_val = cast(int, True)
        with pytest.raises(TypeError, match="paise must be an int"):
            Money(bool_val)

    def test_reject_negative_paise(self) -> None:
        with pytest.raises(InvalidMoney, match="cannot be negative"):
            Money(-100)

    def test_arithmetic_addition_subtraction(self) -> None:
        m1 = Money(100)
        m2 = Money(200)
        assert (m1 + m2) == Money(300)
        assert (m2 - m1) == Money(100)

    def test_arithmetic_with_non_money_returns_not_implemented(self) -> None:
        m = Money(100)
        non_money = cast(Money, 100)
        assert m.__add__(non_money) is NotImplemented
        assert m.__sub__(non_money) is NotImplemented
        assert m.__lt__(non_money) is NotImplemented
        assert m.__le__(non_money) is NotImplemented
        assert m.__gt__(non_money) is NotImplemented
        assert m.__ge__(non_money) is NotImplemented

    def test_subtraction_underflow_raises_error(self) -> None:
        with pytest.raises(InvalidMoney):
            _ = Money(100) - Money(200)

    def test_comparisons(self) -> None:
        assert Money(100) < Money(200)
        assert Money(200) > Money(100)
        assert Money(100) <= Money(100)
        assert Money(100) >= Money(100)
        assert Money(100) == Money(100)
        assert Money(100) != Money(200)

    def test_string_representation(self) -> None:
        assert str(Money(100)) == "100 paise"

    def test_immutability(self) -> None:
        m = Money(100)
        with pytest.raises((AttributeError, TypeError)):
            m.paise = 200  # type: ignore[misc]


class TestPhoneNumber:
    """Tests for PhoneNumber value object."""

    @pytest.mark.parametrize(
        ("raw", "normalized"),
        [
            ("+919876543210", "+919876543210"),
            ("+91 98765 43210", "+919876543210"),
            ("+1-555-234-5678", "+15552345678"),
            ("+44 20 7946 0958", "+442079460958"),
        ],
    )
    def test_valid_e164_normalization(self, raw: str, normalized: str) -> None:
        phone = PhoneNumber(raw)
        assert phone.value == normalized
        assert str(phone) == normalized

    @pytest.mark.parametrize(
        "invalid",
        [
            "",
            "123",
            "9876543210",  # missing leading plus / country code
            "+",
            "+91",
            "+91abcdefghij",
            "not-a-number",
            "+1234567890123456",  # exceeds E.164 15 digits
        ],
    )
    def test_reject_invalid_phone_numbers(self, invalid: str) -> None:
        with pytest.raises(InvalidPhoneNumber):
            PhoneNumber(invalid)


class TestEmailAddress:
    """Tests for EmailAddress value object."""

    @pytest.mark.parametrize(
        ("raw", "normalized"),
        [
            ("User@Example.COM", "user@example.com"),
            ("  test.account+safety@gmail.com  ", "test.account+safety@gmail.com"),
        ],
    )
    def test_valid_normalization(self, raw: str, normalized: str) -> None:
        email = EmailAddress(raw)
        assert email.value == normalized
        assert str(email) == normalized

    @pytest.mark.parametrize(
        "invalid",
        [
            "",
            "not-an-email",
            "@missing-local.com",
            "missing-domain@",
            "spaces in@domain.com",
        ],
    )
    def test_reject_invalid_emails(self, invalid: str) -> None:
        with pytest.raises(InvalidEmailAddress):
            EmailAddress(invalid)


class TestDueDay:
    """Tests for DueDay value object."""

    def test_valid_due_day(self) -> None:
        day = DueDay(24)
        assert day.value == 24

    @pytest.mark.parametrize("invalid", [0, 32, -5, 100])
    def test_reject_invalid_day(self, invalid: int) -> None:
        with pytest.raises(InvalidDueDay):
            DueDay(invalid)

    def test_due_date_regular_month(self) -> None:
        day = DueDay(24)
        assert day.due_date_for(2026, 10) == date(2026, 10, 24)

    def test_due_date_february_non_leap(self) -> None:
        day = DueDay(31)
        assert day.due_date_for(2026, 2) == date(2026, 2, 28)

    def test_due_date_february_leap(self) -> None:
        day = DueDay(31)
        assert day.due_date_for(2024, 2) == date(2024, 2, 29)

    def test_due_date_30_day_month(self) -> None:
        day = DueDay(31)
        assert day.due_date_for(2026, 4) == date(2026, 4, 30)

    def test_due_day_string(self) -> None:
        assert str(DueDay(24)) == "24"

    def test_reject_boolean_and_non_int(self) -> None:
        with pytest.raises(InvalidDueDay):
            DueDay(cast(int, True))
        with pytest.raises(InvalidDueDay):
            DueDay(cast(int, "24"))


class TestDays:
    """Tests for Days value object."""

    def test_valid_days(self) -> None:
        d = Days(90)
        assert d.value == 90

    def test_zero_days(self) -> None:
        d = Days(0)
        assert d.value == 0

    def test_negative_days(self) -> None:
        with pytest.raises(InvalidDays):
            Days(-1)

    def test_days_string(self) -> None:
        assert str(Days(90)) == "90 days"

    def test_reject_boolean_and_non_int(self) -> None:
        with pytest.raises(InvalidDays):
            Days(cast(int, True))
        with pytest.raises(InvalidDays):
            Days(cast(int, "90"))
