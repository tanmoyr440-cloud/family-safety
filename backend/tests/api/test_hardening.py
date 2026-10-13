"""Tests for Phase 8 hardening: security headers, rate limiting, and log redaction."""

from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient

from app.infrastructure.security.log_redaction import redact_sensitive_data
from app.interfaces.api.security import InMemoryRateLimiter


@pytest.mark.asyncio
async def test_security_headers_present_on_endpoints(client: AsyncClient) -> None:
    """Verifies that all API responses include defensive security headers."""
    resp = await client.get("/health")
    assert resp.status_code == 200

    headers = resp.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "max-age=63072000" in headers.get("Strict-Transport-Security", "")
    assert "default-src 'none'" in headers.get("Content-Security-Policy", "")
    assert "geolocation=()" in headers.get("Permissions-Policy", "")
    assert headers.get("X-XSS-Protection") == "1; mode=block"


@pytest.mark.asyncio
async def test_edge_rate_limiting_enforcement(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verifies edge rate limiting returns RFC 7807 problem details upon limit breach."""

    # Configure a tiny limit for test
    tiny_limiter = InMemoryRateLimiter(requests_per_minute=2)
    monkeypatch.setattr("app.main.general_rate_limiter", tiny_limiter)

    # First 2 requests succeed or reach handler (401 unauthorized because unauthenticated)
    resp1 = await client.get("/api/v1/monitor")
    assert resp1.status_code == 401
    resp2 = await client.get("/api/v1/monitor")
    assert resp2.status_code == 401

    # 3rd request breaches limit before reaching route handler
    resp3 = await client.get("/api/v1/monitor")
    assert resp3.status_code == 429
    assert resp3.headers["content-type"] == "application/problem+json"
    body = resp3.json()
    assert body["code"] == "RATE_LIMIT_EXCEEDED"
    assert body["status"] == 429
    assert "Too Many Requests" in body["title"]


def test_log_redaction_masks_sensitive_identifiers() -> None:
    """Verifies log redaction processor masks phone numbers, emails, tokens, and keys."""
    event_dict = {
        "event": "Dispatching notification to +919876543210 for user parent@example.com",
        "phone": "+919876543210",
        "email": "owner@example.com",
        "password": "SuperSecretPassword123",
        "auth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeak",
        "account_number": "123456789012",
        "nested": {
            "secret_key": "raw_secret_value",
            "contact_email": "contact@family.org",
            "message": "Call +919988776655 immediately",
        },
        "recipient_list": ["+919123456789", "alert@domain.com"],
    }

    redacted = redact_sensitive_data(MagicMock(), "info", event_dict)

    # 1. Event message redaction
    assert "+919876543210" not in redacted["event"]
    assert "parent@example.com" not in redacted["event"]
    assert "p***@example.com" in redacted["event"]

    # 2. Key-based credential masking
    assert redacted["password"] == "XXXXd123"
    assert redacted["account_number"] == "XXXX9012"
    assert redacted["auth_token"] == "XXXXLeak"

    # 3. Nested dictionary masking
    assert redacted["nested"]["secret_key"] == "XXXXalue"
    assert redacted["nested"]["contact_email"] == "c***@family.org"
    assert "+919988776655" not in redacted["nested"]["message"]

    # 4. List elements masking
    assert "+919123456789" not in redacted["recipient_list"][0]
    assert redacted["recipient_list"][1] == "a***@domain.com"
