"""Security utilities: password hashing, JWTs, CSRF, TOTP MFA, and rate limiting."""

import hashlib
import hmac
import secrets
import struct
import time
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Request

from app.config import settings
from app.interfaces.api.errors import (
    CsrfException,
    RateLimitException,
    UnauthorizedException,
)

_hasher = PasswordHasher()
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 24 * 60  # 1 day (1440 minutes)
REFRESH_TOKEN_EXPIRE_DAYS = 7
CHECKIN_TOKEN_EXPIRE_DAYS = 7


def hash_password(password: str) -> str:
    """Hash password using Argon2id."""
    return _hasher.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against Argon2id hash."""
    try:
        return _hasher.verify(hashed_password, password)
    except VerifyMismatchError:
        return False


def hash_token(token: str) -> str:
    """Hash a token using SHA-256 for persistent database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure random urlsafe token."""
    return secrets.token_urlsafe(length)


def create_access_token(
    owner_id: str,
    csrf_token: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a short-lived access JWT token with owner_id and CSRF binding."""
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload: dict[str, Any] = {
        "sub": owner_id,
        "csrf": csrf_token,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate an access JWT token."""
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[JWT_ALGORITHM],
        )
        if payload.get("type") != "access":
            raise UnauthorizedException("Invalid token type.")
        return payload
    except jwt.ExpiredSignatureError as err:
        raise UnauthorizedException("Session token expired.") from err
    except jwt.PyJWTError as err:
        raise UnauthorizedException("Could not validate session token.") from err


def create_checkin_token(owner_id: str) -> str:
    """Create a signed, single-purpose magic link check-in token (7 days)."""
    now = datetime.now(UTC)
    expire = now + timedelta(days=CHECKIN_TOKEN_EXPIRE_DAYS)
    payload: dict[str, Any] = {
        "sub": owner_id,
        "purpose": "check-in",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=JWT_ALGORITHM)


def decode_checkin_token(token: str) -> str:
    """Decode and return owner_id from a magic check-in token."""
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[JWT_ALGORITHM],
        )
        if payload.get("purpose") != "check-in":
            raise UnauthorizedException("Invalid token purpose.")
        owner_id: str = payload["sub"]
        return owner_id
    except jwt.ExpiredSignatureError as err:
        raise UnauthorizedException("Magic link expired.") from err
    except jwt.PyJWTError as err:
        raise UnauthorizedException("Invalid magic link token.") from err


# --- Emergency Packet Tokens ---
def create_packet_share_token(share_id: str, expires_at: datetime) -> str:
    """Create a signed token identifying a PacketShare row."""
    payload: dict[str, Any] = {
        "share_id": share_id,
        "purpose": "packet_share",
        "exp": int(expires_at.timestamp()),
        "iat": int(datetime.now(UTC).timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=JWT_ALGORITHM)


def decode_packet_share_token(token: str) -> str:
    """Decode signed packet share token, returning share_id."""
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[JWT_ALGORITHM],
        )
        if payload.get("purpose") != "packet_share":
            raise UnauthorizedException("Invalid token purpose.")
        share_id: str = payload["share_id"]
        return share_id
    except jwt.ExpiredSignatureError as err:
        raise UnauthorizedException("Packet access link has expired.") from err
    except jwt.PyJWTError as err:
        raise UnauthorizedException("Invalid or tampered packet link.") from err


def create_packet_session_token(share_id: str, expires_at: datetime) -> str:
    """Create short-lived (30m) access session token for verified parent."""
    payload: dict[str, Any] = {
        "share_id": share_id,
        "purpose": "packet_session",
        "exp": int(expires_at.timestamp()),
        "iat": int(datetime.now(UTC).timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=JWT_ALGORITHM)


def decode_packet_session_token(token: str) -> str:
    """Decode verified parent packet session token, returning share_id."""
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[JWT_ALGORITHM],
        )
        if payload.get("purpose") != "packet_session":
            raise UnauthorizedException("Invalid session token purpose.")
        share_id: str = payload["share_id"]
        return share_id
    except jwt.ExpiredSignatureError as err:
        raise UnauthorizedException("Packet session has expired. Please verify OTP again.") from err
    except jwt.PyJWTError as err:
        raise UnauthorizedException("Invalid or tampered packet session token.") from err


# --- CSRF Validation ---
def generate_csrf_token() -> str:
    """Generate a cryptographically random CSRF token."""
    return secrets.token_hex(32)


def verify_csrf(request: Request, expected_csrf: str) -> None:
    """Verify that state-changing requests provide matching X-CSRF-Token."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return

    csrf_header = request.headers.get("X-CSRF-Token")
    if not csrf_header or not hmac.compare_digest(csrf_header, expected_csrf):
        raise CsrfException("Missing or invalid X-CSRF-Token header.")


# --- TOTP MFA (RFC 6238) ---
def generate_totp_secret() -> str:
    """Generate a base32 encoded random 160-bit TOTP secret."""
    import base64

    random_bytes = secrets.token_bytes(20)
    return base64.b32encode(random_bytes).decode("utf-8").replace("=", "")


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    """Verify a 6-digit TOTP code against a base32 secret with drift window."""
    import base64

    if not code.isdigit() or len(code) != 6:
        return False

    # Pad secret if necessary
    pad_len = (8 - len(secret) % 8) % 8
    secret_padded = secret + ("=" * pad_len)
    try:
        key = base64.b32decode(secret_padded, casefold=True)
    except Exception:
        return False

    current_interval = int(time.time() // 30)

    for offset in range(-window, window + 1):
        interval = current_interval + offset
        msg = struct.pack(">Q", interval)
        digest = hmac.new(key, msg, hashlib.sha1).digest()
        offset_idx = digest[-1] & 0x0F
        binary = (
            ((digest[offset_idx] & 0x7F) << 24)
            | ((digest[offset_idx + 1] & 0xFF) << 16)
            | ((digest[offset_idx + 2] & 0xFF) << 8)
            | (digest[offset_idx + 3] & 0xFF)
        )
        expected_code = f"{binary % 1_000_000:06d}"
        if hmac.compare_digest(expected_code, code):
            return True

    return False


# --- In-Memory Rate Limiting ---
class InMemoryRateLimiter:
    """Sliding-window in-memory rate limiter per key/IP."""

    def __init__(self, requests_per_minute: int = 20) -> None:
        self.requests_per_minute = requests_per_minute
        self.requests: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time.time()
        window_start = now - 60.0
        # Filter older timestamps
        valid_requests = [ts for ts in self.requests[key] if ts > window_start]
        if len(valid_requests) >= self.requests_per_minute:
            raise RateLimitException("Too many requests. Please wait a moment before retrying.")
        valid_requests.append(now)
        self.requests[key] = valid_requests


auth_rate_limiter = InMemoryRateLimiter(requests_per_minute=20)
otp_rate_limiter = InMemoryRateLimiter(requests_per_minute=30)
general_rate_limiter = InMemoryRateLimiter(requests_per_minute=300)
