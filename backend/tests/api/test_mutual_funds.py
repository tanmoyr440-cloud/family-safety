"""Tests for Mutual Funds API endpoints conforming to SEBI/AMFI integration."""

import uuid
import pytest
from httpx import AsyncClient

from tests.api.test_routers import _register_and_login


@pytest.mark.asyncio
async def test_mutual_funds_search_and_nav_endpoints(client: AsyncClient) -> None:
    """Verifies public SEBI/AMFI search and NAV retrieval."""
    _, _, csrf = await _register_and_login(client)

    # 1. Search schemes
    search_resp = await client.get("/api/v1/mutual-funds/search", params={"q": "Parag"})
    assert search_resp.status_code == 200
    results = search_resp.json()
    assert isinstance(results, list)
    if results:
        first = results[0]
        assert "scheme_code" in first
        assert "scheme_name" in first

    # 2. Get scheme NAV for known scheme code (e.g. Parag Parikh Flexi Cap: 122639)
    nav_resp = await client.get("/api/v1/mutual-funds/122639/nav")
    # Might return 200 with live SEBI data
    if nav_resp.status_code == 200:
        nav_data = nav_resp.json()
        assert nav_data["scheme_code"] == 122639
        assert "nav" in nav_data
        assert "fund_house" in nav_data


@pytest.mark.asyncio
async def test_mutual_fund_holdings_crud(client: AsyncClient) -> None:
    """Verifies adding, listing with live valuation, and deleting mutual fund holdings."""
    _, _, csrf = await _register_and_login(client)
    headers = {"X-CSRF-Token": csrf}

    # 1. Add mutual fund holding
    add_payload = {
        "scheme_code": 122639,
        "units": 100.5,
        "folio_number": "1234567890",
    }
    create_resp = await client.post(
        "/api/v1/mutual-funds/holdings",
        headers=headers,
        json=add_payload,
    )
    assert create_resp.status_code == 201
    holding = create_resp.json()
    assert holding["scheme_code"] == 122639
    assert holding["units"] == 100.5
    assert holding["folio_masked"] == "XXXX7890"
    holding_id = holding["id"]

    # 2. List holdings
    list_resp = await client.get("/api/v1/mutual-funds/holdings")
    assert list_resp.status_code == 200
    holdings_list = list_resp.json()
    assert any(h["id"] == holding_id for h in holdings_list)

    # 3. Delete holding
    del_resp = await client.delete(
        f"/api/v1/mutual-funds/holdings/{holding_id}",
        headers=headers,
    )
    assert del_resp.status_code == 200
    assert del_resp.json()["message"] == "Mutual fund holding removed successfully."

    # 4. Verify list is empty of deleted holding
    list_after = await client.get("/api/v1/mutual-funds/holdings")
    assert all(h["id"] != holding_id for h in list_after.json())


@pytest.mark.asyncio
async def test_clear_all_mutual_fund_holdings(client: AsyncClient) -> None:
    """Verifies clearing all mutual fund holdings in snapshot at once."""
    _, _, csrf = await _register_and_login(client)
    headers = {"X-CSRF-Token": csrf}

    # Add 2 holdings
    for code in (122639, 130503):
        await client.post(
            "/api/v1/mutual-funds/holdings",
            headers=headers,
            json={"scheme_code": code, "units": 50.0},
        )

    list_resp = await client.get("/api/v1/mutual-funds/holdings")
    assert len(list_resp.json()) >= 2

    # Clear all holdings
    clear_resp = await client.delete("/api/v1/mutual-funds/holdings", headers=headers)
    assert clear_resp.status_code == 200
    assert "Successfully removed" in clear_resp.json()["message"]

    # Verify list is empty
    list_after = await client.get("/api/v1/mutual-funds/holdings")
    assert len(list_after.json()) == 0



@pytest.mark.asyncio
async def test_cas_import_endpoint(client: AsyncClient) -> None:
    """Verifies CAS statement upload validation and processing."""
    import io
    from pypdf import PdfWriter

    _, _, csrf = await _register_and_login(client)
    headers = {"X-CSRF-Token": csrf}

    # 1. Non-pdf upload rejected
    bad_resp = await client.post(
        "/api/v1/mutual-funds/import-cas",
        headers=headers,
        files={"file": ("statement.txt", b"not a pdf", "text/plain")},
    )
    assert bad_resp.status_code == 400

    # 2. Blank valid pdf upload
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)
    pdf_bytes = buf.getvalue()

    resp = await client.post(
        "/api/v1/mutual-funds/import-cas",
        headers=headers,
        files={"file": ("cams_cas.pdf", pdf_bytes, "application/pdf")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "imported_count" in data
    assert "total_value_paise" in data
    assert "holdings" in data
    assert data["imported_count"] == 0

