import argparse
import asyncio
import os
import sys
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.abspath("."))

from sqlalchemy import select

from app.application.use_cases.confirm_loan_payment import ConfirmLoanPayment
from app.infrastructure.persistence.database import create_engine, create_session_factory
from app.infrastructure.persistence.models import (
    Base,
    ContactModel,
    InactivityMonitorModel,
    InstallmentModel,
    LoanModel,
    OutboxModel,
    OwnerModel,
)
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from app.infrastructure.notifications.template_renderer import TemplateRenderer
from app.interfaces.worker.cli import run_worker

SIM_DB = "sqlite+aiosqlite:///./simulation_dryrun.db"
os.environ["DATABASE_URL"] = SIM_DB


async def init_db(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


async def run_scenario_a():
    print("=" * 80)
    print("SCENARIO (a): 95 DAYS OF INACTIVITY ON GROWW INVESTMENTS")
    print("Owner: Tanmoy (+919876543210, tanmoy@example.com)")
    print("Trusted Contact: Sunita Sharma (+919876543211, sunita@example.com, Verified)")
    print("Rules: Threshold = 90 days, Warning 1 = 60 days, Warning 2 = 80 days")
    print("=" * 80)

    engine = create_engine(SIM_DB)
    await init_db(engine)
    session_factory = create_session_factory(engine)
    renderer = TemplateRenderer()

    tz = ZoneInfo("Asia/Kolkata")
    start_dt = datetime(2026, 1, 1, 9, 0, 0, tzinfo=tz)

    async with session_factory() as session:
        owner = OwnerModel(
            id="owner-a",
            name="Tanmoy Sharma",
            phone="+919876543210",
            email="tanmoy@example.com",
            timezone="Asia/Kolkata",
        )
        contact = ContactModel(
            id="contact-a1",
            owner_id="owner-a",
            name="Sunita Sharma",
            relation="mother",
            phone="+919876543211",
            email="sunita@example.com",
            priority=1,
            locale="en",
            consent_verified_at=start_dt,
        )
        monitor = InactivityMonitorModel(
            id="mon-a",
            owner_id="owner-a",
            started_at=start_dt,
            last_activity_at=start_dt,
            threshold_days=90,
            warning_days=[60, 80],
            status="OK",
            episode_id="ep-2026-01",
        )
        session.add_all([owner, contact, monitor])
        await session.commit()

    recorded_dispatches = {}

    for day in range(1, 96):
        curr_dt = start_dt + timedelta(days=day)
        iso_str = curr_dt.isoformat()

        # Run evaluate CLI
        eval_args = argparse.Namespace(command="evaluate", as_of=curr_dt, dry_run=True)
        await run_worker(eval_args)

        # Inspect outbox rows newly sent or created
        async with session_factory() as session:
            stmt = select(OutboxModel).order_by(OutboxModel.created_at)
            rows = (await session.execute(stmt)).scalars().all()

            # Find messages created on this day
            todays_messages = []
            for r in rows:
                if r.id not in recorded_dispatches:
                    recorded_dispatches[r.id] = (day, curr_dt, r)
                    body = renderer.render(r.template_id, r.payload)
                    todays_messages.append({
                        "channel": r.channel,
                        "recipient": r.recipient,
                        "template": r.template_id,
                        "dedupe_key": r.dedupe_key,
                        "body": body.strip(),
                    })

            if todays_messages:
                print(f"\n[DAY {day:02d} - {curr_dt.strftime('%Y-%m-%d')} (Idle: {day} days)] -> {len(todays_messages)} MESSAGE(S) DISPATCHED:")
                for m in todays_messages:
                    print(f"  * Channel: {m['channel']:<5} | Recipient: {m['recipient']:<20} | Template: {m['template']}")
                    print(f"    Dedupe Key: {m['dedupe_key']}")
                    print(f"    Body: \"{m['body']}\"")

    await engine.dispose()


async def run_scenario_b():
    print("\n" + "=" * 80)
    print("SCENARIO (b): CAR LOAN EMI (Rs 16,166 DUE 24th, GRACE 1 DAY)")
    print("Unpaid until the 27th, then marked paid on the 28th.")
    print("Owner: Tanmoy (+919876543210, tanmoy@example.com)")
    print("Trusted Contact: Sunita Sharma (+919876543211, sunita@example.com, Verified)")
    print("=" * 80)

    engine = create_engine(SIM_DB)
    await init_db(engine)
    session_factory = create_session_factory(engine)
    renderer = TemplateRenderer()

    tz = ZoneInfo("Asia/Kolkata")
    start_dt = datetime(2026, 10, 1, 9, 0, 0, tzinfo=tz)

    async with session_factory() as session:
        owner = OwnerModel(
            id="owner-b",
            name="Tanmoy Sharma",
            phone="+919876543210",
            email="tanmoy@example.com",
            timezone="Asia/Kolkata",
        )
        contact = ContactModel(
            id="contact-b1",
            owner_id="owner-b",
            name="Sunita Sharma",
            relation="mother",
            phone="+919876543211",
            email="sunita@example.com",
            priority=1,
            locale="en",
            consent_verified_at=start_dt,
        )
        loan = LoanModel(
            id="loan-b",
            owner_id="owner-b",
            lender="HDFC Bank",
            account_masked="XXXX1234",
            emi_paise=1_616_600,
            due_day=24,
            grace_days=1,
            first_installment_month="2026-01",
            last_installment_month="2026-12",
            reminder_days_before=[3, 1, 0],
            parent_repeat_every_days=7,
        )
        inst = InstallmentModel(
            id="inst-oct-2026",
            loan_id="loan-b",
            year_month="2026-10",
            due_date=date(2026, 10, 24),
            amount_paise=1_616_600,
            status="UPCOMING",
            parent_notified=False,
            resolved_notified=False,
        )
        session.add_all([owner, contact, loan, inst])
        await session.commit()

    recorded_dispatches = {}

    # Simulate from Oct 20 to Oct 30
    for day in range(20, 31):
        curr_dt = datetime(2026, 10, day, 9, 0, 0, tzinfo=tz)

        # On Oct 28th, owner marks the installment paid
        if day == 28:
            uow = SqlAlchemyUnitOfWork(session_factory)
            # Use FixedClock for payment confirmation date
            class PaymentClock:
                def now(self):
                    return curr_dt
            confirm = ConfirmLoanPayment(uow=uow, clock=PaymentClock())
            await confirm.execute(
                loan_id="loan-b",
                year_month="2026-10",
            )
            print(f"\n>>> [2026-10-28 09:00 IST] Owner confirmed payment: Rs 16,166 marked PAID.")

        # Run evaluate CLI
        eval_args = argparse.Namespace(command="evaluate", as_of=curr_dt, dry_run=True)
        await run_worker(eval_args)

        # Inspect outbox rows newly sent or created
        async with session_factory() as session:
            stmt = select(OutboxModel).order_by(OutboxModel.created_at)
            rows = (await session.execute(stmt)).scalars().all()

            todays_messages = []
            for r in rows:
                if r.id not in recorded_dispatches:
                    recorded_dispatches[r.id] = (day, curr_dt, r)
                    body = renderer.render(r.template_id, r.payload)
                    todays_messages.append({
                        "channel": r.channel,
                        "recipient": r.recipient,
                        "template": r.template_id,
                        "dedupe_key": r.dedupe_key,
                        "body": body.strip(),
                    })

            date_label = f"2026-10-{day:02d}"
            if todays_messages:
                print(f"\n[DAY {day:02d} - {date_label}] -> {len(todays_messages)} MESSAGE(S) DISPATCHED:")
                for m in todays_messages:
                    print(f"  * Channel: {m['channel']:<5} | Recipient: {m['recipient']:<20} | Template: {m['template']}")
                    print(f"    Dedupe Key: {m['dedupe_key']}")
                    print(f"    Body: \"{m['body']}\"")
            else:
                print(f"[DAY {day:02d} - {date_label}] -> 0 messages (quiet day, conditions checked)")

    await engine.dispose()
    if os.path.exists("./simulation_dryrun.db"):
        os.remove("./simulation_dryrun.db")


async def main():
    await run_scenario_a()
    await run_scenario_b()


if __name__ == "__main__":
    asyncio.run(main())
