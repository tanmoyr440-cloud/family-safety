"""Unit tests for InsurancePolicy domain entity and policy number masking."""

from datetime import date

from app.domain.entities.insurance_policy import (
    InsurancePolicy,
    PolicyType,
    mask_policy_number,
)


def test_mask_policy_number() -> None:
    assert mask_policy_number("28252001234567") == "XXXX4567"
    assert mask_policy_number("POL 9988 7766") == "XXXX7766"
    assert mask_policy_number("1234") == "1234"
    assert mask_policy_number("12") == "12"


def test_insurance_policy_creation() -> None:
    policy = InsurancePolicy(
        id="pol-1",
        owner_id="owner-1",
        policy_name="HDFC ERGO Optima Secure",
        policy_type=PolicyType.HEALTH.value,
        policy_number="28252001234567",
        policy_number_masked="XXXX4567",
        insurer_name="HDFC ERGO General Insurance",
        sum_insured_paise=100_000_000,  # 10 Lakhs
        premium_amount_paise=1_850_000,  # 18,500 INR
        premium_due_date=date(2026, 12, 15),
        cashless_tpa_name="Medi Assist TPA",
        tpa_id_number="MED998877",
        emergency_helpline="1800 2666 400",
        claim_email="claims@hdfcergo.com",
        nominee_name="Parents",
        nominee_relation="Parents",
        hospital_cashless_notes="Show Medi Assist card at admission desk within 24h.",
    )
    assert policy.id == "pol-1"
    assert policy.policy_name == "HDFC ERGO Optima Secure"
    assert policy.policy_type == "HEALTH"
    assert policy.sum_insured_paise == 100_000_000
    assert policy.cashless_tpa_name == "Medi Assist TPA"
    assert policy.emergency_helpline == "1800 2666 400"
