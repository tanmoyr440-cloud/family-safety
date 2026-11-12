"""Insurance policies and cashless claim hub router."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, status

from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.manage_insurance_policies import ManageInsurancePolicies
from app.domain.entities.insurance_policy import InsurancePolicy
from app.domain.entities.owner import Owner
from app.interfaces.api.dependencies import get_current_owner, get_uow
from app.interfaces.api.errors import BadRequestException, NotFoundException
from app.interfaces.api.schemas import (
    ActionResponse,
    AddInsurancePolicyRequest,
    ClaimPlaybookResponse,
    ClaimPlaybookStep,
    InsurancePolicyResponse,
    UpdateInsurancePolicyRequest,
)


class SystemClock(Clock):
    """System clock provider."""

    def now(self) -> datetime:
        return datetime.now(UTC)


clock = SystemClock()
router = APIRouter(tags=["insurance"])


def _map_policy(p: InsurancePolicy) -> InsurancePolicyResponse:
    has_unmasked = bool(
        p.policy_number
        and not p.policy_number.startswith("XXXX")
        and not p.policy_number.startswith("****")
    )
    return InsurancePolicyResponse(
        id=p.id,
        policy_name=p.policy_name,
        policy_type=p.policy_type,
        policy_number=p.policy_number,
        policy_number_masked=p.policy_number_masked,
        has_unmasked_policy=has_unmasked,
        insurer_name=p.insurer_name,
        sum_insured_paise=p.sum_insured_paise,
        premium_amount_paise=p.premium_amount_paise,
        premium_due_date=p.premium_due_date,
        cashless_tpa_name=p.cashless_tpa_name,
        tpa_id_number=p.tpa_id_number,
        emergency_helpline=p.emergency_helpline,
        claim_email=p.claim_email,
        nominee_name=p.nominee_name,
        nominee_relation=p.nominee_relation,
        hospital_cashless_notes=p.hospital_cashless_notes,
        created_at=p.created_at,
    )


@router.get(
    "/insurance",
    response_model=list[InsurancePolicyResponse],
    operation_id="listInsurancePolicies",
    summary="List registered insurance policies",
)
async def list_insurance_policies(
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> list[InsurancePolicyResponse]:
    """Retrieve all registered insurance policies for authenticated owner."""
    use_case = ManageInsurancePolicies(uow=uow, clock=clock)
    policies = await use_case.get_policies(current_owner.id)
    return [_map_policy(p) for p in policies]


@router.post(
    "/insurance",
    response_model=InsurancePolicyResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="addInsurancePolicy",
    summary="Register a new insurance policy",
)
async def add_insurance_policy(
    body: AddInsurancePolicyRequest,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> InsurancePolicyResponse:
    """Register an insurance policy with TPA details and claim guidelines."""
    use_case = ManageInsurancePolicies(uow=uow, clock=clock)
    try:
        policy = await use_case.add_policy(
            owner_id=current_owner.id,
            policy_name=body.policy_name,
            policy_type=body.policy_type,
            policy_number=body.policy_number,
            insurer_name=body.insurer_name,
            sum_insured_paise=body.sum_insured_paise,
            premium_amount_paise=body.premium_amount_paise,
            premium_due_date=body.premium_due_date,
            cashless_tpa_name=body.cashless_tpa_name,
            tpa_id_number=body.tpa_id_number,
            emergency_helpline=body.emergency_helpline,
            claim_email=body.claim_email,
            nominee_name=body.nominee_name,
            nominee_relation=body.nominee_relation,
            hospital_cashless_notes=body.hospital_cashless_notes,
        )
    except ValueError as exc:
        raise BadRequestException(str(exc)) from exc

    return _map_policy(policy)


@router.get(
    "/insurance/playbook/{policy_type}",
    response_model=ClaimPlaybookResponse,
    operation_id="getInsuranceClaimPlaybook",
    summary="Get claim settlement SOP playbook",
)
async def get_claim_playbook(
    policy_type: str,
    _current_owner: Owner = Depends(get_current_owner),
) -> ClaimPlaybookResponse:
    """Retrieve step-by-step guidance for cashless hospital admission or life claim filing."""
    raw = ManageInsurancePolicies.get_claim_playbook(policy_type)
    steps = [
        ClaimPlaybookStep(
            step_number=s["step_number"],
            title=s["title"],
            instruction=s["instruction"],
            important=s.get("important", False),
        )
        for s in raw["steps"]
    ]
    return ClaimPlaybookResponse(
        title=raw["title"],
        summary=raw["summary"],
        timeline_rule=raw["timeline_rule"],
        steps=steps,
        documents_checklist=raw["documents_checklist"],
    )


@router.get(
    "/insurance/{id}",
    response_model=InsurancePolicyResponse,
    operation_id="getInsurancePolicy",
    summary="Get details of an insurance policy",
)
async def get_insurance_policy(
    id: str,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> InsurancePolicyResponse:
    """Get single insurance policy by id."""
    use_case = ManageInsurancePolicies(uow=uow, clock=clock)
    policy = await use_case.get_policy_by_id(owner_id=current_owner.id, policy_id=id)
    if not policy:
        raise NotFoundException("Insurance policy not found.")
    return _map_policy(policy)


@router.patch(
    "/insurance/{id}",
    response_model=InsurancePolicyResponse,
    operation_id="updateInsurancePolicy",
    summary="Update an existing insurance policy",
)
@router.put(
    "/insurance/{id}",
    response_model=InsurancePolicyResponse,
    include_in_schema=False,
)
async def update_insurance_policy(
    id: str,
    body: UpdateInsurancePolicyRequest,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> InsurancePolicyResponse:
    """Update policy details, sum insured, TPA card, or claim contacts."""
    use_case = ManageInsurancePolicies(uow=uow, clock=clock)
    try:
        policy = await use_case.update_policy(
            owner_id=current_owner.id,
            policy_id=id,
            policy_name=body.policy_name,
            policy_type=body.policy_type,
            policy_number=body.policy_number,
            insurer_name=body.insurer_name,
            sum_insured_paise=body.sum_insured_paise,
            premium_amount_paise=body.premium_amount_paise,
            premium_due_date=body.premium_due_date,
            cashless_tpa_name=body.cashless_tpa_name,
            tpa_id_number=body.tpa_id_number,
            emergency_helpline=body.emergency_helpline,
            claim_email=body.claim_email,
            nominee_name=body.nominee_name,
            nominee_relation=body.nominee_relation,
            hospital_cashless_notes=body.hospital_cashless_notes,
        )
    except ValueError as exc:
        raise BadRequestException(str(exc)) from exc

    if not policy:
        raise NotFoundException("Insurance policy not found.")

    return _map_policy(policy)


@router.delete(
    "/insurance/{id}",
    response_model=ActionResponse,
    operation_id="deleteInsurancePolicy",
    summary="Delete a registered insurance policy",
)
async def delete_insurance_policy(
    id: str,
    current_owner: Owner = Depends(get_current_owner),
    uow: UnitOfWork = Depends(get_uow),
) -> ActionResponse:
    """Remove a registered insurance policy."""
    use_case = ManageInsurancePolicies(uow=uow, clock=clock)
    deleted = await use_case.delete_policy(owner_id=current_owner.id, policy_id=id)
    if not deleted:
        raise NotFoundException("Insurance policy not found.")
    return ActionResponse(message="Insurance policy deleted successfully.")
