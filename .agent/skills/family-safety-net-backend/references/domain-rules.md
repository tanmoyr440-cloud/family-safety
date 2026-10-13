# Domain rules

Pure Python. No framework, no I/O, no clock calls. Everything here receives `now` as an argument or through the `Clock` port.

## Contents
1. Entities and value objects
2. Inactivity policy
3. Loan policy
4. Escalation policy (who gets told what)
5. Idempotency and dedupe keys
6. Domain events and errors

## 1. Entities and value objects

**Value objects** (immutable, validated in the constructor):
- `Money(paise: int)`: no floats anywhere. Provide `from_rupees(Decimal)`, `__add__`, comparison, and `format_inr()` only in presentation code, not in the domain.
- `PhoneNumber`: E.164 (`+91XXXXXXXXXX`). Reject anything that doesn't normalize.
- `EmailAddress`: normalized lowercase, basic validation.
- `DueDay`: 1-31. `due_date_for(year, month)` clamps to the last day of the month.
- `Days(int)`: non-negative.

**Entities**
- `Owner`: id, name, timezone (default `Asia/Kolkata`), `monitoring_paused_until: datetime | None`.
- `TrustedContact`: id, owner_id, name, relation, `PhoneNumber`, `EmailAddress`, priority, locale, `consent_verified_at: datetime | None`. Only consent-verified contacts are ever alerted.
- `InvestmentAccount`: provider (`GROWW`), masked client id, nominee details, optional holdings snapshot with `as_of`, support notes.
- `ActivitySignal`: owner_id, source (`APP_CHECKIN | GROWW_API | EMAIL_PARSE`), occurred_at.
- `InactivityMonitor` (aggregate root): owner_id, `threshold_days=90`, `warning_days=(60, 80)`, status, `episode_id`, `last_activity_at`. Invariant: every warning day is less than `threshold_days`, and `warning_days` is strictly increasing.
- `Loan`: id, owner_id, lender, masked account number, `emi: Money`, `due_day: DueDay`, `grace_days`, payment instructions (UPI id, portal URL, branch contact), first and last installment months, `reminder_days_before=(3, 1, 0)`, `parent_repeat_every_days=7`.
- `Installment`: loan_id, `year_month`, due_date, amount, status (`UPCOMING | DUE | PAID | MISSED`), paid_at, evidence (kind, reference, note).
- `OutboxMessage`: id, `dedupe_key`, channel, recipient, template_id, payload, status (`PENDING | SENT | FAILED | DEAD`), attempts, next_attempt_at, last_error.
- `EmergencyPacket`: version, owner_id, sections, created_at (see `security-and-packet.md`).

## 2. Inactivity policy

Pure function: `evaluate(last_activity_at, now, config, paused_until) -> InactivityStage`.

| Days idle | Stage | Audience |
|---|---|---|
| < 60 | `OK` | nobody |
| 60-79 | `WARN_OWNER_1` | owner (SMS + email + push), each with a one-tap "I'm fine" link |
| 80-89 | `WARN_OWNER_2` | owner, more urgent wording |
| >= 90 | `NOTIFY_PARENTS` | verified trusted contacts, owner copied |

Rules:
- Compute `days_idle` using whole days in the owner's timezone, not UTC, so "day 90" matches what the owner sees.
- `last_activity_at` is the max of all signals. If there are no signals yet, use the monitor's `started_at` so a new account doesn't trigger instantly.
- Any new signal sets the status to `OK` and **closes the episode**. The next lapse opens a new `episode_id`. This lets parents be notified again in the future without duplicate sends inside one episode.
- A paused monitor evaluates as `OK` until `paused_until`. Cap a single pause (default 60 days) and record who and when. After the pause ends, the idle clock restarts from the pause end, not from the original last activity.
- Stages are monotonic within an episode. Emit each stage once.

## 3. Loan policy

Pure function: `evaluate(loan, installments, now) -> list[LoanAction]`.

- Each month has one installment with `due_date = due_day` of that month (clamped to month end).
- Owner reminders at `due_date - 3d`, `due_date - 1d`, and the due date morning, only if the installment is not `PAID`. Each reminder carries an "I paid" action.
- An installment becomes `MISSED` when `now > due_date + grace_days` and it isn't `PAID`. Default `grace_days = 1`. The user's stated rule is that **one** missed month notifies the parents, so a single `MISSED` triggers `NOTIFY_PARENTS`.
- Parent notification content: owner name, lender, masked account, amount due (this month plus any earlier unpaid months), due date, days overdue, how to pay. Never the full account number or credentials.
- Follow-ups: repeat every `parent_repeat_every_days` while unpaid. When the installment becomes `PAID` after a parent notification, send one `RESOLVED` message so parents know it is closed.
- If several months are unpaid, aggregate them into one message (sum amount, list months) instead of one message per month.
- Marking an already paid installment as paid again is a no-op, not an error (idempotent). Marking a future installment as paid is allowed (prepayment) but flagged in the audit.
- Loan ends after the last installment month. Do not generate installments beyond it.

## 4. Escalation policy

`EscalationPolicy.recipients(stage, contacts, owner) -> list[Recipient]`:
- Owner stages go to the owner only.
- Parent stages go to verified contacts, ordered by priority, on both SMS and email. The owner gets a copy so they know what was sent.
- If a contact has no verified consent, skip and record an `ESCALATION_SKIPPED` audit event (don't fail silently).
- If there are no verified contacts at all, alert the owner loudly. That is a configuration failure, not a no-op.

## 5. Idempotency and dedupe keys

Every outbound message has a deterministic `dedupe_key` with a **unique constraint**:

```
inactivity:{owner_id}:{episode_id}:{stage}:{contact_id}:{channel}
loan:{loan_id}:{yyyy-mm}:{stage}:{contact_id}:{channel}
loan:{loan_id}:repeat:{yyyy-mm-dd}:{contact_id}:{channel}      # weekly follow-up keyed by date
loan:{loan_id}:{yyyy-mm}:resolved:{contact_id}:{channel}
```

Inserting a duplicate is handled as "already queued", not as an error. This is what makes double scheduler runs, crashes, and redeploys safe.

## 6. Domain events and errors

Events (plain dataclasses): `InactivityStageChanged`, `InstallmentMissed`, `InstallmentPaid`, `ContactVerified`, `MonitoringPaused`. Use cases publish them into the outbox/audit, not onto an in-process bus that can lose them.

Errors (all subclass `DomainError` with a stable `code`): `InvalidPhoneNumber`, `InvalidThresholds`, `PauseTooLong`, `ContactNotVerified`, `InstallmentNotFound`, `LoanEnded`. The API layer maps codes to HTTP statuses. The domain never mentions HTTP.
