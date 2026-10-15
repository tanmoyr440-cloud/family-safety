"""Use case: EvaluateInactivity."""

from zoneinfo import ZoneInfo

from app.application.dto import EvaluationReport
from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.application.services.notification_composer import NotificationComposer
from app.domain.entities.inactivity_monitor import InactivityStage
from app.domain.policies.escalation_policy import EscalationPolicy
from app.domain.policies.inactivity_policy import InactivityPolicy


class EvaluateInactivity:
    """Evaluates an owner's inactivity against policy thresholds and enqueues escalations."""

    def __init__(
        self,
        uow: UnitOfWork,
        clock: Clock,
        composer: NotificationComposer | None = None,
    ) -> None:
        self._uow = uow
        self._clock = clock
        self._composer = composer or NotificationComposer()

    async def execute(self, owner_id: str) -> EvaluationReport:
        """Evaluate owner inactivity, enqueuing outbox messages if a new stage is reached."""
        now = self._clock.now()
        messages_queued = 0

        async with self._uow:
            owner = await self._uow.owners.get_by_id(owner_id)
            if owner is None:
                return EvaluationReport(
                    owner_id=owner_id, current_stage="UNKNOWN", messages_queued=0
                )

            monitor = await self._uow.monitors.get_for_owner(owner_id)
            if monitor is None:
                return EvaluationReport(
                    owner_id=owner_id,
                    current_stage="OK",
                    messages_queued=0,
                )

            contacts = await self._uow.contacts.get_contacts_for_owner(owner_id)

            tz = ZoneInfo(owner.timezone)
            new_stage = InactivityPolicy.evaluate(
                last_activity_at=monitor.last_activity_at,
                now=now,
                config=monitor.config,
                paused_until=monitor.paused_until,
                timezone=tz,
            )

            # Only escalate if stage advanced to a new non-OK stage
            if new_stage != InactivityStage.OK and new_stage != monitor.status:
                plan = EscalationPolicy.resolve(
                    stage=new_stage,
                    owner=owner,
                    contacts=contacts,
                    now=now,
                )

                mf_holdings = await self._uow.mutual_funds.get_holdings_for_owner(owner.id)
                loans = await self._uow.loans.get_loans_for_owner(owner.id)
                bank_accounts = await self._uow.bank_accounts.get_accounts_for_owner(owner.id)

                holdings_data = [
                    {
                        "scheme_name": h.scheme_name,
                        "fund_house": h.fund_house,
                        "units": h.units,
                        "folio_masked": h.folio_masked,
                        "value_inr": (
                            f"{getattr(h, 'value_paise', None) / 100:,.2f}"
                            if getattr(h, "value_paise", None) is not None
                            else None
                        ),
                    }
                    for h in mf_holdings
                ]
                total_mf_paise = sum(getattr(h, "value_paise", None) or 0 for h in mf_holdings)
                total_mf_val_str = f"{total_mf_paise / 100:,.2f}" if total_mf_paise > 0 else None

                loans_data = [
                    {
                        "lender": l.lender,
                        "account_masked": l.account_masked,
                        "emi_inr": f"{l.emi.paise / 100:,.2f}",
                        "due_day": l.due_day.value,
                        "grace_days": l.grace_days,
                    }
                    for l in loans
                ]
                bank_accounts_data = [
                    {
                        "bank_name": b.bank_name,
                        "account_number_masked": b.account_number_masked,
                        "ifsc_code": b.ifsc_code,
                        "branch_name": b.branch_name,
                        "account_type": b.account_type,
                    }
                    for b in bank_accounts
                ]
                contact_names = {c.id: c.name for c in contacts}
                days_idle = (now - monitor.last_activity_at).days if monitor.last_activity_at else 90

                for recipient in plan.recipients:
                    recipient_name = contact_names.get(recipient.contact_id, "Family Contact") if recipient.contact_id else owner.name
                    payload_extra = {
                        "owner_name": owner.name,
                        "recipient_name": recipient_name,
                        "packet_url": "http://localhost:5173/public/packet",
                        "holdings": holdings_data,
                        "total_mf_value_inr": total_mf_val_str,
                        "loans": loans_data,
                        "bank_accounts": bank_accounts_data,
                        "days_idle": max(0, days_idle),
                    }
                    msg = self._composer.compose_inactivity_message(
                        owner_id=owner.id,
                        episode_id=monitor.episode_id,
                        stage=new_stage.value,
                        recipient=recipient,
                        now=now,
                        payload_extra=payload_extra,
                    )
                    inserted = await self._uow.outbox.enqueue(msg)
                    if inserted:
                        messages_queued += 1

                monitor.advance_stage(new_stage)
                await self._uow.monitors.save(monitor)

            await self._uow.commit()

        return EvaluationReport(
            owner_id=owner_id,
            current_stage=monitor.status.value,
            messages_queued=messages_queued,
        )
