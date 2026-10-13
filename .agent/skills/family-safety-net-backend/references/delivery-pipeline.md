# Scheduling, outbox, and notification delivery

## Contents
1. Process layout
2. Evaluation jobs
3. Transactional outbox
4. Retries and fallback
5. Watching the watcher
6. Templates and SMS rules
7. Channel adapters
8. Dev and test modes

## 1. Process layout

Three processes from the same codebase: `api` (uvicorn), `worker` (scheduler plus outbox dispatcher), and `postgres`. The scheduler lives **only** in `worker`. If it ran inside each uvicorn worker it would fire several times. Even so, correctness must never depend on "only one scheduler", because deploys overlap. Idempotency (dedupe keys) is the real guarantee.

## 2. Evaluation jobs

| Job | Schedule (IST) | Use case |
|---|---|---|
| Inactivity evaluation | daily 09:00 | `EvaluateInactivity` for every owner |
| Loan evaluation | daily 09:00 | `EvaluateLoanObligations` for every owner |
| Outbox dispatch | every 1 minute | `DispatchOutbox` |
| Heartbeat | after each job | writes `scheduler_heartbeat` |

Jobs contain no logic. They load owner ids, call a use case per owner, catch and log per-owner errors so one bad record doesn't stop the rest, and write the heartbeat. All schedules run in `Asia/Kolkata`.

Use cases take `now` from `Clock`. Add a CLI such as `python -m app.interfaces.worker evaluate --as-of 2026-12-24T09:00 --dry-run` to replay any day.

## 3. Transactional outbox

1. The evaluation use case changes state (for example `Installment -> MISSED`) and inserts `OutboxMessage` rows **in the same transaction**. A unique `dedupe_key` rejects duplicates.
2. `DispatchOutbox` selects due rows: `status = PENDING AND next_attempt_at <= now`, using `SELECT ... FOR UPDATE SKIP LOCKED LIMIT n`.
3. For each row it renders the template, calls the matching `NotificationChannel`, then marks `SENT` or schedules a retry.
4. Never call a provider while holding the transaction that decided to send. Claim the row, commit the claim, send, then record the result.

Store the rendered payload (or the template id plus the variables) so a retry sends the same content, and keep the provider's message id for debugging.

## 4. Retries and fallback

- Backoff schedule: 1 min, 5 min, 30 min, 2 h, 12 h. Maximum 6 attempts, then `DEAD`.
- `TransientDeliveryError` (timeouts, 5xx, rate limits) retries. `PermanentDeliveryError` (invalid number, hard bounce) goes straight to `DEAD`.
- Parent alerts go over both SMS and email. If one channel is `DEAD` and the other is `SENT`, record success with a warning. If both are `DEAD`, alert the owner immediately through every channel that still works, and add a dashboard banner via the API.
- Delivery receipts: if the provider supports webhooks, add a `POST /webhooks/{provider}` route with signature verification that updates the message to `DELIVERED`. Treat this as an enhancement after basic sending works.

## 5. Watching the watcher

A silent scheduler failure defeats the product.
- Write `scheduler_heartbeat(last_run_at, last_success_at, last_error)` after each job.
- `GET /health/scheduler` returns unhealthy if `last_success_at` is older than 36 hours.
- Configure an external ping (Healthchecks.io, UptimeRobot, or similar) that the worker calls after every successful daily run and that alerts the owner if it stops arriving.
- Log every run's counts: owners evaluated, messages queued, messages sent, failures.

## 6. Templates and SMS rules

- Templates live in files, versioned: `templates/{name}.{locale}.{ext}.j2`, for example `inactivity_parent.en.txt.j2`, `inactivity_parent.en.html.j2`, `loan_missed_parent.en.txt.j2`.
- `NotificationComposer` (application layer) builds a `MessageDraft(template_id, variables)` from domain facts. Channels never decide wording.
- **SMS in India needs DLT registration**: a registered sender ID and pre-approved templates with variable slots. Keep templates short (aim for at most 2 segments), put long detail in email, and link to the secure packet page.
- Never put full account numbers, loan numbers, or document contents in SMS. Use masked values and links.
- Tone for parents: calm, factual, non-alarming. Lead with "we haven't been able to confirm [Name] is okay" for inactivity and "[Name]'s car loan installment due on 24 [Month] hasn't been confirmed" for the EMI. Say clearly what is being asked of them.
- Tone for the owner's warnings: direct, with a single obvious action ("I'm fine" or "I paid").
- Add `locale` on contacts from day one, even if only `en` ships first.

## 7. Channel adapters

Each adapter lives in `infrastructure/notifications/`, implements `NotificationChannel`, and:
- uses `httpx.AsyncClient` with explicit timeouts (connect 5s, read 10s)
- maps provider errors to `TransientDeliveryError` or `PermanentDeliveryError`
- never logs recipient numbers or bodies unmasked
- documents the provider API doc URL in its module docstring
- reads credentials from `config.py` only

Ship adapters in this order: `ConsoleChannel` (dev), one SMS provider, one email provider. A second SMS provider is a drop-in thanks to the shared contract tests (see `testing.md`).

## 8. Dev and test modes

- Default channel in dev and tests: `ConsoleChannel` or `RecordingChannel`.
- `--dry-run` renders messages and writes nothing to providers, and prints what would have been sent.
- A `NOTIFICATIONS_ALLOWLIST` setting in staging restricts real sends to the developer's own phone and email, so a test run can never message the real parents.
