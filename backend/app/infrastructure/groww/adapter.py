"""Groww Trade API Activity Signal Adapter.

Documentation Reference:
    https://groww.in/trade-api/docs/python-sdk

This adapter implements the ActivitySignalSource port to monitor user
activity (trades/orders) and retrieve updated holdings snapshots.
It runs behind the GROWW_ADAPTER_ENABLED feature flag and gracefully handles
session/token expiration by falling back to manual check-in signals.
"""

from datetime import UTC, datetime
from typing import Any

import structlog
from growwapi import GrowwAPI
from growwapi.groww.exceptions import (
    GrowwAPIAuthenticationException,
    GrowwAPIAuthorisationException,
    GrowwAPIException,
)

from app.application.ports.activity_signal_source import ActivitySignalSource
from app.config import Settings
from app.config import settings as default_settings
from app.infrastructure.groww.exceptions import (
    GrowwAuthenticationExpiredError,
    GrowwFeatureDisabledError,
)

logger = structlog.get_logger(__name__)


def _parse_timestamp(raw_val: Any) -> datetime | None:
    """Parse various timestamp formats into timezone-aware UTC datetime."""
    if not raw_val:
        return None

    if isinstance(raw_val, (int, float)):
        # Handle millisecond vs second timestamps
        seconds = raw_val / 1000.0 if raw_val > 1e11 else float(raw_val)
        return datetime.fromtimestamp(seconds, tz=UTC)

    if isinstance(raw_val, str):
        cleaned = raw_val.strip()
        if not cleaned:
            return None
        # Handle ISO format strings like "2026-10-10T09:30:00Z"
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(cleaned)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            return dt.astimezone(UTC)
        except ValueError:
            return None

    return None


class GrowwActivityAdapter(ActivitySignalSource):
    """Adapter bridging Groww Trade API to the ActivitySignalSource port.

    Only methods verified in the official Python SDK documentation are called:
    - GrowwAPI.get_access_token
    - GrowwAPI.get_order_list
    - GrowwAPI.get_holdings_for_user
    """

    def __init__(
        self,
        config: Settings | None = None,
        client: GrowwAPI | None = None,
    ) -> None:
        self._config = config or default_settings
        self._client = client

    @property
    def is_enabled(self) -> bool:
        """Return True if Groww adapter is enabled via feature flag."""
        return bool(self._config.groww_adapter_enabled)

    def _get_client(self) -> GrowwAPI | None:
        """Resolve or authenticate GrowwAPI client instance."""
        if self._client is not None:
            return self._client

        api_key = self._config.groww_api_key
        if not api_key:
            return None

        secret = self._config.groww_api_secret
        totp = self._config.groww_api_totp
        token = GrowwAPI.get_access_token(
            api_key=api_key,
            secret=secret,
            totp=totp,
        )
        self._client = GrowwAPI(token=token)
        return self._client

    async def fetch_latest_activity(self, owner_id: str) -> datetime | None:
        """Fetch latest activity timestamp from Groww trade orders.

        Falls back to None (allowing check-in monitoring to proceed)
        if feature flag is disabled, credentials expired, or service unavailable.
        """
        if not self.is_enabled:
            logger.debug(
                "Groww adapter disabled; falling back to check-in monitoring",
                owner_id=owner_id,
            )
            return None

        try:
            client = self._get_client()
            if client is None:
                logger.warning(
                    "Groww credentials missing; falling back to check-in monitoring",
                    owner_id=owner_id,
                )
                return None

            # get_order_list is verified in official SDK docs
            orders_response = client.get_order_list(page=0, page_size=25)
            return self._extract_latest_order_time(orders_response)

        except (GrowwAPIAuthenticationException, GrowwAPIAuthorisationException) as exc:
            logger.warning(
                "Groww authentication expired or unauthorized; falling back to check-in signals",
                owner_id=owner_id,
                error_type=type(exc).__name__,
            )
            return None
        except (GrowwAPIException, Exception) as exc:
            logger.warning(
                "Groww activity signal check failed; falling back to check-in signals",
                owner_id=owner_id,
                error=str(exc),
            )
            return None

    async def refresh_holdings(self, owner_id: str) -> dict[str, Any]:
        """Fetch updated portfolio holdings snapshot using get_holdings_for_user.

        Raises GrowwFeatureDisabledError if feature flag is off,
        or GrowwAuthenticationExpiredError if session/token is invalid.
        """
        if not self.is_enabled:
            raise GrowwFeatureDisabledError(
                "Groww integration adapter is disabled by feature flag."
            )

        try:
            client = self._get_client()
            if client is None:
                raise GrowwAuthenticationExpiredError(
                    "Groww API credentials are not configured or token expired."
                )

            # get_holdings_for_user is verified in official SDK docs
            holdings_response = client.get_holdings_for_user(timeout=10)
            return self._normalize_holdings(holdings_response)

        except (GrowwAPIAuthenticationException, GrowwAPIAuthorisationException) as exc:
            logger.warning(
                "Groww authentication expired during holdings refresh",
                owner_id=owner_id,
                error_type=type(exc).__name__,
            )
            raise GrowwAuthenticationExpiredError(
                "Groww authentication has expired. Please re-authenticate."
            ) from exc
        except GrowwFeatureDisabledError:
            raise
        except Exception as exc:
            logger.error(
                "Groww holdings refresh failed",
                owner_id=owner_id,
                error=str(exc),
            )
            raise

    def _extract_latest_order_time(self, response: Any) -> datetime | None:
        """Extract the most recent order timestamp from get_order_list response."""
        if not response:
            return None

        order_items: list[dict[str, Any]] = []
        if isinstance(response, dict):
            # Check common keys: 'order_list', 'orders', or 'payload'
            items = (
                response.get("order_list") or response.get("orders") or response.get("payload", [])
            )
            if isinstance(items, list):
                order_items = [i for i in items if isinstance(i, dict)]
        elif isinstance(response, list):
            order_items = [i for i in response if isinstance(i, dict)]

        latest: datetime | None = None
        for order in order_items:
            # Check timestamps in order payload
            raw_time = (
                order.get("created_at")
                or order.get("exchange_time")
                or order.get("order_date_time")
                or order.get("order_timestamp")
            )
            ts = _parse_timestamp(raw_time)
            if ts is not None and (latest is None or ts > latest):
                latest = ts

        return latest

    def _normalize_holdings(self, response: Any) -> dict[str, Any]:
        """Normalize get_holdings_for_user response into a clean dictionary."""
        items: list[dict[str, Any]] = []
        if isinstance(response, dict):
            raw = (
                response.get("user_holdings")
                or response.get("holdings")
                or response.get("payload", [])
            )
            if isinstance(raw, list):
                items = [i for i in raw if isinstance(i, dict)]
        elif isinstance(response, list):
            items = [i for i in response if isinstance(i, dict)]

        return {
            "holdings": items,
            "holdings_count": len(items),
            "refreshed_at": datetime.now(UTC).isoformat(),
        }
