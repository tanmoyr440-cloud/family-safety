"""Use case: ManageInsurancePolicies."""

import uuid
from datetime import date
from typing import Any

from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.entities.insurance_policy import (
    InsurancePolicy,
    PolicyType,
    mask_policy_number,
)


class ManageInsurancePolicies:
    """Use case orchestrating registration, updates, and claim playbooks for insurance policies."""

    def __init__(self, uow: UnitOfWork, clock: Clock) -> None:
        self._uow = uow
        self._clock = clock

    async def get_policies(self, owner_id: str) -> list[InsurancePolicy]:
        """Fetch all insurance policies for the given owner."""
        async with self._uow:
            return await self._uow.insurance_policies.get_policies_for_owner(owner_id)

    async def get_policy_by_id(self, owner_id: str, policy_id: str) -> InsurancePolicy | None:
        """Fetch a specific insurance policy owned by owner_id."""
        async with self._uow:
            policy = await self._uow.insurance_policies.get_by_id(policy_id)
            if not policy or policy.owner_id != owner_id:
                return None
            return policy

    async def add_policy(
        self,
        owner_id: str,
        policy_name: str,
        policy_type: str,
        policy_number: str,
        insurer_name: str,
        sum_insured_paise: int,
        premium_amount_paise: int | None = None,
        premium_due_date: date | None = None,
        cashless_tpa_name: str | None = None,
        tpa_id_number: str | None = None,
        emergency_helpline: str | None = None,
        claim_email: str | None = None,
        nominee_name: str | None = None,
        nominee_relation: str | None = None,
        hospital_cashless_notes: str | None = None,
    ) -> InsurancePolicy:
        """Register a new insurance policy."""
        clean_name = policy_name.strip()
        if not clean_name:
            raise ValueError("Policy name is required.")

        clean_insurer = insurer_name.strip()
        if not clean_insurer:
            raise ValueError("Insurer name is required.")

        clean_policy_num = policy_number.strip().replace(" ", "")
        if not clean_policy_num:
            raise ValueError("Policy number is required.")

        if sum_insured_paise < 0:
            raise ValueError("Sum insured cannot be negative.")

        norm_type = policy_type.strip().upper()
        valid_types = {t.value for t in PolicyType}
        if norm_type not in valid_types:
            norm_type = PolicyType.OTHER.value

        policy = InsurancePolicy(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            policy_name=clean_name,
            policy_type=norm_type,
            policy_number=clean_policy_num,
            policy_number_masked=mask_policy_number(clean_policy_num),
            insurer_name=clean_insurer,
            sum_insured_paise=sum_insured_paise,
            premium_amount_paise=premium_amount_paise if (premium_amount_paise is not None and premium_amount_paise >= 0) else None,
            premium_due_date=premium_due_date,
            cashless_tpa_name=cashless_tpa_name.strip() if cashless_tpa_name and cashless_tpa_name.strip() else None,
            tpa_id_number=tpa_id_number.strip() if tpa_id_number and tpa_id_number.strip() else None,
            emergency_helpline=emergency_helpline.strip() if emergency_helpline and emergency_helpline.strip() else None,
            claim_email=claim_email.strip() if claim_email and claim_email.strip() else None,
            nominee_name=nominee_name.strip() if nominee_name and nominee_name.strip() else None,
            nominee_relation=nominee_relation.strip() if nominee_relation and nominee_relation.strip() else None,
            hospital_cashless_notes=hospital_cashless_notes.strip() if hospital_cashless_notes and hospital_cashless_notes.strip() else None,
            created_at=self._clock.now(),
        )

        async with self._uow:
            await self._uow.insurance_policies.save(policy)
            await self._uow.commit()

        return policy

    async def update_policy(
        self,
        owner_id: str,
        policy_id: str,
        policy_name: str | None = None,
        policy_type: str | None = None,
        policy_number: str | None = None,
        insurer_name: str | None = None,
        sum_insured_paise: int | None = None,
        premium_amount_paise: int | None = None,
        premium_due_date: date | None = None,
        cashless_tpa_name: str | None = None,
        tpa_id_number: str | None = None,
        emergency_helpline: str | None = None,
        claim_email: str | None = None,
        nominee_name: str | None = None,
        nominee_relation: str | None = None,
        hospital_cashless_notes: str | None = None,
    ) -> InsurancePolicy | None:
        """Update an existing insurance policy owned by owner_id."""
        async with self._uow:
            policy = await self._uow.insurance_policies.get_by_id(policy_id)
            if not policy or policy.owner_id != owner_id:
                return None

            if policy_name is not None:
                clean_name = policy_name.strip()
                if not clean_name:
                    raise ValueError("Policy name cannot be empty.")
                policy.policy_name = clean_name

            if insurer_name is not None:
                clean_insurer = insurer_name.strip()
                if not clean_insurer:
                    raise ValueError("Insurer name cannot be empty.")
                policy.insurer_name = clean_insurer

            if policy_number is not None:
                clean_num = policy_number.strip().replace(" ", "")
                if clean_num and not clean_num.startswith("XXXX") and not clean_num.startswith("****"):
                    policy.policy_number = clean_num
                    policy.policy_number_masked = mask_policy_number(clean_num)

            if policy_type is not None:
                norm_type = policy_type.strip().upper()
                valid_types = {t.value for t in PolicyType}
                if norm_type in valid_types:
                    policy.policy_type = norm_type

            if sum_insured_paise is not None:
                if sum_insured_paise < 0:
                    raise ValueError("Sum insured cannot be negative.")
                policy.sum_insured_paise = sum_insured_paise

            if premium_amount_paise is not None:
                policy.premium_amount_paise = premium_amount_paise if premium_amount_paise >= 0 else None

            if premium_due_date is not None:
                policy.premium_due_date = premium_due_date

            if cashless_tpa_name is not None:
                policy.cashless_tpa_name = cashless_tpa_name.strip() if cashless_tpa_name.strip() else None

            if tpa_id_number is not None:
                policy.tpa_id_number = tpa_id_number.strip() if tpa_id_number.strip() else None

            if emergency_helpline is not None:
                policy.emergency_helpline = emergency_helpline.strip() if emergency_helpline.strip() else None

            if claim_email is not None:
                policy.claim_email = claim_email.strip() if claim_email.strip() else None

            if nominee_name is not None:
                policy.nominee_name = nominee_name.strip() if nominee_name.strip() else None

            if nominee_relation is not None:
                policy.nominee_relation = nominee_relation.strip() if nominee_relation.strip() else None

            if hospital_cashless_notes is not None:
                policy.hospital_cashless_notes = hospital_cashless_notes.strip() if hospital_cashless_notes.strip() else None

            await self._uow.insurance_policies.save(policy)
            await self._uow.commit()
            return policy

    async def delete_policy(self, owner_id: str, policy_id: str) -> bool:
        """Delete an insurance policy owned by owner_id."""
        async with self._uow:
            policy = await self._uow.insurance_policies.get_by_id(policy_id)
            if not policy or policy.owner_id != owner_id:
                return False

            await self._uow.insurance_policies.delete(policy_id)
            await self._uow.commit()
            return True

    @staticmethod
    def get_claim_playbook(policy_type: str) -> dict[str, Any]:
        """Return standardized, actionable SOP for cashless hospitalization or life claim."""
        norm_type = policy_type.strip().upper()

        if norm_type == PolicyType.HEALTH.value:
            return {
                "title": "Hospital Cashless Treatment SOP",
                "summary": "Step-by-step guidance for cashless hospitalization in network hospitals.",
                "timeline_rule": "Inform within 24 hours of emergency admission, or 48 hours prior to planned surgery.",
                "steps": [
                    {
                        "step_number": 1,
                        "title": "Locate Network Hospital & TPA Desk",
                        "instruction": "Go to the hospital's Third Party Administrator (TPA) / Insurance helpdesk. Present the TPA Card ID or Policy Number alongside a Government Photo ID (Aadhaar / Voter ID).",
                        "important": True,
                    },
                    {
                        "step_number": 2,
                        "title": "Submit Cashless Pre-Authorization Form",
                        "instruction": "Fill Part A of the Cashless Request Form. The treating physician / hospital fills Part B with diagnosis and estimated costs, and faxes/submits it to the TPA.",
                        "important": False,
                    },
                    {
                        "step_number": 3,
                        "title": "Initial Authorization Approval",
                        "instruction": "The TPA evaluates policy coverage and issues an initial cashless approval letter (usually within 2 to 4 hours).",
                        "important": False,
                    },
                    {
                        "step_number": 4,
                        "title": "During Treatment & Hospital Stay",
                        "instruction": "No cash deposit is required up to the authorized amount. If surgery costs increase, the hospital requests an enhancement from the TPA.",
                        "important": False,
                    },
                    {
                        "step_number": 5,
                        "title": "Final Discharge Settlement",
                        "instruction": "Hospital sends discharge summary and final itemized bill to TPA. TPA approves final cashless amount. The patient only pays non-medical exclusions (gloves, consumables, admin fees).",
                        "important": True,
                    },
                ],
                "documents_checklist": [
                    "TPA Health Card or Policy Document",
                    "Patient & Proposer Aadhaar / PAN Card",
                    "Doctor's Consultation & Admission Advice",
                    "Diagnostic Investigation Reports (Blood, X-Ray, MRI)",
                    "Original Hospital Pre-Authorization Form",
                ],
            }

        if norm_type == PolicyType.TERM_LIFE.value:
            return {
                "title": "Term Life Insurance Death Claim SOP",
                "summary": "Step-by-step claim filing process for family nominees under Indian IRDAI rules.",
                "timeline_rule": "Notify insurer as soon as the official Death Certificate is obtained.",
                "steps": [
                    {
                        "step_number": 1,
                        "title": "Intimate the Insurer",
                        "instruction": "Call the insurer's toll-free emergency helpline or email the claims desk citing Policy Number, Date of Death, and Cause of Death.",
                        "important": True,
                    },
                    {
                        "step_number": 2,
                        "title": "Obtain Official Death Certificates",
                        "instruction": "Procure at least 5-10 original stamped copies of the Death Certificate from the local Municipal Corporation / Registrar of Births and Deaths.",
                        "important": True,
                    },
                    {
                        "step_number": 3,
                        "title": "Complete Claim Form (Form 1)",
                        "instruction": "The registered nominee fills Claimant's Statement Form with bank details (for direct NEFT payout).",
                        "important": False,
                    },
                    {
                        "step_number": 4,
                        "title": "Medical & Police Records (If applicable)",
                        "instruction": "For natural death: Hospital discharge/death summary. For accident: Police FIR, Panchnama, and Post-Mortem Report.",
                        "important": False,
                    },
                    {
                        "step_number": 5,
                        "title": "Settlement Payout",
                        "instruction": "Under IRDAI regulations, claims must be processed within 30 days of receiving all required documents.",
                        "important": True,
                    },
                ],
                "documents_checklist": [
                    "Original Policy Bond / Certificate",
                    "Official Municipal Death Certificate (Original/Attested)",
                    "Nominee's PAN Card, Aadhaar Card, and Passport Photo",
                    "Nominee's Cancelled Cheque / Bank Passbook Copy (for NEFT)",
                    "Hospital Death Summary / Treatment Records",
                    "FIR & Post Mortem Report (in case of accidental death)",
                ],
            }

        return {
            "title": "General Insurance Claim SOP",
            "summary": "Standard claim process for general, critical illness, or vehicle policies.",
            "timeline_rule": "Intimate insurer within 48 to 72 hours of incident.",
            "steps": [
                {
                    "step_number": 1,
                    "title": "Contact Emergency Helpline",
                    "instruction": "Call the toll-free number or email claim intake with Policy Number and incident description.",
                    "important": True,
                },
                {
                    "step_number": 2,
                    "title": "Document Collection",
                    "instruction": "Gather all invoices, bills, medical reports, or repair estimates.",
                    "important": False,
                },
                {
                    "step_number": 3,
                    "title": "Surveyor or Desk Verification",
                    "instruction": "Insurer assigns a surveyor or desk assessor to inspect damages or medical invoices.",
                    "important": False,
                },
                {
                    "step_number": 4,
                    "title": "Claim Payout",
                    "instruction": "Funds are transferred via NEFT to the bank account on record.",
                    "important": True,
                },
            ],
            "documents_checklist": [
                "Policy Document Copy",
                "Claim Intimation Reference Number",
                "Incident / Medical / Police Reports",
                "KYC Documents & Cancelled Cheque",
            ],
        }
