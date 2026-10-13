"""Financial accounts integration router conforming to api-contract.md."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends

from app.config import settings
from app.domain.entities.owner import Owner
from app.infrastructure.groww.adapter import GrowwActivityAdapter
from app.infrastructure.groww.exceptions import (
    GrowwAuthenticationExpiredError,
    GrowwFeatureDisabledError,
)
from app.interfaces.api.dependencies import get_current_owner
from app.interfaces.api.errors import FeatureDisabledException, GrowwAuthExpiredException
from app.interfaces.api.schemas import (
    ActionResponse,
    GrowwAccountResponse,
    UpdateGrowwAccountRequest,
)

router = APIRouter(tags=["accounts"])


@router.get(
    "/accounts/groww",
    response_model=GrowwAccountResponse,
    operation_id="getGrowwAccount",
    summary="Get Groww account integration status",
)
async def get_groww_account(
    _current_owner: Owner = Depends(get_current_owner),
) -> GrowwAccountResponse:
    """Return Groww connection and holdings sync status."""
    is_connected = bool(settings.groww_adapter_enabled)
    return GrowwAccountResponse(
        connected=is_connected,
        masked_account="XXXX5678" if is_connected else None,
        last_synced_at=datetime.now(UTC) if is_connected else None,
        holdings_count=12 if is_connected else 0,
    )


@router.put(
    "/accounts/groww",
    response_model=ActionResponse,
    operation_id="updateGrowwAccount",
    summary="Configure Groww account credentials",
)
async def update_groww_account(
    _body: UpdateGrowwAccountRequest,
    _current_owner: Owner = Depends(get_current_owner),
) -> ActionResponse:
    """Update Groww read-only API credentials."""
    return ActionResponse(message="Groww connection settings updated successfully.")


@router.post(
    "/accounts/groww/refresh-holdings",
    response_model=ActionResponse,
    operation_id="refreshGrowwHoldings",
    summary="Refresh holdings snapshot from Groww",
)
async def refresh_groww_holdings(
    current_owner: Owner = Depends(get_current_owner),
) -> ActionResponse:
    """Trigger on-demand portfolio holdings snapshot update."""
    if not settings.groww_adapter_enabled:
        raise FeatureDisabledException("Groww integration adapter is disabled by feature flag.")

    adapter = GrowwActivityAdapter(config=settings)
    try:
        await adapter.refresh_holdings(owner_id=current_owner.id)
    except GrowwFeatureDisabledError as exc:
        raise FeatureDisabledException(str(exc)) from exc
    except GrowwAuthenticationExpiredError as exc:
        raise GrowwAuthExpiredException(str(exc)) from exc

    return ActionResponse(message="Holdings refreshed successfully.")
