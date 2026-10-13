"""Tests for all application routers conforming to api-contract.md."""

import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from app.interfaces.api.security import create_checkin_token


async def _register_and_login(client: AsyncClient) -> tuple[str, str, str]:
    """Helper to create a user and set authentication cookies."""
    tag = str(uuid.uuid4())[:8]
    email = f"user_{tag}@example.com"
    pwd = "StrongPassword123!"

    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"name": "Router Tester", "email": email, "phone": "+919876543210", "password": pwd},
    )
    assert reg_resp.status_code == 201
    owner_id = reg_resp.json()["id"]
    access_token = reg_resp.cookies["access_token"]
    csrf_token = reg_resp.cookies["csrf_token"]
    client.cookies.set("access_token", access_token)
    return owner_id, access_token, csrf_token


@pytest.mark.asyncio
async def test_activity_and_monitor_endpoints(client: AsyncClient) -> None:
    """Verifies check-in, magic link, monitor status, config, and pause/resume."""
    owner_id, _, csrf = await _register_and_login(client)
    headers = {"X-CSRF-Token": csrf}

    # 1. Authenticated check-in
    checkin_resp = await client.post("/api/v1/activity/check-in", headers=headers)
    assert checkin_resp.status_code == 200
    assert checkin_resp.json()["success"] is True

    # 2. Magic link check-in
    magic_token = create_checkin_token(owner_id)
    magic_resp = await client.post(f"/api/v1/activity/check-in/link/{magic_token}")
    assert magic_resp.status_code == 200
    assert magic_resp.json()["success"] is True

    # 3. Get monitor status
    mon_resp = await client.get("/api/v1/monitor")
    assert mon_resp.status_code == 200
    mon_data = mon_resp.json()
    assert mon_data["threshold_days"] == 90
    assert mon_data["status"] == "OK"

    # 4. Update monitor config
    cfg_resp = await client.put(
        "/api/v1/monitor/config",
        headers=headers,
        json={"threshold_days": 100, "warning_days": [50, 75], "parent_repeat_every_days": 7},
    )
    assert cfg_resp.status_code == 200

    # 5. Pause monitor
    pause_until = (date.today() + timedelta(days=15)).isoformat()
    pause_resp = await client.post(
        "/api/v1/monitor/pause",
        headers=headers,
        json={"until": pause_until},
    )
    assert pause_resp.status_code == 200

    mon_paused = await client.get("/api/v1/monitor")
    assert mon_paused.json()["status"] == "PAUSED"

    # 6. Resume monitor
    resume_resp = await client.delete("/api/v1/monitor/pause", headers=headers)
    assert resume_resp.status_code == 200


@pytest.mark.asyncio
async def test_contacts_endpoints(client: AsyncClient) -> None:
    """Verifies contact CRUD and public verification/opt-out."""
    _, _, csrf = await _register_and_login(client)
    headers = {"X-CSRF-Token": csrf}

    # 1. Create contact
    contact_payload = {
        "name": "Mom",
        "relation": "Mother",
        "phone": "+919876543211",
        "email": "mom@example.com",
        "priority": 1,
    }
    create_resp = await client.post("/api/v1/contacts", headers=headers, json=contact_payload)
    assert create_resp.status_code == 201
    contact = create_resp.json()
    contact_id = contact["id"]
    assert contact["consent"] == "PENDING"

    # 2. List contacts
    list_resp = await client.get("/api/v1/contacts")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1

    # 3. Update contact
    patch_resp = await client.patch(
        f"/api/v1/contacts/{contact_id}",
        headers=headers,
        json={"priority": 2},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["priority"] == 2

    # 4. Request OTP and verify with real OTP
    send_resp = await client.post(f"/api/v1/contacts/{contact_id}/verify/send", headers=headers)
    assert send_resp.status_code == 200
    import re
    match = re.search(r"Dev OTP:\s*(\d{6})", send_resp.json()["message"])
    assert match is not None
    real_otp = match.group(1)

    # 4a. Wrong OTP fails
    bad_resp = await client.post(
        "/api/v1/public/contacts/verify",
        json={"token": contact_id, "otp": "000000"},
    )
    assert bad_resp.status_code == 401

    # 4b. Real OTP succeeds
    verify_resp = await client.post(
        "/api/v1/public/contacts/verify",
        json={"token": contact_id, "otp": real_otp},
    )
    assert verify_resp.status_code == 200

    # Contact is now VERIFIED
    list_again = await client.get("/api/v1/contacts")
    updated = next(c for c in list_again.json() if c["id"] == contact_id)
    assert updated["consent"] == "VERIFIED"

    # 5. Public opt-out
    optout_resp = await client.post(
        "/api/v1/public/contacts/opt-out",
        json={"token": contact_id},
    )
    assert optout_resp.status_code == 200

    # 6. Delete contact
    del_resp = await client.delete(f"/api/v1/contacts/{contact_id}", headers=headers)
    assert del_resp.status_code == 200


@pytest.mark.asyncio
async def test_loans_and_installments_endpoints(client: AsyncClient) -> None:
    """Verifies loan CRUD, integer emi_paise, and mark-paid."""
    _, _, csrf = await _register_and_login(client)
    headers = {"X-CSRF-Token": csrf}

    # 1. Create loan with emi_paise: 1616600, due_day: 24
    loan_payload = {
        "lender": "HDFC Bank Car Loan",
        "account_number": "123456789012",
        "emi_paise": 1616600,
        "due_day": 24,
        "grace_days": 1,
        "payment_instructions": {
            "upi_id": "carloan@hdfc",
            "portal_url": "https://netbanking.hdfcbank.com",
            "notes": "Auto-debit from salary account",
        },
    }
    create_resp = await client.post("/api/v1/loans", headers=headers, json=loan_payload)
    assert create_resp.status_code == 201
    loan = create_resp.json()
    loan_id = loan["id"]
    assert loan["emi_paise"] == 1616600
    assert loan["due_day"] == 24
    assert loan["account_masked"] == "XXXX9012"

    # 2. List loans
    list_resp = await client.get("/api/v1/loans")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1

    # 3. Patch loan
    patch_resp = await client.patch(
        f"/api/v1/loans/{loan_id}",
        headers=headers,
        json={"grace_days": 2},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["grace_days"] == 2

    # 4. Mark installment paid
    curr_ym = f"{date.today().year:04d}-{date.today().month:02d}"
    pay_resp = await client.post(
        f"/api/v1/loans/{loan_id}/installments/{curr_ym}/mark-paid",
        headers=headers,
        json={"reference": "UPI-REF-998877"},
    )
    assert pay_resp.status_code == 200
    inst = pay_resp.json()
    assert inst["status"] == "PAID"
    assert inst["amount_paise"] == 1616600

    # 5. List installments
    inst_list = await client.get(f"/api/v1/loans/{loan_id}/installments")
    assert inst_list.status_code == 200
    assert len(inst_list.json()) >= 1


@pytest.mark.asyncio
async def test_accounts_and_packet_endpoints(client: AsyncClient) -> None:
    """Verifies Groww accounts, documents upload, and packet preview/public flows."""
    _, _, csrf = await _register_and_login(client)
    headers = {"X-CSRF-Token": csrf}

    # Accounts
    groww_resp = await client.get("/api/v1/accounts/groww")
    assert groww_resp.status_code == 200
    assert groww_resp.json()["connected"] is False

    # Disabled refresh-holdings returns 400 Problem Details
    refresh_resp = await client.post("/api/v1/accounts/groww/refresh-holdings", headers=headers)
    assert refresh_resp.status_code == 400
    assert refresh_resp.json()["code"] == "FEATURE_DISABLED"

    update_groww = await client.put(
        "/api/v1/accounts/groww",
        headers=headers,
        json={"api_key": "dummy_key"},
    )
    assert update_groww.status_code == 200

    # Packet preview
    preview_resp = await client.get("/api/v1/packet/preview")
    assert preview_resp.status_code == 200
    assert preview_resp.json()["owner_name"] == "Router Tester"

    # Create a contact and packet share for real token testing
    contact_resp = await client.post(
        "/api/v1/contacts",
        headers=headers,
        json={
            "name": "Mom",
            "relation": "Mother",
            "phone": "+919876543210",
            "email": "mom@example.com",
            "priority": 1,
        },
    )
    assert contact_resp.status_code == 201
    contact_id = contact_resp.json()["id"]

    share_resp = await client.post(
        "/api/v1/packet/shares",
        headers=headers,
        json={"contact_id": contact_id},
    )
    assert share_resp.status_code == 201
    share_token = share_resp.json()["token"]

    # Public packet access
    pub_info = await client.get(f"/api/v1/public/packet/{share_token}")
    assert pub_info.status_code == 200
    assert pub_info.headers["Cache-Control"] == "no-store"
    assert pub_info.headers["X-Robots-Tag"] == "noindex"

    # Public packet OTP verify
    pub_otp = await client.post(
        f"/api/v1/public/packet/{share_token}/otp/verify",
        json={"otp": "123456"},
    )
    assert pub_otp.status_code == 200
    session_token = pub_otp.json()["session_token"]

    # Public session view
    session_view = await client.get(
        "/api/v1/public/packet/session",
        headers={"Authorization": f"Bearer {session_token}"},
    )
    assert session_view.status_code == 200


@pytest.mark.asyncio
async def test_health_and_notifications_endpoints(client: AsyncClient) -> None:
    """Verifies health check and notification logs."""
    await _register_and_login(client)

    # Health
    h_resp = await client.get("/health")
    assert h_resp.status_code == 200
    assert h_resp.json()["status"] == "ok"

    v1_h_resp = await client.get("/api/v1/health")
    assert v1_h_resp.status_code == 200

    sched_resp = await client.get("/api/v1/health/scheduler")
    assert sched_resp.status_code == 200
    assert sched_resp.json()["status"] == "ok"

    # Notifications
    notif_resp = await client.get("/api/v1/notifications")
    assert notif_resp.status_code == 200
    assert isinstance(notif_resp.json(), list)


@pytest.mark.asyncio
async def test_send_emergency_alert_endpoint(client: AsyncClient) -> None:
    """Verifies sending emergency alert email with financial details and attachments."""
    _, _, csrf = await _register_and_login(client)
    headers = {"X-CSRF-Token": csrf}

    # 1. Create a contact
    contact_payload = {
        "name": "Father",
        "relation": "Father",
        "phone": "+919876543212",
        "email": "father@example.com",
        "priority": 1,
    }
    c_resp = await client.post("/api/v1/contacts", headers=headers, json=contact_payload)
    assert c_resp.status_code == 201
    contact_id = c_resp.json()["id"]

    # 2. Add a bank account
    bank_resp = await client.post(
        "/api/v1/bank-accounts",
        headers=headers,
        json={
            "bank_name": "HDFC Bank",
            "account_number": "50100123456789",
            "ifsc_code": "HDFC0001234",
            "branch_name": "Indiranagar",
            "account_type": "SAVINGS",
        },
    )
    assert bank_resp.status_code == 201

    # 3. Upload a document
    doc_files = {"file": ("aadhaar_card.pdf", b"%PDF-1.4 mock pdf content", "application/pdf")}
    doc_data = {"title": "Aadhaar Card", "category": "identity"}
    doc_resp = await client.post(
        "/api/v1/documents",
        headers=headers,
        files=doc_files,
        data=doc_data,
    )
    assert doc_resp.status_code == 201

    # 4. Trigger send emergency alert
    alert_resp = await client.post(
        "/api/v1/notifications/send-emergency-alert",
        headers=headers,
        json={"contact_id": contact_id},
    )
    assert alert_resp.status_code == 200
    alert_data = alert_resp.json()
    assert alert_data["status"] == "SENT"
    assert alert_data["recipient"] == "father@example.com"
    assert alert_data["channel"] == "EMAIL"
    assert "aadhaar_card.pdf" in alert_data["attached_documents"]
    assert alert_data["total_bank_accounts"] >= 1

    # 5. Check that notification log has the recorded message
    notif_resp = await client.get("/api/v1/notifications")
    assert notif_resp.status_code == 200
    items = notif_resp.json()
    assert any(item["recipient_label"] == "father@example.com" for item in items)
