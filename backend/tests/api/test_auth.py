"""Tests for authentication and session lifecycle endpoints."""

import struct
import time
import uuid

import pytest
from httpx import AsyncClient


def _generate_totp_code(secret: str) -> str:
    """Helper to compute valid TOTP code for test verification."""
    import base64
    import hashlib
    import hmac

    pad_len = (8 - len(secret) % 8) % 8
    key = base64.b32decode(secret + ("=" * pad_len), casefold=True)
    interval = int(time.time() // 30)
    msg = struct.pack(">Q", interval)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (
        ((digest[offset] & 0x7F) << 24)
        | ((digest[offset + 1] & 0xFF) << 16)
        | ((digest[offset + 2] & 0xFF) << 8)
        | (digest[offset + 3] & 0xFF)
    )
    return f"{code % 1_000_000:06d}"


@pytest.mark.asyncio
async def test_register_owner(client: AsyncClient) -> None:
    """Verifies that an owner can register and receive session cookies."""
    tag = str(uuid.uuid4())[:8]
    payload = {
        "name": "Tanmoy Test",
        "email": f"owner_{tag}@example.com",
        "phone": "+919876543210",
        "password": "StrongPassword123!",
    }

    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Tanmoy Test"
    assert data["email"] == payload["email"]
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies
    assert "csrf_token" in response.cookies


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient) -> None:
    """Verifies that duplicate registration fails with 409 Problem Details."""
    tag = str(uuid.uuid4())[:8]
    payload = {
        "name": "Duplicate Owner",
        "email": f"dup_{tag}@example.com",
        "phone": "+919876543210",
        "password": "StrongPassword123!",
    }

    res1 = await client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    err = res2.json()
    assert err["code"] == "EMAIL_ALREADY_EXISTS"
    assert err["status"] == 409


@pytest.mark.asyncio
async def test_login_flow(client: AsyncClient) -> None:
    """Verifies login with valid and invalid credentials."""
    tag = str(uuid.uuid4())[:8]
    email = f"login_{tag}@example.com"
    pwd = "StrongPassword123!"

    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"name": "Login User", "email": email, "phone": "+919876543210", "password": pwd},
    )
    assert reg_resp.status_code == 201

    # Invalid password
    bad_login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword"},
    )
    assert bad_login.status_code == 401
    assert bad_login.json()["code"] == "UNAUTHORIZED"

    # Valid login
    good_login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": pwd},
    )
    assert good_login.status_code == 200
    data = good_login.json()
    assert data["owner"]["email"] == email
    assert "access_token" in good_login.cookies
    assert "refresh_token" in good_login.cookies


@pytest.mark.asyncio
async def test_session_refresh_and_logout(client: AsyncClient) -> None:
    """Verifies token rotation on refresh and revocation on logout."""
    tag = str(uuid.uuid4())[:8]
    email = f"refresh_{tag}@example.com"
    pwd = "StrongPassword123!"

    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"name": "Refresh User", "email": email, "phone": "+919876543210", "password": pwd},
    )
    assert reg_resp.status_code == 201
    old_refresh_token = reg_resp.cookies["refresh_token"]

    # Refresh
    client.cookies.set("refresh_token", old_refresh_token)
    ref_resp = await client.post("/api/v1/auth/refresh")
    assert ref_resp.status_code == 200
    new_refresh_token = ref_resp.cookies["refresh_token"]
    assert new_refresh_token != old_refresh_token

    # Replaying old refresh token must be rejected (single-use rotation)
    client.cookies.set("refresh_token", old_refresh_token)
    replay_resp = await client.post("/api/v1/auth/refresh")
    assert replay_resp.status_code == 401

    # Logout
    client.cookies.set("refresh_token", new_refresh_token)
    logout_resp = await client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200


@pytest.mark.asyncio
async def test_mfa_enroll_and_verify(client: AsyncClient) -> None:
    """Verifies MFA enrollment and verification flow."""
    tag = str(uuid.uuid4())[:8]
    email = f"mfa_{tag}@example.com"
    pwd = "StrongPassword123!"

    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"name": "MFA User", "email": email, "phone": "+919876543210", "password": pwd},
    )
    assert reg_resp.status_code == 201
    access_token = reg_resp.cookies["access_token"]
    csrf_token = reg_resp.cookies["csrf_token"]

    client.cookies.set("access_token", access_token)
    headers = {"X-CSRF-Token": csrf_token}

    # Enroll MFA
    enroll_resp = await client.post("/api/v1/auth/mfa/enroll", headers=headers)
    assert enroll_resp.status_code == 200
    secret = enroll_resp.json()["secret"]
    assert secret

    # Verify invalid code
    bad_verify = await client.post(
        "/api/v1/auth/mfa/verify",
        headers=headers,
        json={"code": "000000"},
    )
    assert bad_verify.status_code == 401

    # Verify valid code
    valid_code = _generate_totp_code(secret)
    good_verify = await client.post(
        "/api/v1/auth/mfa/verify",
        headers=headers,
        json={"code": valid_code},
    )
    assert good_verify.status_code == 200

    # Profile shows mfa_enabled=True
    me_resp = await client.get("/api/v1/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["mfa_enabled"] is True


@pytest.mark.asyncio
async def test_owner_export_and_delete(client: AsyncClient) -> None:
    """Verifies DPDP export and account deletion."""
    tag = str(uuid.uuid4())[:8]
    email = f"export_{tag}@example.com"
    pwd = "StrongPassword123!"

    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"name": "Export User", "email": email, "phone": "+919876543210", "password": pwd},
    )
    access_token = reg_resp.cookies["access_token"]
    csrf_token = reg_resp.cookies["csrf_token"]
    client.cookies.set("access_token", access_token)

    # Export
    export_resp = await client.get("/api/v1/me/export")
    assert export_resp.status_code == 200
    data = export_resp.json()
    assert data["owner"]["email"] == email
    assert "exported_at" in data

    # Delete
    del_resp = await client.delete("/api/v1/me", headers={"X-CSRF-Token": csrf_token})
    assert del_resp.status_code == 200

    # Subsequent GET /me fails
    client.cookies.set("access_token", access_token)
    get_del = await client.get("/api/v1/me")
    assert get_del.status_code == 401


@pytest.mark.asyncio
async def test_cross_origin_header_based_auth(client: AsyncClient) -> None:
    """Verifies that authentication works purely via headers (Bearer & X-Refresh-Token)."""
    tag = str(uuid.uuid4())[:8]
    email = f"cross_origin_{tag}@example.com"
    pwd = "StrongPassword123!"

    reg = await client.post(
        "/api/v1/auth/register",
        json={"name": "Cross Origin", "email": email, "phone": "+919876543210", "password": pwd},
    )
    assert reg.status_code == 201

    # Login and extract tokens from response body and headers
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": pwd},
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    access_token = login_data["access_token"]
    refresh_token = login_data["refresh_token"]
    csrf_token = login_data["csrf_token"]
    assert access_token is not None
    assert refresh_token is not None
    assert csrf_token is not None

    # Clear all cookies from client to simulate cross-origin scenario where cookies are blocked
    client.cookies.clear()

    # GET /api/v1/me with Bearer token
    me_resp = await client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == email

    # POST /api/v1/auth/refresh with X-Refresh-Token header and no cookies
    ref_resp = await client.post(
        "/api/v1/auth/refresh",
        headers={"X-Refresh-Token": refresh_token},
    )
    assert ref_resp.status_code == 200
    ref_data = ref_resp.json()
    new_access_token = ref_data["access_token"]
    new_refresh_token = ref_data["refresh_token"]
    assert new_access_token is not None
    assert new_refresh_token != refresh_token

    # Verify new token works with GET /me
    me_resp_2 = await client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {new_access_token}"},
    )
    assert me_resp_2.status_code == 200


@pytest.mark.asyncio
async def test_login_does_not_reset_inactivity_clock(client: AsyncClient) -> None:
    """Verifies that authenticating/logging in does NOT reset the inactivity clock.

    Only explicitly calling POST /api/v1/activity/check-in resets the clock.
    """
    from datetime import UTC, datetime, timedelta
    from app.interfaces.api.dependencies import get_session_factory
    from app.infrastructure.persistence.models import InactivityMonitorModel
    from sqlalchemy import update

    tag = str(uuid.uuid4())[:8]
    email = f"clock_{tag}@example.com"
    pwd = "StrongPassword123!"

    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"name": "Clock Test User", "email": email, "phone": "+919876543210", "password": pwd},
    )
    assert reg_resp.status_code == 201
    owner_id = reg_resp.json()["id"]

    # Manually backdate the monitor's last_activity_at to 25 days ago
    past_time = datetime.now(UTC) - timedelta(days=25)
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = (
            update(InactivityMonitorModel)
            .where(InactivityMonitorModel.owner_id == owner_id)
            .values(last_activity_at=past_time)
        )
        await session.execute(stmt)
        await session.commit()

    # Log in
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": pwd},
    )
    assert login_resp.status_code == 200
    access_token = login_resp.json()["access_token"]
    csrf_token = login_resp.json()["csrf_token"]
    headers = {
        "Authorization": f"Bearer {access_token}",
        "X-CSRF-Token": csrf_token,
    }

    # Fetch monitor: days_idle must reflect 25 days (NOT reset by login!)
    monitor_resp = await client.get("/api/v1/monitor", headers=headers)
    assert monitor_resp.status_code == 200
    data = monitor_resp.json()
    assert data["days_idle"] == 25

    # Now perform explicit check-in
    check_in_resp = await client.post("/api/v1/activity/check-in", headers=headers)
    assert check_in_resp.status_code == 200

    # Monitor should now show days_idle == 0
    fresh_monitor = await client.get("/api/v1/monitor", headers=headers)
    assert fresh_monitor.status_code == 200
    assert fresh_monitor.json()["days_idle"] == 0

