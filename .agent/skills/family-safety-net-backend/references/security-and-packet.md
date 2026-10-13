# Security, privacy, and the emergency packet

This app stores identity-adjacent financial data and contacts family on the owner's behalf. Treat security as a feature, not hardening at the end.

## Contents
1. Credentials and secrets
2. Owner authentication
3. Data protection
4. Contact consent
5. The emergency packet
6. Parent access flow
7. Audit log
8. Web security checklist

## 1. Credentials and secrets

- **Never store Groww passwords, PINs, TOTP secrets, or session cookies.** Not even encrypted.
- If the optional Groww adapter is used, store only the API credentials it needs, encrypted, read-only where possible, removable with one call. Handle expiry (daily approval) gracefully and fall back to check-ins.
- Secrets come from env or a secret manager. Commit `.env.example`, ignore `.env`. Different keys per environment.
- Never include secrets in error messages, logs, OpenAPI examples, or test fixtures.

## 2. Owner authentication

- Email + password hashed with argon2id. Enforce a minimum length and check against common-password lists.
- TOTP MFA for the owner (strongly encouraged, required before editing contacts or the packet).
- Short-lived access token (about 15 min) plus rotating refresh token in `HttpOnly; Secure; SameSite=Lax` cookies. Refresh tokens are single-use, stored hashed, and revocable.
- Rate limit: login, check-in link, OTP request, OTP verify, and contact verification endpoints. Lock out repeated OTP failures.
- Magic check-in links are signed, single-purpose (they can only record activity), expire quickly (for example 7 days for reminders), and carry no read access.
- CSRF protection for cookie-authenticated mutations (double-submit token or `SameSite` plus an `Origin` check).

## 3. Data protection

- Field-level encryption (`cryptography` Fernet or AES-GCM) for account numbers, nominee details, and any stored API credentials. Keep the key outside the database.
- Documents: envelope encryption. Each file gets its own data key, wrapped with a master key from env or KMS. Store only ciphertext in the `DocumentStore`. Record SHA-256 of plaintext for integrity.
- Mask on read by default (`XXXX1234`). Provide an explicit, audited "reveal" action only where truly needed.
- Log redaction: a structlog processor that masks phone numbers, emails, token-like strings, and fields named like `account`, `token`, `secret`, `password`.
- Backups are encrypted. Document restore steps in the README.
- Data subject controls: `GET /me/export` (all data as JSON) and `DELETE /me` (hard delete with a confirmation step and a short cooling-off period).

## 4. Contact consent

Alerting someone requires that they agreed to be a contact.
1. Owner adds a contact. Status is `PENDING`.
2. System sends the contact a message explaining who added them and why, with an OTP.
3. The contact enters the OTP (via a public verification page). Set `consent_verified_at`.
4. Only verified contacts receive escalations.
5. Every alert to a contact includes an opt-out link. Opting out notifies the owner.

This respects consent and purpose-limitation expectations under India's Digital Personal Data Protection Act, 2023. If the user plans to launch beyond personal use, suggest they get legal advice.

## 5. The emergency packet

Assembled by `PacketAssembler` from stored data. It is versioned: the notification references the version current at trigger time.

Contents:
- Plain-language explanation of why the parent is receiving it, and what is being asked ("please check on [Name]").
- Groww account identifiers (masked unless a full value is truly needed), nominee details, holdings snapshot with an "as of" date.
- Groww support contact details and a typical document checklist for nominee/claim processes, marked "verify on Groww's website, requirements can change".
- Loan details when relevant: lender, masked account, amount, how to pay.
- List of uploaded documents available for download.

Never imply that the packet gives access to funds.

The owner can call `GET /packet/preview?contact_id=` to see exactly what a given parent would see. Build this early. It catches mistakes and builds trust.

## 6. Parent access flow

1. SMS and email contain a short-lived signed link: `/p/{token}`. Default expiry 7 days. The token identifies a `PacketShare` row (packet version, contact, expires_at), not raw data.
2. Opening the link shows a minimal page asking to send an OTP to the parent's **verified** phone number.
3. After OTP success, issue a short session (30 minutes) scoped to that share, and reveal the packet.
4. Documents download through authenticated endpoints that stream decrypted content. Nothing is attached to the email by default.
5. Log every access: contact, time, IP, user agent, documents downloaded. Notify the owner on first access.
6. Responses carry `Cache-Control: no-store`, `X-Robots-Tag: noindex`, and `Referrer-Policy: no-referrer`.
7. The owner can revoke any share at any time.

## 7. Audit log

Append-only `audit_events(id, at, actor_type, actor_id, action, subject_type, subject_id, metadata_json)`. Record: activity signals, stage changes, config changes, pauses, messages queued/sent/failed/dead, consent events, packet views and downloads, logins, MFA changes, exports, deletions. The application role has INSERT but no UPDATE/DELETE on this table.

## 8. Web security checklist

- CORS restricted to the exact frontend origin(s). No wildcard with credentials.
- Security headers (HSTS, `X-Content-Type-Options`, `Content-Security-Policy` appropriate for an API, `Referrer-Policy`).
- Upload limits: file size cap, content-type sniffing (not just extension), allowlist (PDF, JPG, PNG), AV scan hook if available.
- Input validation at the edge (Pydantic) and invariants in the domain.
- Dependency audit (`pip-audit`) and update PRs in CI.
- Principle of least privilege for DB roles and storage credentials.
- Return generic errors for auth failures. Don't reveal whether an email exists.
