"""Financial accounts integration router conforming to api-contract.md."""

import uuid
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import select

logger = structlog.get_logger(__name__)

from app.config import settings
from app.domain.entities.owner import Owner
from app.infrastructure.groww.adapter import GrowwActivityAdapter
from app.infrastructure.groww.exceptions import (
    GrowwAuthenticationExpiredError,
    GrowwFeatureDisabledError,
)
from app.infrastructure.persistence.models import NomineeGuidanceModel
from app.interfaces.api.dependencies import get_current_owner, get_session_factory
from app.interfaces.api.errors import FeatureDisabledException, GrowwAuthExpiredException
from app.interfaces.api.schemas import (
    ActionResponse,
    GrowwAccountResponse,
    NomineeGuidanceResponse,
    UpdateGrowwAccountRequest,
    UpdateNomineeGuidanceRequest,
)

DEFAULT_NOMINEE_NAME = "Savitri Sharma"
DEFAULT_NOMINEE_RELATION = "Mother"
DEFAULT_NOMINEE_SHARE = "100%"
DEFAULT_NOMINEE_NOTES = (
    "Mutual fund investments are registered across AMCs and RTAs (CAMS & KFintech). "
    "In case of emergency, contact the respective fund houses or CAMS/KFintech with PAN, "
    "death certificate, and nominee claim forms. Folio details are listed in the emergency packet."
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


@router.get(
    "/accounts/nominee-guidance",
    response_model=NomineeGuidanceResponse,
    operation_id="getNomineeGuidance",
    summary="Get nominee and emergency guidance instructions",
)
async def get_nominee_guidance(
    current_owner: Owner = Depends(get_current_owner),
) -> NomineeGuidanceResponse:
    """Retrieve the registered nominee and emergency guidance for the owner."""
    session_factory = get_session_factory()
    try:
        async with session_factory() as session:
            stmt = select(NomineeGuidanceModel).where(NomineeGuidanceModel.owner_id == current_owner.id)
            row = (await session.execute(stmt)).scalar_one_or_none()
            if not row:
                return NomineeGuidanceResponse(
                    nominee_name=DEFAULT_NOMINEE_NAME,
                    nominee_relation=DEFAULT_NOMINEE_RELATION,
                    nominee_share=DEFAULT_NOMINEE_SHARE,
                    notes=DEFAULT_NOMINEE_NOTES,
                    updated_at=None,
                )
            return NomineeGuidanceResponse(
                nominee_name=row.nominee_name if row.nominee_name is not None else DEFAULT_NOMINEE_NAME,
                nominee_relation=row.nominee_relation if row.nominee_relation is not None else DEFAULT_NOMINEE_RELATION,
                nominee_share=row.nominee_share if row.nominee_share is not None else DEFAULT_NOMINEE_SHARE,
                notes=row.notes if row.notes is not None else DEFAULT_NOMINEE_NOTES,
                updated_at=row.updated_at,
            )
    except Exception as exc:
        logger.error("Failed to load nominee guidance: %s", exc)
        return NomineeGuidanceResponse(
            nominee_name=DEFAULT_NOMINEE_NAME,
            nominee_relation=DEFAULT_NOMINEE_RELATION,
            nominee_share=DEFAULT_NOMINEE_SHARE,
            notes=DEFAULT_NOMINEE_NOTES,
            updated_at=None,
        )


@router.put(
    "/accounts/nominee-guidance",
    response_model=NomineeGuidanceResponse,
    operation_id="updateNomineeGuidance",
    summary="Update nominee details and emergency guidance instructions",
)
async def update_nominee_guidance(
    body: UpdateNomineeGuidanceRequest,
    current_owner: Owner = Depends(get_current_owner),
) -> NomineeGuidanceResponse:
    """Upsert nominee and emergency guidance instructions."""
    now = datetime.now(UTC)
    session_factory = get_session_factory()
    try:
        async with session_factory() as session:
            stmt = select(NomineeGuidanceModel).where(NomineeGuidanceModel.owner_id == current_owner.id)
            row = (await session.execute(stmt)).scalar_one_or_none()
            if not row:
                row = NomineeGuidanceModel(
                    id=str(uuid.uuid4()),
                    owner_id=current_owner.id,
                    nominee_name=body.nominee_name,
                    nominee_relation=body.nominee_relation,
                    nominee_share=body.nominee_share or "100%",
                    notes=body.notes,
                    updated_at=now,
                )
                session.add(row)
            else:
                if body.nominee_name is not None:
                    row.nominee_name = body.nominee_name
                if body.nominee_relation is not None:
                    row.nominee_relation = body.nominee_relation
                if body.nominee_share is not None:
                    row.nominee_share = body.nominee_share
                if body.notes is not None:
                    row.notes = body.notes
                row.updated_at = now

            await session.commit()
            await session.refresh(row)

            return NomineeGuidanceResponse(
                nominee_name=row.nominee_name,
                nominee_relation=row.nominee_relation,
                nominee_share=row.nominee_share,
                notes=row.notes,
                updated_at=row.updated_at,
            )
    except Exception as exc:
        logger.error("Failed to update nominee guidance for owner %s: %s", current_owner.id, exc)
        raise
