---
name: family-safety-net-backend
description: Build the Python FastAPI backend for "Family Safety Net", an app that alerts a user's parents by SMS and email when (1) the owner shows no activity on their Groww stocks and mutual funds for 90 days, or (2) a monthly car-loan EMI of Rs 16,166 due on the 24th is missed. Use this skill whenever the user is working on the API, domain logic, database, scheduler/worker, notification delivery (SMS, email), emergency packet, Groww integration, auth, security, or backend tests for this project, or says things like "continue the backend", "build the next phase", "add a monitor", "fix the scheduler", even without naming the skill. Enforces clean architecture, SOLID, ports and adapters, idempotent escalations, and test-first domain rules. Pair with the family-safety-net-frontend skill for the React side.
---

# Family Safety Net: backend guide (FastAPI, Python)

This skill is the single source of truth for the backend. Read this file fully before writing code. Then read the reference files listed in "Where to read next" at the moment you need them, not all up front.

## 1. What the backend does

An owner registers assets and obligations. The backend watches two conditions and escalates to trusted family contacts.

1. **Investment inactivity.** The owner holds stocks and mutual funds on Groww. No activity signal for 90 days means parents get an SMS and an email with the information and documents they need.
2. **Car loan EMI.** Rs 16,166 is due on the 24th of each month. A missed installment means parents get an SMS and an email with the details to pay on time.

Both features share one pipeline: **detect -> decide stage -> enqueue (outbox) -> deliver with retries -> audit**. Build that pipeline once and plug both monitors into it. This is where SOLID pays off, because a third monitor later (insurance premium, credit card bill) should be a new policy plus a use case, not an edit to the dispatcher.

## 2. Reality checks (raise these with the user early)

- **Groww exposes no "last login" signal.** Treat activity as a pluggable `ActivitySignalSource` port. Primary source: an in-app check-in or magic link. Optional source: Groww's official Trade API (`growwapi` Python SDK) for holdings and order/trade lists, treating a change as activity. It needs an active Trading API subscription, and the key-and-secret flow requires daily approval on the Groww Cloud API Keys page, so it can't be assumed to run unattended. Read `https://groww.in/trade-api/docs/python-sdk` before writing that adapter and never invent SDK methods.
- **Parents can't withdraw funds because the owner is inactive.** Nominee claims generally start after the account holder's death and need formal documents. Frame the alert as "we haven't heard from X, please check on them" plus an information packet. Never promise access to funds. Recommend the owner confirm that parents are nominees on every holding.
- **EMI payments aren't observable.** Define a `PaymentEvidenceSource` port. Default implementation is a manual "I paid" confirmation. Later options: Gmail debit-alert parsing or an RBI Account Aggregator integration. Because the default is manual, remind the owner before the due date so a forgotten click doesn't alarm the parents.
- **False alarms are costly.** Hence owner warning stages before parents are contacted, a pause feature, and an EMI grace period.
- **India SMS rules.** Transactional SMS needs DLT registration (sender ID plus pre-approved templates). Providers such as MSG91 or Twilio work. Design templates around DLT variable slots.

## 3. Stack (defaults)

Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 async, Alembic, PostgreSQL, APScheduler (or Celery beat) in a **separate worker process**, `httpx`, `argon2-cffi`, `cryptography`, `structlog`. Tooling: `uv` or Poetry, `ruff`, `mypy --strict`, `import-linter`, `pytest`, `pytest-asyncio`, `respx`, `testcontainers`. Packaging: Docker Compose (api, worker, postgres), `.env` via `pydantic-settings`, GitHub Actions for lint, types, tests.

## 4. Architecture: clean architecture, ports and adapters

Dependencies point **inward only**: `interfaces -> application -> domain`. `infrastructure` implements application ports. The domain imports nothing from FastAPI, SQLAlchemy, settings, SDKs, or `datetime.now()`. That is what lets you test the 90-day and 24th-of-month rules in milliseconds and swap Twilio for MSG91 without touching a rule.

```
backend/
  app/
    domain/                 # pure Python, zero I/O
      entities/             # Owner, TrustedContact, Loan, Installment, InactivityMonitor, EmergencyPacket
      value_objects/        # Money (integer paise), PhoneNumber (E.164), EmailAddress, DueDay
      policies/             # InactivityPolicy, LoanDuePolicy, EscalationPolicy
      events.py
      errors.py
    application/
      ports/                # Protocols: Clock, ActivitySignalSource, PaymentEvidenceSource,
                            #   NotificationChannel, DocumentStore, *Repository, UnitOfWork
      use_cases/            # one class per use case, single public method `execute`
      services/             # NotificationComposer, PacketAssembler (orchestration, no I/O)
      dto.py
    infrastructure/
      persistence/          # SQLAlchemy models, repositories, unit of work
      notifications/        # sms_msg91.py, sms_twilio.py, email_ses.py, console_channel.py
      groww/                # optional GrowwActivitySource adapter
      storage/              # encrypted DocumentStore
      security/             # hashing, token signing, field encryption
      scheduling/           # APScheduler jobs that only call use cases
      system_clock.py
    interfaces/
      api/                  # routers, request/response schemas, dependencies, error handlers
      worker/               # worker entrypoint
    container.py            # composition root: the ONLY place wiring concrete classes
    config.py
  tests/{unit,integration,contract,e2e}/
  alembic/
```

Rules that keep this honest:

- A router parses the request, calls exactly one use case, and maps the result to a response. No business logic and no queries in routers.
- Use cases take ports through the constructor. They never build adapters or read env vars.
- Repositories return domain entities, never ORM rows. Map at the boundary.
- Time comes from the `Clock` port. A bare `datetime.now()` outside `system_clock.py` is a bug.
- Money is integer paise (`Money(1_616_600)` for Rs 16,166). EMI amount, due day, grace days, and thresholds are **configuration on entities**, never constants in code.
- Add an `import-linter` contract in `pyproject.toml` that fails CI if `domain` imports `application`, `infrastructure`, or `interfaces`, or if `application` imports `infrastructure`.

## 5. SOLID, applied here

- **S:** `InactivityPolicy` decides a stage. `EscalationPolicy` decides who is told. `NotificationComposer` builds content. `DispatchOutbox` transports. Four classes, four reasons to change.
- **O:** New monitors implement a `Monitor` protocol: `evaluate(now) -> list[EscalationIntent]`. The dispatcher doesn't change.
- **L:** Every `NotificationChannel` honors one contract: `send(message) -> DeliveryResult`, raising only `TransientDeliveryError` or `PermanentDeliveryError`. Run one shared contract test suite against all adapters.
- **I:** Small ports (`Clock`, `NotificationChannel`, `OutboxRepository`...), never one fat `ExternalServices`.
- **D:** Use cases depend on ports. Fakes (`FakeClock`, `InMemoryOutbox`, `RecordingChannel`) live in `tests/` and back all unit tests.

Shape to follow everywhere:

```python
# application/ports/notification_channel.py
class NotificationChannel(Protocol):
    kind: ChannelKind  # SMS | EMAIL
    async def send(self, message: OutboundMessage) -> DeliveryResult: ...

# application/use_cases/evaluate_loan_obligations.py
class EvaluateLoanObligations:
    def __init__(self, uow: UnitOfWork, clock: Clock, policy: LoanDuePolicy,
                 composer: NotificationComposer) -> None: ...

    async def execute(self, owner_id: OwnerId) -> EvaluationReport:
        now = self._clock.now()
        async with self._uow as uow:
            ...  # load loan, apply policy, enqueue outbox rows, commit once
```

## 6. Build phases (one at a time, stop at each checkpoint)

At every checkpoint run `ruff`, `mypy --strict`, `import-linter`, and the tests. Then summarize what exists, how to run it, and what is deliberately not done.

0. **Scaffold.** `uv`/Poetry project, ruff, mypy strict, pre-commit, Docker Compose with Postgres, CI skeleton, `.env.example`, `/health`. Checkpoint: `docker compose up` gives a green health check.
1. **Domain.** Value objects, entities, `InactivityPolicy`, `LoanDuePolicy`, `EscalationPolicy`, errors, with exhaustive boundary tests (see `references/testing.md`). Zero framework imports. Checkpoint: tests green and the import-linter contract passes. Read `references/domain-rules.md` first.
2. **Application.** Ports, use cases (`RecordActivity`, `EvaluateInactivity`, `EvaluateLoanObligations`, `ConfirmLoanPayment`, `ManageContacts`, `PauseMonitoring`, `DispatchOutbox`, `AssemblePacket`), in-memory fakes, and the time-travel simulation test.
3. **Persistence.** SQLAlchemy models, Alembic migrations, repositories, unit of work, outbox table with a unique `dedupe_key`. Integration tests on a real Postgres container.
4. **API.** Routers, schemas, auth, error handlers, OpenAPI tags. Follow `references/api-contract.md` exactly, since the frontend is built against it. Checkpoint: OpenAPI JSON exported to `openapi.json` for the frontend's type generation.
5. **Worker and notifications.** Scheduler jobs, heartbeat, console channel first, then one real SMS and one real email adapter behind the same port, each with contract tests and a `--dry-run` flag. Read `references/delivery-pipeline.md`.
6. **Packet and documents.** Encrypted store, signed links, OTP gate, view audit, parent-facing endpoints. Read `references/security-and-packet.md`.
7. **Optional Groww adapter.** Behind a feature flag. Read the live Groww docs first. Handle auth expiry and failures by falling back to check-ins.
8. **Hardening.** Rate limits, security headers, log redaction, backup/restore note, error tracking, scheduler watchdog, README runbook ("what to do if the worker is down").

## 7. Working agreements

- Before each phase, state in 3-5 lines what you will build and which files you will touch. Ask a question only when blocked on something only the user can decide (SMS provider, hosting, grace period). Otherwise pick the default here, say so, and proceed.
- Write the failing domain test first, then the code. Domain and application layers target 90%+ coverage.
- Small, typed functions. No `Any` without a comment. Files under about 300 lines. No classes named `Manager` or `Helper`. Prefer composition over inheritance.
- Never hardcode 16166, 24, or 90 outside config, seeds, and tests that set them explicitly.
- Never call real SMS, email, or Groww services from tests. Never log phone numbers, emails, account numbers, or tokens unmasked.
- Don't invent third-party API shapes. For Groww, MSG91, Twilio, or SES, consult the current docs and put the doc URL in the adapter's module docstring.
- When the user changes a rule ("notify after 2 missed months"), change the policy and its tests first, then config, then API/UI.
- Conventional commits (`feat(domain): add inactivity policy`), one logical step each.
- If an API change is needed, update `references/api-contract.md` in the same change and tell the user the frontend skill's client must be regenerated.

## 8. Definition of done (any feature)

- [ ] Domain rule has unit tests including boundaries and a failure case
- [ ] New behavior goes through a port, with a fake and (if external) a contract test
- [ ] Escalation is idempotent via `dedupe_key`, proven by a test that runs the job twice
- [ ] Failure path handled: retry, `DEAD` state, owner alerted
- [ ] No sensitive data in logs, SMS bodies, or error messages
- [ ] OpenAPI updated and exported, `api-contract.md` in sync
- [ ] Config documented in `.env.example` and README
- [ ] `ruff`, `mypy --strict`, `import-linter`, and tests all pass

## 9. Anti-patterns to refuse

- `datetime.now()` or `requests.post(...)` inside domain or use-case code
- Sending an SMS inside the DB transaction that decides to send it
- Running the scheduler inside every API worker
- Floats for money
- A single `NotificationService` that knows SMS, email, templates, retries, and DB access
- ORM objects returned from repositories or API handlers
- Parent-facing wording that treats a missing check-in as proof of danger, or promises access to funds
- Storing broker credentials, or emailing identity documents as raw attachments
- Skipping owner-warning stages "to keep it simple"

## 10. Where to read next

| When you are about to... | Read |
|---|---|
| Write entities, policies, thresholds, dedupe keys | `references/domain-rules.md` |
| Build the scheduler, outbox, retries, templates, SMS/email adapters | `references/delivery-pipeline.md` |
| Build auth, encryption, consent, packet links, documents | `references/security-and-packet.md` |
| Write or review any test | `references/testing.md` |
| Add or change an endpoint, error shape, or pagination | `references/api-contract.md` |
