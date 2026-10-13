"""Tests for Bank Accounts API endpoints conforming to api-contract.md."""

import pytest
from httpx import AsyncClient

from tests.api.test_routers import _register_and_login


@pytest.mark.asyncio
async def test_bank_accounts_crud_and_packet_inclusion(client: AsyncClient) -> None:
    """Verifies adding, listing, packet preview inclusion, and deleting bank accounts."""
    _, _, csrf = await _register_and_login(client)
    headers = {"X-CSRF-Token": csrf}

    # 1. Add bank account
    payload = {
        "bank_name": "State Bank of India",
        "account_number": "123456789012",
        "ifsc_code": "sbin0001234",
        "branch_name": "Koramangala Branch",
        "account_type": "SAVINGS",
        "holder_name": "Tanmoy Sengupta",
    }
    create_resp = await client.post(
        "/api/v1/bank-accounts",
        headers=headers,
        json=payload,
    )
    assert create_resp.status_code == 201
    account = create_resp.json()
    assert account["bank_name"] == "State Bank of India"
    assert account["account_number_masked"] == "XXXX9012"
    assert account["ifsc_code"] == "SBIN0001234"
    assert account["branch_name"] == "Koramangala Branch"
    assert account["account_type"] == "SAVINGS"
    account_id = account["id"]

    # 2. List bank accounts
    list_resp = await client.get("/api/v1/bank-accounts")
    assert list_resp.status_code == 200
    accounts = list_resp.json()
    assert len(accounts) >= 1
    found = any(a["id"] == account_id for a in accounts)
    assert found is True

    # 3. Verify Packet Preview includes bank account
    preview_resp = await client.get("/api/v1/packet/preview")
    assert preview_resp.status_code == 200
    preview_data = preview_resp.json()
    assert "bank_accounts" in preview_data
    assert any(b["id"] == account_id for b in preview_data["bank_accounts"])

    # 4. Delete bank account
    del_resp = await client.delete(f"/api/v1/bank-accounts/{account_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # 5. Verify deleted from list
    list_after = await client.get("/api/v1/bank-accounts")
    assert not any(a["id"] == account_id for a in list_after.json())


@pytest.mark.asyncio
async def test_bank_account_validation_errors(client: AsyncClient) -> None:
    """Verifies that invalid IFSC format returns 400 Bad Request."""
    _, _, csrf = await _register_and_login(client)
    headers = {"X-CSRF-Token": csrf}

    # 11-character IFSC with invalid format (5th character not 0)
    resp_ifsc = await client.post(
        "/api/v1/bank-accounts",
        headers=headers,
        json={
            "bank_name": "HDFC Bank",
            "account_number": "1234567890",
            "ifsc_code": "HDFC1000001",
        },
    )
    assert resp_ifsc.status_code == 400
    assert "Invalid IFSC code" in resp_ifsc.json().get("detail", "")
