"""Use case: EvaluateLoanObligations."""

from zoneinfo import ZoneInfo

from app.application.dto import LoanEvaluationReport
from app.application.ports.clock import Clock
from app.application.ports.unit_of_work import UnitOfWork
from app.application.services.notification_composer import NotificationComposer
from app.domain.policies.escalation_policy import ChannelKind
from app.domain.policies.loan_due_policy import LoanActionKind, LoanDuePolicy


class EvaluateLoanObligations:
    """Evaluates loan installment due dates, grace periods, and enqueues escalations."""

    def __init__(
        self,
        uow: UnitOfWork,
        clock: Clock,
        composer: NotificationComposer | None = None,
    ) -> None:
        self._uow = uow
        self._clock = clock
        self._composer = composer or NotificationComposer()

    async def execute(self, loan_id: str) -> LoanEvaluationReport:
        """Evaluate loan installments and queue reminders or parent escalation messages."""
        now = self._clock.now()
        messages_queued = 0

        async with self._uow:
            loan = await self._uow.loans.get_by_id(loan_id)
            if loan is None:
                return LoanEvaluationReport(loan_id=loan_id, actions_count=0, messages_queued=0)

            owner = await self._uow.owners.get_by_id(loan.owner_id)
            if owner is None:
                return LoanEvaluationReport(loan_id=loan_id, actions_count=0, messages_queued=0)

            installments = await self._uow.installments.get_installments(loan_id)
            contacts = await self._uow.contacts.get_contacts_for_owner(loan.owner_id)
            verified_contacts = [c for c in contacts if c.is_verified]
            verified_contacts.sort(key=lambda c: c.priority)

            tz = ZoneInfo(owner.timezone)
            today = now.astimezone(tz).date()

            actions = LoanDuePolicy.evaluate(loan=loan, installments=installments, today=today)

            loan_acc_unmasked = getattr(loan, "account_number", None) or loan.account_masked

            for action in actions:
                if action.kind in (LoanActionKind.REMIND_OWNER, LoanActionKind.WARN_OWNER_GRACE):
                    ym = action.year_month or today.strftime("%Y-%m")
                    # Owner SMS & Email
                    for ch, addr in [
                        (ChannelKind.SMS, str(owner.phone)),
                        (ChannelKind.EMAIL, str(owner.email)),
                    ]:
                        msg = self._composer.compose_loan_message(
                            loan_id=loan.id,
                            year_month=ym,
                            action_kind=action.kind.value,
                            recipient_address=addr,
                            channel=ch,
                            now=now,
                            contact_id="owner",
                            payload_extra={
                                "days_until_due": action.days_until_due,
                                "lender": loan.lender,
                                "account_masked": loan.account_masked,
                                "amount_inr": f"{loan.emi.paise / 100:,.2f}",
                                "due_date": f"{loan.due_day.value}th",
                            },
                        )
                        if await self._uow.outbox.enqueue(msg):
                            messages_queued += 1

                elif action.kind == LoanActionKind.NOTIFY_PARENTS_MISSED:
                    overdue_inr = (
                        f"{action.total_overdue_amount.paise / 100:,.2f}"
                        if action.total_overdue_amount
                        else f"{loan.emi.paise / 100:,.2f}"
                    )
                    # Target all verified contacts (UNMASKED account details for emergency contacts)
                    for contact in verified_contacts:
                        for ch, addr in [
                            (ChannelKind.SMS, str(contact.phone)),
                            (ChannelKind.EMAIL, str(contact.email)),
                        ]:
                            msg = self._composer.compose_loan_message(
                                loan_id=loan.id,
                                year_month="-".join(action.unpaid_months),
                                action_kind=action.kind.value,
                                recipient_address=addr,
                                channel=ch,
                                now=now,
                                contact_id=contact.id,
                                payload_extra={
                                    "total_overdue_paise": (
                                        action.total_overdue_amount.paise
                                        if action.total_overdue_amount
                                        else 0
                                    ),
                                    "unpaid_months": action.unpaid_months,
                                    "lender": loan.lender,
                                    "account_number": loan_acc_unmasked,
                                    "account_masked": loan.account_masked,
                                    "amount_inr": overdue_inr,
                                    "due_date": f"{loan.due_day.value}th",
                                    "owner_name": owner.name,
                                    "recipient_name": contact.name,
                                    "packet_url": "http://localhost:5173/public/packet",
                                },
                            )
                            if await self._uow.outbox.enqueue(msg):
                                messages_queued += 1

                    # Owner copy
                    for ch, addr in [
                        (ChannelKind.SMS, str(owner.phone)),
                        (ChannelKind.EMAIL, str(owner.email)),
                    ]:
                        msg = self._composer.compose_loan_message(
                            loan_id=loan.id,
                            year_month="-".join(action.unpaid_months),
                            action_kind=action.kind.value,
                            recipient_address=addr,
                            channel=ch,
                            now=now,
                            contact_id="owner_copy",
                            payload_extra={
                                "is_copy": True,
                                "unpaid_months": action.unpaid_months,
                                "lender": loan.lender,
                                "account_number": loan_acc_unmasked,
                                "account_masked": loan.account_masked,
                                "amount_inr": overdue_inr,
                                "due_date": f"{loan.due_day.value}th",
                                "owner_name": owner.name,
                                "recipient_name": owner.name,
                                "packet_url": "http://localhost:5173/public/packet",
                            },
                        )
                        if await self._uow.outbox.enqueue(msg):
                            messages_queued += 1

                    # Mark evaluated installments as parent_notified
                    for inst in installments:
                        if inst.year_month in action.unpaid_months:
                            inst.parent_notified = True
                            await self._uow.installments.save(inst)

                elif action.kind == LoanActionKind.NOTIFY_PARENTS_RESOLVED and action.year_month:
                    for contact in verified_contacts:
                        for ch, addr in [
                            (ChannelKind.SMS, str(contact.phone)),
                            (ChannelKind.EMAIL, str(contact.email)),
                        ]:
                            msg = self._composer.compose_loan_message(
                                loan_id=loan.id,
                                year_month=action.year_month,
                                action_kind=action.kind.value,
                                recipient_address=addr,
                                channel=ch,
                                now=now,
                                contact_id=contact.id,
                                payload_extra={
                                    "lender": loan.lender,
                                    "account_number": loan_acc_unmasked,
                                    "account_masked": loan.account_masked,
                                    "owner_name": owner.name,
                                    "recipient_name": contact.name,
                                },
                            )
                            if await self._uow.outbox.enqueue(msg):
                                messages_queued += 1

                    # Mark resolved_notified on the installment
                    for inst in installments:
                        if inst.year_month == action.year_month:
                            inst.resolved_notified = True
                            await self._uow.installments.save(inst)

            await self._uow.commit()

        return LoanEvaluationReport(
            loan_id=loan_id,
            actions_count=len(actions),
            messages_queued=messages_queued,
        )
