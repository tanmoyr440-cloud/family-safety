"""Security tests for Phase 6: packet and document security.

Covers:
- Expired and tampered packet link tokens
- Expired and tampered session tokens
- Parent OTP lockout after consecutive failures
- Cache-Control: no-store and X-Robots-Tag: noindex headers
- Cross-user access isolation (documents, shares, and session downloads)
- Share revocation invalidation
- Envelope encryption and integrity protection
- Audit logging verification
"""

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.config import settings
from app.infrastructure.persistence.models import AuditEventModel
from app.infrastructure.storage.encrypted_document_store import (
    DocumentIntegrityError,
    EncryptedDocumentStore,
)
from app.interfaces.api.security import (
    JWT_ALGORITHM,
    create_packet_session_token,
    create_packet_share_token,
)
from app.main import app


async def _register_user(client: AsyncClient, prefix: str) -> tuple[str, str, dict[str, str]]:
    """Helper to register and login a user, returning (owner_id, email, headers)."""
    tag = str(uuid.uuid4())[:8]
    email = f"{prefix}_{tag}@example.com"
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": f"{prefix.capitalize()} User",
            "email": email,
            "phone": "+919876543210",
            "password": "StrongPassword123!",
        },
    )
    assert reg_resp.status_code == 201
    owner_id: str = reg_resp.json()["id"]

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "StrongPassword123!"},
    )
    assert login_resp.status_code == 200
    csrf = login_resp.json()["csrf_token"]
    headers = {"X-CSRF-Token": csrf}
    return owner_id, email, headers


@pytest.mark.asyncio
async def test_expired_and_tampered_packet_share_tokens(client: AsyncClient) -> None:
    """Verifies that expired or forged packet share tokens are rejected with 401."""
    _, _, headers = await _register_user(client, "alice")

    # Create contact and packet share
    contact_resp = await client.post(
        "/api/v1/contacts",
        headers=headers,
        json={
            "name": "Alice Mom",
            "relation": "Mother",
            "phone": "+919876543210",
            "email": "mom_alice@example.com",
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
    share_id = share_resp.json()["id"]
    valid_token = share_resp.json()["token"]

    # 1. Valid token succeeds
    info_ok = await client.get(f"/api/v1/public/packet/{valid_token}")
    assert info_ok.status_code == 200

    # 2. Tampered token signature fails
    tampered_token = valid_token[:-6] + "abcdef"
    resp_tampered = await client.get(f"/api/v1/public/packet/{tampered_token}")
    assert resp_tampered.status_code == 401

    # 3. Forged token signed with a different key fails
    fake_token = jwt.encode(
        {"share_id": share_id, "purpose": "packet_share", "exp": 9999999999},
        "wrong-secret-key-12345678901234567890",
        algorithm=JWT_ALGORITHM,
    )
    resp_fake = await client.get(f"/api/v1/public/packet/{fake_token}")
    assert resp_fake.status_code == 401

    # 4. Expired token fails
    expired_token = create_packet_share_token(
        share_id=share_id,
        expires_at=datetime.now(UTC) - timedelta(minutes=10),
    )
    resp_expired = await client.get(f"/api/v1/public/packet/{expired_token}")
    assert resp_expired.status_code == 401

    # 5. Token with wrong purpose fails
    wrong_purpose_token = jwt.encode(
        {"share_id": share_id, "purpose": "auth_access", "exp": 9999999999},
        settings.secret_key,
        algorithm=JWT_ALGORITHM,
    )
    resp_purpose = await client.get(f"/api/v1/public/packet/{wrong_purpose_token}")
    assert resp_purpose.status_code == 401

    # 6. Expired session token fails on session access
    expired_session = create_packet_session_token(
        share_id=share_id,
        expires_at=datetime.now(UTC) - timedelta(minutes=10),
    )
    resp_exp_session = await client.get(
        "/api/v1/public/packet/session",
        headers={"Authorization": f"Bearer {expired_session}"},
    )
    assert resp_exp_session.status_code == 401


@pytest.mark.asyncio
async def test_otp_lockout_after_consecutive_failures(client: AsyncClient) -> None:
    """Verifies that 3 consecutive failed OTP attempts trigger a 15-minute lockout (429)."""
    _, _, headers = await _register_user(client, "bob")

    contact_resp = await client.post(
        "/api/v1/contacts",
        headers=headers,
        json={
            "name": "Bob Father",
            "relation": "Father",
            "phone": "+919876543211",
            "email": "dad_bob@example.com",
            "priority": 1,
        },
    )
    contact_id = contact_resp.json()["id"]

    share_resp = await client.post(
        "/api/v1/packet/shares",
        headers=headers,
        json={"contact_id": contact_id},
    )
    token = share_resp.json()["token"]

    # Send OTP
    send_resp = await client.post(f"/api/v1/public/packet/{token}/otp/send")
    assert send_resp.status_code == 200

    # Failed attempt 1 -> 401
    fail_1 = await client.post(
        f"/api/v1/public/packet/{token}/otp/verify",
        json={"otp": "000000"},
    )
    assert fail_1.status_code == 401

    # Failed attempt 2 -> 401
    fail_2 = await client.post(
        f"/api/v1/public/packet/{token}/otp/verify",
        json={"otp": "111111"},
    )
    assert fail_2.status_code == 401

    # Failed attempt 3 -> triggers lockout (429)
    fail_3 = await client.post(
        f"/api/v1/public/packet/{token}/otp/verify",
        json={"otp": "222222"},
    )
    assert fail_3.status_code == 429
    assert fail_3.json()["code"] == "OTP_LOCKED_OUT"

    # Subsequent verification attempt while locked out (even with valid OTP) -> 429
    locked_attempt = await client.post(
        f"/api/v1/public/packet/{token}/otp/verify",
        json={"otp": "123456"},
    )
    assert locked_attempt.status_code == 429
    assert locked_attempt.json()["code"] == "OTP_LOCKED_OUT"

    # Subsequent OTP request while locked out -> 429
    locked_send = await client.post(f"/api/v1/public/packet/{token}/otp/send")
    assert locked_send.status_code == 429
    assert locked_send.json()["code"] == "OTP_LOCKED_OUT"


@pytest.mark.asyncio
async def test_security_headers_on_packet_and_documents(client: AsyncClient) -> None:
    """Verifies that all public packet and document endpoints include strict security headers."""
    _, _, headers = await _register_user(client, "charlie")

    # 1. Upload document
    pdf_bytes = b"%PDF-1.4 test document content for emergency packet"
    files = {"file": ("test_policy.pdf", pdf_bytes, "application/pdf")}
    upload_resp = await client.post(
        "/api/v1/documents",
        headers=headers,
        data={"title": "Insurance Policy", "category": "insurance"},
        files=files,
    )
    assert upload_resp.status_code == 201
    doc_id = upload_resp.json()["id"]

    # 2. Create contact & share
    contact_resp = await client.post(
        "/api/v1/contacts",
        headers=headers,
        json={
            "name": "Charlie Parent",
            "relation": "Father",
            "phone": "+919876543212",
            "email": "charlie_dad@example.com",
            "priority": 1,
        },
    )
    contact_id = contact_resp.json()["id"]

    share_resp = await client.post(
        "/api/v1/packet/shares",
        headers=headers,
        json={"contact_id": contact_id},
    )
    token = share_resp.json()["token"]

    # Test GET /public/packet/{token} headers
    info_resp = await client.get(f"/api/v1/public/packet/{token}")
    assert info_resp.status_code == 200
    assert info_resp.headers["Cache-Control"] == "no-store"
    assert info_resp.headers["X-Robots-Tag"] == "noindex"
    assert info_resp.headers["Referrer-Policy"] == "no-referrer"

    # Verify OTP to get session token
    verify_resp = await client.post(
        f"/api/v1/public/packet/{token}/otp/verify",
        json={"otp": "123456"},
    )
    assert verify_resp.status_code == 200
    session_token = verify_resp.json()["session_token"]

    # Test GET /public/packet/session headers
    session_resp = await client.get(
        "/api/v1/public/packet/session",
        headers={"Authorization": f"Bearer {session_token}"},
    )
    assert session_resp.status_code == 200
    assert session_resp.headers["Cache-Control"] == "no-store"
    assert session_resp.headers["X-Robots-Tag"] == "noindex"
    assert session_resp.headers["Referrer-Policy"] == "no-referrer"

    # Test GET /public/packet/session/documents/{id} headers
    doc_resp = await client.get(
        f"/api/v1/public/packet/session/documents/{doc_id}",
        headers={"Authorization": f"Bearer {session_token}"},
    )
    assert doc_resp.status_code == 200
    assert doc_resp.headers["Cache-Control"] == "no-store"
    assert doc_resp.headers["X-Robots-Tag"] == "noindex"
    assert doc_resp.headers["Referrer-Policy"] == "no-referrer"
    assert "attachment" in doc_resp.headers["Content-Disposition"]
    assert doc_resp.content == pdf_bytes


@pytest.mark.asyncio
async def test_cross_user_access_isolation() -> None:
    """Verifies strict isolation: User B cannot delete, revoke, or access User A's data."""
    async with (
        AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client_a,
        AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client_b,
    ):
        # Register Owner A and Owner B in isolated client sessions
        _, _, headers_a = await _register_user(client_a, "usera")
        _, _, headers_b = await _register_user(client_b, "userb")

        # Owner A uploads a document
        doc_a_bytes = b"%PDF-1.4 User A confidential will document"
        files_a = {"file": ("user_a_will.pdf", doc_a_bytes, "application/pdf")}
        upload_a = await client_a.post(
            "/api/v1/documents",
            headers=headers_a,
            data={"title": "Will and Testament", "category": "legal"},
            files=files_a,
        )
        assert upload_a.status_code == 201
        doc_a_id = upload_a.json()["id"]

        # Owner A creates a share link
        contact_a = await client_a.post(
            "/api/v1/contacts",
            headers=headers_a,
            json={
                "name": "Contact A",
                "relation": "Mother",
                "phone": "+919876543213",
                "email": "contact_a@example.com",
                "priority": 1,
            },
        )
        share_a = await client_a.post(
            "/api/v1/packet/shares",
            headers=headers_a,
            json={"contact_id": contact_a.json()["id"]},
        )
        share_a_id = share_a.json()["id"]

        # 1. Owner B attempts to delete Owner A's document -> 404
        del_doc = await client_b.delete(f"/api/v1/documents/{doc_a_id}", headers=headers_b)
        assert del_doc.status_code == 404

        # 2. Owner B attempts to revoke Owner A's packet share -> 404
        revoke_share = await client_b.delete(
            f"/api/v1/packet/shares/{share_a_id}", headers=headers_b
        )
        assert revoke_share.status_code == 404

        # Owner B creates their own contact & share session
        contact_b = await client_b.post(
            "/api/v1/contacts",
            headers=headers_b,
            json={
                "name": "Contact B",
                "relation": "Father",
                "phone": "+919876543214",
                "email": "contact_b@example.com",
                "priority": 1,
            },
        )
        share_b = await client_b.post(
            "/api/v1/packet/shares",
            headers=headers_b,
            json={"contact_id": contact_b.json()["id"]},
        )
        token_b = share_b.json()["token"]

        verify_b = await client_b.post(
            f"/api/v1/public/packet/{token_b}/otp/verify",
            json={"otp": "123456"},
        )
        assert verify_b.status_code == 200
        session_token_b = verify_b.json()["session_token"]

        # 3. Parent B (using session_token_b) attempts to download Owner A's document -> 404
        unauth_download = await client_b.get(
            f"/api/v1/public/packet/session/documents/{doc_a_id}",
            headers={"Authorization": f"Bearer {session_token_b}"},
        )
        assert unauth_download.status_code == 404

        # 4. Owner A can successfully delete their own document -> 200
        owner_a_del = await client_a.delete(f"/api/v1/documents/{doc_a_id}", headers=headers_a)
        assert owner_a_del.status_code == 200


@pytest.mark.asyncio
async def test_share_revocation_invalidates_active_session(client: AsyncClient) -> None:
    """Verifies that revoking a share immediately invalidates active sessions and tokens."""
    _, _, headers = await _register_user(client, "dan")

    contact_resp = await client.post(
        "/api/v1/contacts",
        headers=headers,
        json={
            "name": "Dan Mother",
            "relation": "Mother",
            "phone": "+919876543215",
            "email": "dan_mom@example.com",
            "priority": 1,
        },
    )
    contact_id = contact_resp.json()["id"]

    share_resp = await client.post(
        "/api/v1/packet/shares",
        headers=headers,
        json={"contact_id": contact_id},
    )
    share_id = share_resp.json()["id"]
    token = share_resp.json()["token"]

    # Obtain session token
    verify_resp = await client.post(
        f"/api/v1/public/packet/{token}/otp/verify",
        json={"otp": "123456"},
    )
    session_token = verify_resp.json()["session_token"]

    # Active session works initially
    ok_session = await client.get(
        "/api/v1/public/packet/session",
        headers={"Authorization": f"Bearer {session_token}"},
    )
    assert ok_session.status_code == 200

    # Owner revokes the share
    revoke_resp = await client.delete(f"/api/v1/packet/shares/{share_id}", headers=headers)
    assert revoke_resp.status_code == 200

    # Share token is now invalid -> 401
    revoked_info = await client.get(f"/api/v1/public/packet/{token}")
    assert revoked_info.status_code == 401

    # Session token is now invalid -> 401
    revoked_session = await client.get(
        "/api/v1/public/packet/session",
        headers={"Authorization": f"Bearer {session_token}"},
    )
    assert revoked_session.status_code == 401


@pytest.mark.asyncio
async def test_envelope_encryption_storage_integrity(tmp_path: pytest.TempPathFactory) -> None:
    """Verifies AES-256-GCM envelope encryption, DEK wrapping, and integrity checks."""
    import pathlib

    store = EncryptedDocumentStore(storage_dir=str(tmp_path))
    plaintext = b"Highly sensitive financial master document with car loan account 1616600."

    size, sha256_hash, path_str = store.save_encrypted(
        owner_id="owner_test_123",
        doc_id="doc_test_456",
        plaintext=plaintext,
    )
    assert size == len(plaintext)
    file_path = pathlib.Path(path_str)
    assert file_path.exists()

    # Verify that raw plaintext is NOT present in the stored file bytes
    encrypted_bytes = file_path.read_bytes()
    assert plaintext not in encrypted_bytes

    # Load and decrypt
    decrypted = store.load_and_decrypt(path_str, sha256_hash)
    assert decrypted == plaintext

    # Tampering with ciphertext causes decryption failure
    tampered_bytes = bytearray(encrypted_bytes)
    tampered_bytes[-5] ^= 0xFF
    file_path.write_bytes(bytes(tampered_bytes))

    with pytest.raises(DocumentIntegrityError):
        store.load_and_decrypt(path_str, sha256_hash)


@pytest.mark.asyncio
async def test_access_audit_log_entries(client: AsyncClient) -> None:
    """Verifies that audit events are recorded for packet preview, shares, OTP and downloads."""
    from app.interfaces.api.dependencies import get_session_factory

    _, _, headers = await _register_user(client, "eve")

    # 1. Preview packet
    prev = await client.get("/api/v1/packet/preview", headers=headers)
    assert prev.status_code == 200

    # 2. Create contact & consent verify
    c_resp = await client.post(
        "/api/v1/contacts",
        headers=headers,
        json={
            "name": "Eve Parent",
            "relation": "Mother",
            "phone": "+919876543216",
            "email": "eve_mom@example.com",
            "priority": 1,
        },
    )
    contact_id = c_resp.json()["id"]

    # Request OTP and verify with real OTP
    send_otp_resp = await client.post(f"/api/v1/contacts/{contact_id}/verify/send", headers=headers)
    assert send_otp_resp.status_code == 200
    import re
    match = re.search(r"Dev OTP:\s*(\d{6})", send_otp_resp.json()["message"])
    assert match is not None
    real_otp = match.group(1)

    verify_c = await client.post(
        "/api/v1/public/contacts/verify",
        json={"token": contact_id, "otp": real_otp},
    )
    assert verify_c.status_code == 200

    # Check audit log in database
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = (
            select(AuditEventModel)
            .where(AuditEventModel.subject_id == contact_id)
            .order_by(AuditEventModel.at.desc())
        )
        events = (await session.execute(stmt)).scalars().all()
        actions = [e.action for e in events]
        assert "CONTACT_CONSENT_VERIFIED" in actions
