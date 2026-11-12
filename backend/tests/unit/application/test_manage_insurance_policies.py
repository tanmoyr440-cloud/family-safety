"""Unit tests for ManageInsurancePolicies use case."""

from datetime import UTC, date, datetime

import pytest

from app.application.use_cases.manage_insurance_policies import ManageInsurancePolicies
from app.domain.entities.insurance_policy import PolicyType
from tests.fakes.fake_clock import FakeClock
from tests.fakes.in_memory_uow import InMemoryUnitOfWork


@pytest.fixture
def uow() -> InMemoryUnitOfWork:
    return InMemoryUnitOfWork()


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock(datetime(2026, 1, 15, 10, 0, tzinfo=UTC))


@pytest.mark.asyncio
async def test_add_insurance_policy_success(uow: InMemoryUnitOfWork, clock: FakeClock) -> None:
    use_case = ManageInsurancePolicies(uow=uow, clock=clock)
    policy = await use_case.add_policy(
        owner_id="owner-123",
        policy_name="Optima Secure",
        policy_type="HEALTH",
        policy_number="HDFC12345678",
        insurer_name="HDFC ERGO",
        sum_insured_paise=100_000_000,
        premium_amount_paise=1_850_000,
        premium_due_date=date(2026, 12, 1),
        cashless_tpa_name="Medi Assist",
        tpa_id_number="TPA999",
        emergency_helpline="1800 2666 400",
        claim_email="claims@hdfcergo.com",
        nominee_name="Father",
        nominee_relation="Father",
        hospital_cashless_notes="Inform TPA counter within 24h.",
    )

    assert policy.id is not None
    assert policy.owner_id == "owner-123"
    assert policy.policy_name == "Optima Secure"
    assert policy.policy_type == "HEALTH"
    assert policy.policy_number_masked == "XXXX5678"
    assert policy.insurer_name == "HDFC ERGO"
    assert policy.sum_insured_paise == 100_000_000
    assert policy.cashless_tpa_name == "Medi Assist"
    assert uow.committed is True

    policies = await use_case.get_policies("owner-123")
    assert len(policies) == 1
    assert policies[0].id == policy.id


@pytest.mark.asyncio
async def test_add_insurance_policy_validation_errors(
    uow: InMemoryUnitOfWork, clock: FakeClock
) -> None:
    use_case = ManageInsurancePolicies(uow=uow, clock=clock)

    with pytest.raises(ValueError, match="Policy name is required"):
        await use_case.add_policy(
            owner_id="owner-123",
            policy_name="   ",
            policy_type="HEALTH",
            policy_number="12345",
            insurer_name="HDFC ERGO",
            sum_insured_paise=100_000,
        )

    with pytest.raises(ValueError, match="Insurer name is required"):
        await use_case.add_policy(
            owner_id="owner-123",
            policy_name="Optima Secure",
            policy_type="HEALTH",
            policy_number="12345",
            insurer_name="   ",
            sum_insured_paise=100_000,
        )

    with pytest.raises(ValueError, match="Sum insured cannot be negative"):
        await use_case.add_policy(
            owner_id="owner-123",
            policy_name="Optima Secure",
            policy_type="HEALTH",
            policy_number="12345",
            insurer_name="HDFC ERGO",
            sum_insured_paise=-10,
        )


@pytest.mark.asyncio
async def test_update_and_delete_insurance_policy(
    uow: InMemoryUnitOfWork, clock: FakeClock
) -> None:
    use_case = ManageInsurancePolicies(uow=uow, clock=clock)
    policy = await use_case.add_policy(
        owner_id="owner-123",
        policy_name="Optima Secure",
        policy_type="HEALTH",
        policy_number="POL123456",
        insurer_name="HDFC ERGO",
        sum_insured_paise=50_000_000,
    )

    # Update sum insured and policy name
    updated = await use_case.update_policy(
        owner_id="owner-123",
        policy_id=policy.id,
        policy_name="Optima Secure Enhanced",
        sum_insured_paise=100_000_000,
        cashless_tpa_name="Paramount TPA",
    )
    assert updated is not None
    assert updated.policy_name == "Optima Secure Enhanced"
    assert updated.sum_insured_paise == 100_000_000
    assert updated.cashless_tpa_name == "Paramount TPA"

    # Other owner cannot update
    other_update = await use_case.update_policy(
        owner_id="other-owner",
        policy_id=policy.id,
        policy_name="Hacked",
    )
    assert other_update is None

    # Delete policy
    assert await use_case.delete_policy("other-owner", policy.id) is False
    assert await use_case.delete_policy("owner-123", policy.id) is True
    assert len(await use_case.get_policies("owner-123")) == 0


def test_claim_playbooks() -> None:
    health_playbook = ManageInsurancePolicies.get_claim_playbook(PolicyType.HEALTH.value)
    assert health_playbook["title"] == "Hospital Cashless Treatment SOP"
    assert len(health_playbook["steps"]) == 5
    assert len(health_playbook["documents_checklist"]) > 0

    term_playbook = ManageInsurancePolicies.get_claim_playbook(PolicyType.TERM_LIFE.value)
    assert term_playbook["title"] == "Term Life Insurance Death Claim SOP"
    assert len(term_playbook["steps"]) == 5
