# Family Safety Net - Backend

FastAPI backend for Family Safety Net: alerts trusted family contacts upon Groww inactivity (90 days) or missed car-loan EMI (Rs 16,166 due on the 24th).

---

## 1. Requirements

- Python 3.13+
- [uv](https://docs.astral.sh/uv/) package manager
- PostgreSQL 16+ (or Docker / Docker Compose)

---

## 2. Setup & Local Run

### Install dependencies
```bash
uv sync --all-groups
```

### Run database migrations
```bash
uv run alembic upgrade head
```

### Run quality checks & test suite
```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy --strict app tests
uv run lint-imports
uv run pip-audit
uv run pytest
```

### Start the API service
```bash
uv run uvicorn app.main:app --reload --port 8000
```

### Start the Background Worker process
```bash
uv run python -m app.interfaces.worker run --interval 60
```

---

## 3. Endpoints & Health Verification

- **API Documentation**: `http://localhost:8000/docs` or `/redoc`
- **Root Health**: `GET http://localhost:8000/health`
- **API Health**: `GET http://localhost:8000/api/v1/health`
- **Scheduler Watchdog Health**: `GET http://localhost:8000/api/v1/health/scheduler`

---

## 4. Runbook: What to Do If the Worker Is Down

### Architecture Overview
The background worker (`app.interfaces.worker`) runs as a dedicated, independent process separated from the web API. It executes:
1. **Evaluation Jobs**: Evaluates owner inactivity and loan obligations against policy thresholds.
2. **Outbox Dispatcher**: Dispatches queued SMS and email notifications via transactional outbox with exponential backoff and dead-letter handling.
3. **Heartbeat Publisher**: Periodically writes a timestamped record to the database.

### Detection & Symptoms
- **Alert Trigger**: `GET /api/v1/health/scheduler` returns `status: "DOWN"` or `"DEGRADED"` when the worker heartbeat is missing or older than 300 seconds.
- **Observable Symptoms**:
  - Outbox messages remain in `PENDING` state with `attempts == 0`.
  - Inactivity stages do not advance despite elapsed days.
  - Missed EMI notifications on the 24th + grace period do not dispatch.

### Step-by-Step Diagnostic Checklist

1. **Verify Process Status**:
   ```bash
   # On Linux/macOS
   ps aux | grep "app.interfaces.worker"
   # On Docker Compose
   docker compose ps worker
   ```

2. **Inspect Worker Logs**:
   ```bash
   docker compose logs -f --tail=200 worker
   ```
   *Look for database connection timeouts, network exhaustion, or uncaught provider exceptions.*

3. **Check Outbox Queue Backlog**:
   Inspect message counts across statuses:
   ```sql
   SELECT status, count(*)
   FROM outbox_messages
   GROUP BY status;
   ```

4. **Inspect Dead-Letter Queue (DLQ)**:
   Messages that fail all retry attempts transition to `DEAD` state:
   ```sql
   SELECT id, channel, recipient_label, attempts, last_error, created_at
   FROM outbox_messages
   WHERE status = 'DEAD'
   ORDER BY created_at DESC;
   ```

5. **Restarting the Worker**:
   Start the worker in daemon loop mode:
   ```bash
   uv run python -m app.interfaces.worker run --interval 60
   ```
   To test or diagnose without sending real notifications, use `--dry-run`:
   ```bash
   uv run python -m app.interfaces.worker run --dry-run
   ```

6. **Catch-up & Safe Replay (Idempotency)**:
   - All evaluation and escalation jobs are strictly **idempotent**. Every escalation message uses a deterministic `dedupe_key` (e.g. `inactivity:owner-1:WARN_OWNER_1` or `loan:loan-1:2026-10:MISSED`).
   - Catching up on missed days or running multiple worker instances will **never** double-send or spam family contacts.
   - To replay or evaluate a specific past date:
     ```bash
     uv run python -m app.interfaces.worker evaluate --as-of 2026-10-24T09:00:00+05:30
     ```

---

## 5. Backup & Disaster Recovery

### Database Backup
Create an encrypted PostgreSQL dump:
```bash
# Export compressed binary dump
pg_dump -h localhost -U postgres -d family_safety_net -F c -b -v -f backup_$(date +%Y%m%d_%H%M%S).dump

# Encrypt backup at rest
gpg --symmetric --cipher-algo AES256 backup_*.dump
```

### Database Restore
```bash
# Decrypt archive
gpg --decrypt backup_*.dump.gpg > restore.dump

# Restore into database
pg_restore -h localhost -U postgres -d family_safety_net -v -c restore.dump
```

### Encrypted Document Store Backup
- Document payloads are envelope-encrypted at rest using Fernet/AES-256 before disk writes.
- Back up the document storage directory in sync with database backups.
- Ensure the master key (`SECRET_KEY` in `.env`) is securely backed up in an external password manager or secret vault.

---

## 6. Security Hardening & Defenses

- **Security Headers**: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: default-src 'none'`, and `Permissions-Policy`.
- **Sliding-Window Rate Limiting**: Enforced on the edge per client IP, with dedicated strict limiters on login, registration, and OTP verification endpoints.
- **Log Redaction**: Automatic structlog processor masks all phone numbers, email addresses, JWT tokens, and credentials in application and worker logs.
- **Automated Vulnerability Scanning**: `pip-audit` runs in GitHub Actions CI on every commit and pull request.
