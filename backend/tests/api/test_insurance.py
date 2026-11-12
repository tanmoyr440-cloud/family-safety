"""Tests for Insurance Policy & Cashless Claim Hub API endpoints."""

import pytest
from httpx import AsyncClient

from tests.api.test_routers import _register_and_login


@pytest.mark.asyncio
async def test_insurance_policy_crud_and_packet_inclusion(client: AsyncClient) -> None:
    """Verifies adding, listing, updating, playbook retrieval, packet preview inclusion, and deleting policies."""
    _, _, csrf = await _register_and_login(client)
    headers = {"X-CSRF-Token": csrf}

    # 1. Add insurance policy
    payload = {
        "policy_name": "HDFC ERGO Optima Secure",
        "policy_type": "HEALTH",
        "policy_number": "28252001234567",
        "insurer_name": "HDFC ERGO General Insurance",
        "sum_insured_paise": 100_000_000,  # 10 Lakhs
        "premium_amount_paise": 1_850_000,
        "premium_due_date": "2026-12-15",
        "cashless_tpa_name": "Medi Assist TPA",
        "tpa_id_number": "MED12345678",
        "emergency_helpline": "1800 2666 400",
        "claim_email": "claims@hdfcergo.com",
        "nominee_name": "Family",
        "nominee_relation": "Parents",
        "hospital_cashless_notes": "Present TPA card at desk within 24 hours of admission.",
    }
    create_resp = await client.post(
        "/api/v1/insurance",
        headers=headers,
        json=payload,
    )
    assert create_resp.status_code == 201
    policy = create_resp.json()
    assert policy["policy_name"] == "HDFC ERGO Optima Secure"
    assert policy["policy_type"] == "HEALTH"
    assert policy["policy_number_masked"] == "XXXX4567"
    assert policy["has_unmasked_policy"] is True
    assert policy["sum_insured_paise"] == 100_000_000
    assert policy["cashless_tpa_name"] == "Medi Assist TPA"
    assert policy["emergency_helpline"] == "1800 2666 400"
    policy_id = policy["id"]

    # 2. List insurance policies
    list_resp = await client.get("/api/v1/insurance")
    assert list_resp.status_code == 200
    policies = list_resp.json()
    assert len(policies) >= 1
    assert any(p["id"] == policy_id for p in policies)

    # 3. Get single policy
    get_resp = await client.get(f"/api/v1/insurance/{policy_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == policy_id

    # 4. Update policy
    update_resp = await client.patch(
        f"/api/v1/insurance/{policy_id}",
        headers=headers,
        json={
            "sum_insured_paise": 150_000_000,
            "cashless_tpa_name": "Paramount TPA",
        },
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["sum_insured_paise"] == 150_000_000
    assert updated["cashless_tpa_name"] == "Paramount TPA"

    # 5. Fetch Claim Playbook
    playbook_resp = await client.get("/api/v1/insurance/playbook/HEALTH")
    assert playbook_resp.status_code == 200
    playbook = playbook_resp.json()
    assert playbook["title"] == "Hospital Cashless Treatment SOP"
    assert len(playbook["steps"]) == 5
    assert len(playbook["documents_checklist"]) > 0

    # 6. Verify Packet Preview includes insurance policies
    preview_resp = await client.get("/api/v1/packet/preview")
    assert preview_resp.status_code == 200
    preview_data = preview_resp.json()
    assert "insurance_policies" in preview_data
    assert any(p["id"] == policy_id for p in preview_data["insurance_policies"])

    # 7. Delete policy
    del_resp = await client.delete(f"/api/v1/insurance/{policy_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # 8. Verify deleted from list
    list_after = await client.get("/api/v1/insurance")
    assert not any(p["id"] == policy_id for p in list_after.json())
