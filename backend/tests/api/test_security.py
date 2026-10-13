"""Security tests: CSRF validation, rate limiting, and Problem Details error shape."""

import uuid

import pytest
from httpx import AsyncClient

from app.interfaces.api.security import auth_rate_limiter


@pytest.mark.asyncio
async def test_csrf_protection_on_mutations(client: AsyncClient) -> None:
    """Verifies that mutating requests require a valid X-CSRF-Token matching the session."""
    tag = str(uuid.uuid4())[:8]
    email = f"csrf_{tag}@example.com"
    pwd = "StrongPassword123!"

    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"name": "CSRF User", "email": email, "phone": "+919876543210", "password": pwd},
    )
    access_token = reg_resp.cookies["access_token"]
    csrf_token = reg_resp.cookies["csrf_token"]
    client.cookies.set("access_token", access_token)

    # 1. Mutating request (POST /activity/check-in) without CSRF header must fail with 403
    no_csrf_resp = await client.post("/api/v1/activity/check-in")
    assert no_csrf_resp.status_code == 403
    problem = no_csrf_resp.json()
    assert problem["code"] == "CSRF_VALIDATION_FAILED"
    assert problem["status"] == 403

    # 2. Mutating request with incorrect CSRF header must fail with 403
    bad_csrf_resp = await client.post(
        "/api/v1/activity/check-in",
        headers={"X-CSRF-Token": "invalid-token"},
    )
    assert bad_csrf_resp.status_code == 403

    # 3. Mutating request with correct CSRF header must succeed
    good_csrf_resp = await client.post(
        "/api/v1/activity/check-in",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert good_csrf_resp.status_code == 200

    # 4. GET requests should not require CSRF token
    get_resp = await client.get("/api/v1/monitor")
    assert get_resp.status_code == 200


@pytest.mark.asyncio
async def test_problem_details_error_shape_on_validation_failure(
    client: AsyncClient,
) -> None:
    """Verifies that validation failures (422) return the exact Problem Details error shape."""
    # Register with invalid email
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "A",
            "email": "not-an-email",
            "phone": "invalid",
            "password": "short",
        },
    )
    assert response.status_code == 422
    err = response.json()
    assert "type" in err
    assert "title" in err
    assert err["status"] == 422
    assert err["code"] == "VALIDATION_ERROR"
    assert "detail" in err
    assert "errors" in err
    assert isinstance(err["errors"], list)
    assert len(err["errors"]) > 0
    assert "field" in err["errors"][0]
    assert "message" in err["errors"][0]


@pytest.mark.asyncio
async def test_rate_limiting_lockout(client: AsyncClient) -> None:
    """Verifies that exceeding rate limits returns 429 Problem Details."""
    # Reset auth limiter for clean test
    auth_rate_limiter.requests.clear()

    # Exceed auth limiter (configured to 10 requests / min)
    responses = []
    for _ in range(12):
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "wrong"},
        )
        responses.append(res)

    last_res = responses[-1]
    assert last_res.status_code == 429
    data = last_res.json()
    assert data["code"] == "RATE_LIMIT_EXCEEDED"
    assert data["status"] == 429

    # Clean up
    auth_rate_limiter.requests.clear()
