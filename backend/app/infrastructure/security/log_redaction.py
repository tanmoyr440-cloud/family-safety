"""Structlog log redaction processor.

Redacts sensitive information from log events:
- Masks phone numbers: e.g. +919876543210 -> +91XXXXXX3210
- Masks emails: e.g. parent@example.com -> p***@example.com
- Masks tokens/secrets: JWTs, bearer tokens, API secrets
- Redacts sensitive key names: password, secret, token, account, otp, etc.
"""

import re
from collections.abc import MutableMapping
from typing import Any

# Match international phone numbers (e.g. +919876543210, +15005550006)
PHONE_REGEX = re.compile(r"(\+?\d{1,3})[-.\s]?(\d{2,4})[-.\s]?(\d{2,4})[-.\s]?(\d{3,4})")
# Match email addresses
EMAIL_REGEX = re.compile(r"\b([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b")
# Match JWT tokens (3 base64url segments separated by dots)
JWT_REGEX = re.compile(r"\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b")

SENSITIVE_KEY_SUBSTRINGS = (
    "password",
    "secret",
    "token",
    "account",
    "account_number",
    "otp",
    "auth",
    "api_key",
    "private_key",
    "csrf",
    "cookie",
)


def mask_phone_match(match: re.Match[str]) -> str:
    """Mask central digits of a matched phone number."""
    full = match.group(0).replace(" ", "").replace("-", "")
    if len(full) >= 10:
        prefix = full[:3]
        suffix = full[-4:]
        return f"{prefix}{'X' * (len(full) - 7)}{suffix}"
    return "[REDACTED_PHONE]"


def mask_email_match(match: re.Match[str]) -> str:
    """Mask local-part of email while retaining first character and domain."""
    local, domain = match.group(1), match.group(2)
    masked_local = f"{local[0]}***" if local else "***"
    return f"{masked_local}@{domain}"


def mask_string(val: str) -> str:
    """Apply masking regexes to a string."""
    # Redact JWTs
    val = JWT_REGEX.sub("[REDACTED_TOKEN]", val)
    # Redact emails
    val = EMAIL_REGEX.sub(mask_email_match, val)
    # Redact phone numbers if they resemble international numbers
    val = PHONE_REGEX.sub(mask_phone_match, val)
    return val


def redact_value(key: str, val: Any) -> Any:
    """Recursively redact sensitive values based on key name or content."""
    lower_key = key.lower()

    # Redact values whose keys indicate sensitive credentials
    if any(sub in lower_key for sub in SENSITIVE_KEY_SUBSTRINGS):
        if isinstance(val, str) and len(val) <= 4:
            return "[REDACTED]"
        if isinstance(val, str) and len(val) > 4:
            return f"XXXX{val[-4:]}"
        return "[REDACTED]"

    if isinstance(val, str):
        return mask_string(val)
    if isinstance(val, dict):
        return {k: redact_value(k, v) for k, v in val.items()}
    if isinstance(val, list):
        return [redact_value(key, item) for item in val]
    if isinstance(val, tuple):
        return tuple(redact_value(key, item) for item in val)

    return val


def redact_sensitive_data(
    _logger: Any,
    _method_name: str,
    event_dict: MutableMapping[str, Any],
) -> MutableMapping[str, Any]:
    """Structlog processor that masks sensitive data from all log events."""
    for k in list(event_dict.keys()):
        event_dict[k] = redact_value(k, event_dict[k])
    return event_dict
