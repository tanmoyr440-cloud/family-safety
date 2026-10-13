# API contract (v1)

The backend owns this contract. The frontend generates its TypeScript client from the exported `openapi.json`, so keep this file and the FastAPI routers in sync. Change this file in the same commit as any endpoint change.

## Contents
1. Conventions
2. Error shape
3. Endpoints
4. Key response shapes
5. Versioning and change policy

## 1. Conventions

- Base path `/api/v1`. JSON only, except multipart document uploads.
- Auth: `HttpOnly` cookie session. State-changing requests send an `X-CSRF-Token` header.
- Timestamps are ISO 8601 with offset (`2026-12-24T09:00:00+05:30`). Dates are `YYYY-MM-DD`. The API returns instants in UTC offset form and the frontend renders them in the owner's timezone.
- Money is **integer paise** in fields named `*_paise`, never a float. Example: `"emi_paise": 1616600`.
- Phone numbers are E.164. Account identifiers are masked in responses.
- Lists are paginated with `?limit=&cursor=` and return `{ "items": [...], "next_cursor": string | null }`.
- `POST` endpoints that create resources accept an `Idempotency-Key` header.
- Every route has an OpenAPI tag (`auth`, `monitor`, `contacts`, `loans`, `accounts`, `documents`, `packet`, `notifications`, `health`) and a stable `operationId` (for example `getMonitor`) so generated client function names don't change.

## 2. Error shape (problem details)

```json
{
  "type": "https://familysafetynet.app/errors/contact-not-verified",
  "title": "Contact not verified",
  "status": 409,
  "code": "CONTACT_NOT_VERIFIED",
  "detail": "This contact has not confirmed consent yet.",
  "errors": [{ "field": "phone", "message": "Invalid number" }]
}
```

`code` is the stable machine-readable value the frontend switches on. `errors` is present for validation failures (422). Never leak stack traces or internal ids.

## 3. Endpoints

**Auth**
```
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/mfa/enroll        POST /auth/mfa/verify
GET  /me                     GET /me/export        DELETE /me
```

**Activity and monitor**
```
POST /activity/check-in                         # authenticated one-tap
POST /activity/check-in/link/{token}            # magic link, no login, records activity only
GET  /monitor                                   # MonitorStatus
PUT  /monitor/config                            # thresholds; validated warn < threshold
POST /monitor/pause      body: { until }        DELETE /monitor/pause
```

**Contacts**
```
GET  /contacts                POST /contacts
PATCH /contacts/{id}          DELETE /contacts/{id}
POST /contacts/{id}/verify/send                 # (re)send consent OTP
POST /public/contacts/verify                    # parent-facing: { token, otp }
POST /public/contacts/opt-out                   # parent-facing
```

**Accounts, loans, and mutual funds**
```
GET  /accounts/groww          PUT /accounts/groww
POST /accounts/groww/refresh-holdings           # optional adapter, feature flagged
GET  /bank-accounts                             # list registered savings & bank accounts
POST /bank-accounts                             # register bank account { bank_name, account_number, ifsc_code, branch_name?, account_type?, holder_name? }
DELETE /bank-accounts/{id}                      # remove registered bank account
GET  /loans                   POST /loans             PATCH /loans/{id}
GET  /loans/{id}/installments
POST /loans/{id}/installments/{yyyy_mm}/mark-paid    # body: { reference?, note? }
GET  /mutual-funds/search?q=                     # search SEBI/AMFI registered schemes
GET  /mutual-funds/{scheme_code}/nav             # live NAV and scheme metadata
GET  /mutual-funds/holdings                      # list owner holdings with live valuation
POST /mutual-funds/holdings                      # add holding { scheme_code, units, folio_number? }
DELETE /mutual-funds/holdings/{id}               # remove holding
```

**Documents and packet**
```
GET  /documents               POST /documents (multipart)    DELETE /documents/{id}
GET  /packet/preview?contact_id=
GET  /packet/shares           POST /packet/shares            DELETE /packet/shares/{id}     # revoke
GET  /public/packet/{token}                                  # minimal info (OTP required next)
POST /public/packet/{token}/otp/send    POST /public/packet/{token}/otp/verify
GET  /public/packet/session                                  # packet content after OTP
GET  /public/packet/session/documents/{id}                   # streamed download
```

**Notifications and health**
```
GET  /notifications           # delivery log; filters: status, channel, since
GET  /health                  GET /health/scheduler
```

## 4. Key response shapes

`MonitorStatus`
```json
{
  "status": "OK | WARN_OWNER_1 | WARN_OWNER_2 | NOTIFY_PARENTS | PAUSED",
  "last_activity_at": "2026-10-01T08:12:00+05:30",
  "days_idle": 10,
  "threshold_days": 90,
  "warning_days": [60, 80],
  "next_stage": { "stage": "WARN_OWNER_1", "at": "2026-11-30" },
  "paused_until": null,
  "scheduler_healthy": true
}
```

`Loan`
```json
{
  "id": "uuid", "lender": "string", "account_masked": "XXXX1234",
  "emi_paise": 1616600, "due_day": 24, "grace_days": 1,
  "payment_instructions": { "upi_id": "string|null", "portal_url": "string|null", "notes": "string|null" },
  "next_due": { "year_month": "2026-10", "due_date": "2026-10-24", "status": "UPCOMING" }
}
```

`Installment`: `year_month`, `due_date`, `amount_paise`, `status` (`UPCOMING | DUE | PAID | MISSED`), `paid_at`, `evidence`.

`Contact`: `id`, `name`, `relation`, `phone`, `email`, `priority`, `consent` (`PENDING | VERIFIED | OPTED_OUT`), `last_delivery` (status of the last message to them).

`NotificationLogItem`: `id`, `channel`, `recipient_label` (for example "Mom, SMS"), `template`, `status` (`PENDING | SENT | DELIVERED | FAILED | DEAD`), `attempts`, `queued_at`, `sent_at`, `error_code`.

## 5. Versioning and change policy

- Additive changes (new optional fields, new endpoints) are allowed within v1.
- Renames, removals, and meaning changes need a new version prefix or a deprecation period.
- After any change: export `openapi.json`, commit it, and tell the user that the frontend must run its type generation step.
