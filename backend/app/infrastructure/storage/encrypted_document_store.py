"""Envelope-encrypted document storage implementation.

Uses AES-256-GCM envelope encryption:
- Master key derived from application secret key.
- Per-file ephemeral data encryption key (DEK).
- DEK encrypted with Master Key (KEK).
- Plaintext SHA-256 checksum recorded and verified upon decryption.
- Stored on filesystem as encrypted envelopes.
"""

import hashlib
import os
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings


class DocumentIntegrityError(Exception):
    """Raised when decrypted document SHA-256 checksum does not match expected hash."""


class EncryptedDocumentStore:
    """Envelope encryption storage for confidential documents."""

    def __init__(
        self,
        storage_dir: str | Path | None = None,
        master_secret: str | None = None,
    ) -> None:
        base_dir = storage_dir or Path(os.environ.get("DOCUMENT_STORAGE_DIR", "data/documents"))
        self._storage_dir = Path(base_dir).resolve()
        self._storage_dir.mkdir(parents=True, exist_ok=True)

        raw_secret = master_secret or settings.secret_key
        # Derive 32-byte master key via SHA-256
        self._master_key = hashlib.sha256(raw_secret.encode("utf-8")).digest()
        self._kek = AESGCM(self._master_key)

    def save_encrypted(
        self,
        owner_id: str,
        doc_id: str,
        plaintext: bytes,
    ) -> tuple[int, str, str]:
        """Encrypt plaintext using per-file DEK and store on disk.

        Returns (size_bytes, sha256_hash, storage_path).
        """
        size_bytes = len(plaintext)
        sha256_hash = hashlib.sha256(plaintext).hexdigest()

        # 1. Generate 32-byte ephemeral DEK
        dek = os.urandom(32)
        dek_cipher = AESGCM(dek)

        # 2. Encrypt plaintext with DEK
        file_nonce = os.urandom(12)
        ciphertext = dek_cipher.encrypt(file_nonce, plaintext, None)

        # 3. Wrap DEK with KEK (master key)
        wrap_nonce = os.urandom(12)
        wrapped_dek = self._kek.encrypt(wrap_nonce, dek, None)

        # 4. Pack payload:
        # [wrap_nonce: 12B] + [len(wrapped_dek): 2B] + [wrapped_dek]
        # + [file_nonce: 12B] + [ciphertext]
        wrapped_dek_len = len(wrapped_dek).to_bytes(2, byteorder="big")
        envelope = wrap_nonce + wrapped_dek_len + wrapped_dek + file_nonce + ciphertext

        owner_folder = self._storage_dir / owner_id
        owner_folder.mkdir(parents=True, exist_ok=True)
        file_path = owner_folder / f"{doc_id}.enc"

        with open(file_path, "wb") as f:
            f.write(envelope)

        return size_bytes, sha256_hash, str(file_path)

    def read_decrypted(
        self,
        storage_path: str | Path,
        expected_sha256: str,
    ) -> bytes:
        """Read envelope from disk, unwrap DEK, decrypt, and verify SHA-256."""
        path = Path(storage_path)
        if not path.is_file():
            raise FileNotFoundError(f"Document file not found at {storage_path}")

        with open(path, "rb") as f:
            data = f.read()

        # Unpack envelope
        wrap_nonce = data[:12]
        wrapped_len = int.from_bytes(data[12:14], byteorder="big")
        offset = 14 + wrapped_len
        wrapped_dek = data[14:offset]
        file_nonce = data[offset : offset + 12]
        ciphertext = data[offset + 12 :]

        try:
            # 1. Unwrap DEK with KEK
            dek = self._kek.decrypt(wrap_nonce, wrapped_dek, None)
            dek_cipher = AESGCM(dek)

            # 2. Decrypt ciphertext with DEK
            plaintext = dek_cipher.decrypt(file_nonce, ciphertext, None)
        except Exception as err:
            raise DocumentIntegrityError(f"Decryption failed or data tampered: {err}") from err

        # 3. Verify integrity
        computed_hash = hashlib.sha256(plaintext).hexdigest()
        if computed_hash != expected_sha256:
            raise DocumentIntegrityError(
                f"Integrity check failed: expected {expected_sha256}, got {computed_hash}"
            )

        return plaintext

    def delete_file(self, storage_path: str | Path) -> bool:
        """Remove encrypted file from disk."""
        path = Path(storage_path)
        if path.is_file():
            path.unlink()
            return True
        return False

    # Alias for convenience
    load_and_decrypt = read_decrypted
