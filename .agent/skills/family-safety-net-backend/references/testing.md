# Backend testing strategy

Write the failing domain test first, then the code. Most tests should be fast unit tests against fakes. Slow tests (Postgres, HTTP) exist to prove the adapters, not the rules.

## Contents
1. Test pyramid and layout
2. Fakes and fixtures
3. Domain boundary tables
4. Idempotency tests
5. Time-travel simulation
6. Contract tests for adapters
7. Integration and API tests
8. CI gates

## 1. Test pyramid and layout

```
tests/
  unit/         # domain + application with fakes (hundreds, milliseconds each)
  contract/     # shared suites run against every adapter implementation
  integration/  # real Postgres via testcontainers; migrations; outbox concurrency
  api/          # FastAPI app with container overridden to fakes
  e2e/          # a few full-stack flows via docker compose (owner check-in, EMI missed, parent OTP)
  fakes/        # FakeClock, InMemoryOutbox, RecordingChannel, InMemory*Repository
```

## 2. Fakes and fixtures

- `FakeClock(now)` with `.advance(days=..., hours=...)`. Never use `freezegun` inside domain tests when a fake clock will do.
- `RecordingChannel(kind)` stores every `OutboundMessage` and can be told to raise `TransientDeliveryError` or `PermanentDeliveryError` on demand.
- `InMemoryOutbox` enforces the same unique `dedupe_key` rule as the real table, so idempotency tests mean something.
- Builders: `an_owner()`, `a_verified_contact()`, `a_loan(emi=Money(1_616_600), due_day=24)`. Tests override only what they care about.

## 3. Domain boundary tables

Use `pytest.mark.parametrize` and keep the tables readable.

**Inactivity** (threshold 90, warnings 60 and 80):

| days idle | expected stage |
|---|---|
| 0, 1, 59 | OK |
| 60, 79 | WARN_OWNER_1 |
| 80, 89 | WARN_OWNER_2 |
| 90, 91, 365 | NOTIFY_PARENTS |

Also test: activity at day 89 resets to OK and closes the episode; the next lapse gets a new `episode_id`; a paused monitor is OK until the pause ends and then restarts the clock; no signals ever uses `started_at`; day counting follows the owner's timezone around midnight IST.

**Loan** (EMI 1_616_600 paise, due day 24, grace 1):
- paid on the 23rd, paid on the 24th: no actions beyond cleanup
- unpaid on the 21st, 23rd, 24th: owner reminders only
- unpaid on the 25th: still inside grace, owner nagging only
- unpaid on the 26th: `MISSED`, parents notified
- grace 0 variant: unpaid on the 25th is `MISSED`
- two consecutive unpaid months: one aggregated parent message with the summed amount
- paid late after parents were notified: one `RESOLVED` message, no further follow-ups
- `due_day=31` in February clamps to 28/29
- loan ended: no installments generated
- marking paid twice is a no-op

## 4. Idempotency tests

For every use case that enqueues messages:
1. Run it once, assert the exact set of outbox rows.
2. Run it again with the same clock, assert **no** new rows.
3. Simulate a crash between claim and send (raise from the channel after the claim) and assert the message is retried once, not duplicated.
4. Run two `DispatchOutbox` instances concurrently on the integration database and assert each message is sent exactly once (`SKIP LOCKED`).

## 5. Time-travel simulation

One high-value test per monitor. Build an owner with no activity, a `FakeClock`, and a `RecordingChannel`. Step the clock one day at a time for 100 days, running the evaluation and dispatch each day. Assert exactly **which messages were sent on which day**, for example: owner warnings on day 60 and day 80, parents on day 90, nothing duplicated on days 91-100. Repeat for a loan with a missed month. These tests double as living documentation of the product's behavior.

## 6. Contract tests for adapters

One shared test class parameterized over adapters:
- `NotificationChannel`: success returns a `DeliveryResult` with a provider id; a 5xx maps to `TransientDeliveryError`; an invalid number maps to `PermanentDeliveryError`; timeouts map to transient; no recipient data appears in logs. Use `respx` to mock the provider's HTTP API, and keep one optional live test marked `@pytest.mark.live` that is skipped in CI and uses a developer allowlist number.
- Repositories: the same behavior suite runs against the in-memory and the SQLAlchemy implementation, so the fakes can be trusted.
- `ActivitySignalSource` and `PaymentEvidenceSource`: same idea, with the Groww adapter tested against recorded responses.

## 7. Integration and API tests

- Real Postgres via `testcontainers`. Run Alembic upgrade to head, then downgrade, in a test.
- Test the unique `dedupe_key` constraint, `SKIP LOCKED` behavior, and the audit table's restricted privileges.
- API tests use `httpx.AsyncClient` against the app with fakes injected through the container. Assert status codes, the problem-details error shape, auth requirements per route, and rate limit headers. Validate responses against the exported `openapi.json`.
- Security tests: unauthenticated access is rejected, a user can't read another user's data, expired and tampered tokens fail, OTP lockout works, packet responses carry `no-store`.

## 8. CI gates

- `ruff check`, `ruff format --check`, `mypy --strict`, `import-linter`
- unit + contract + api tests on every push, integration on every PR
- coverage: domain and application at 90%+ (fail below), overall report only
- `pip-audit` on a schedule
- the exported `openapi.json` must match the committed one (fail if the API changed without regenerating)
