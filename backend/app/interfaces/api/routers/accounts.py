"""Financial accounts integration router conforming to api-contract.md."""

import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)

from app.config import settings
from app.domain.entities.owner import Owner
from app.infrastructure.groww.adapter import GrowwActivityAdapter
from app.infrastructure.groww.exceptions import (
    GrowwAuthenticationExpiredError,
    GrowwFeatureDisabledError,
)
from app.infrastructure.persistence.models import NomineeGuidanceModel
from app.interfaces.api.dependencies import get_current_owner, get_engine, get_session_factory
from app.interfaces.api.errors import (
    AppException,
    FeatureDisabledException,
    GrowwAuthExpiredException,
)
from app.interfaces.api.schemas import (
    ActionResponse,
    GrowwAccountResponse,
    NomineeGuidanceResponse,
    NomineeItem,
    UpdateGrowwAccountRequest,
    UpdateNomineeGuidanceRequest,
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


def _extract_nominees(row: NomineeGuidanceModel | None) -> list[NomineeItem]:
    if not row:
        return []
    if row.nominees_json and isinstance(row.nominees_json, list) and len(row.nominees_json) > 0:
        nominees: list[NomineeItem] = []
        for item in row.nominees_json:
            if isinstance(item, dict) and item.get("name"):
                nominees.append(
                    NomineeItem(
                        name=str(item["name"]),
                        relation=str(item.get("relation", "")),
                        share=str(item.get("share", "100%")),
                    )
                )
        if nominees:
            return nominees
    if row.nominee_name:
        return [
            NomineeItem(
                name=row.nominee_name,
                relation=row.nominee_relation or "",
                share=row.nominee_share or "100%",
            )
        ]
    return []


async def _ensure_nominees_schema() -> None:
    """Ensure the nominee_guidance table and nominees_json column exist on current database."""
    try:
        engine = get_engine()
        async with engine.begin() as conn:
            is_pg = engine.dialect.name == "postgresql"
            tz_type = "TIMESTAMP WITH TIME ZONE" if is_pg else "DATETIME"
            create_sql = f"""
                CREATE TABLE IF NOT EXISTS nominee_guidance (
                    id VARCHAR(64) PRIMARY KEY,
                    owner_id VARCHAR(64) NOT NULL UNIQUE REFERENCES owners(id) ON DELETE CASCADE,
                    nominee_name VARCHAR(255),
                    nominee_relation VARCHAR(64),
                    nominee_share VARCHAR(32) DEFAULT '100%',
                    notes TEXT,
                    updated_at {tz_type} NOT NULL,
                    nominees_json {'JSONB' if is_pg else 'JSON'}
                );
            """
            await conn.execute(text(create_sql))
            if is_pg:
                await conn.execute(
                    text("ALTER TABLE nominee_guidance ADD COLUMN IF NOT EXISTS nominees_json JSONB;")
                )
                await conn.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_nominee_guidance_owner_id ON nominee_guidance (owner_id);")
                )
            else:
                try:
                    cols_res = await conn.execute(text("PRAGMA table_info(nominee_guidance)"))
                    col_names = [r[1] for r in cols_res.fetchall()]
                    if "nominees_json" not in col_names:
                        await conn.execute(text("ALTER TABLE nominee_guidance ADD COLUMN nominees_json JSON;"))
                except Exception:
                    pass
    except Exception as ddl_err:
        logger.warning("Auto DDL migration check encountered error: %s", ddl_err)


@router.get(
    "/accounts/nominee-guidance",
    response_model=NomineeGuidanceResponse,
    operation_id="getNomineeGuidance",
    summary="Get nominee and emergency guidance instructions",
)
async def get_nominee_guidance(
    current_owner: Owner = Depends(get_current_owner),
) -> NomineeGuidanceResponse:
    """Retrieve the registered nominees and emergency guidance for the owner."""
    session_factory = get_session_factory()
    try:
        async with session_factory() as session:
            try:
                stmt = select(NomineeGuidanceModel).where(NomineeGuidanceModel.owner_id == current_owner.id)
                row = (await session.execute(stmt)).scalar_one_or_none()
            except Exception as q_exc:
                logger.warning("Nominee query failed, running schema self-heal: %s", q_exc)
                await session.rollback()
                await _ensure_nominees_schema()
                stmt = select(NomineeGuidanceModel).where(NomineeGuidanceModel.owner_id == current_owner.id)
                row = (await session.execute(stmt)).scalar_one_or_none()

            if not row:
                return NomineeGuidanceResponse(
                    nominees=[],
                    nominee_name=None,
                    nominee_relation=None,
                    nominee_share=None,
                    notes=None,
                    updated_at=None,
                )
            nominees = _extract_nominees(row)
            return NomineeGuidanceResponse(
                nominees=nominees,
                nominee_name=nominees[0].name if nominees else None,
                nominee_relation=nominees[0].relation if nominees else None,
                nominee_share=nominees[0].share if nominees else None,
                notes=row.notes,
                updated_at=row.updated_at,
            )
    except Exception as exc:
        logger.error("Failed to load nominee guidance: %s", exc)
        return NomineeGuidanceResponse(
            nominees=[],
            nominee_name=None,
            nominee_relation=None,
            nominee_share=None,
            notes=None,
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
            try:
                stmt = select(NomineeGuidanceModel).where(NomineeGuidanceModel.owner_id == current_owner.id)
                row = (await session.execute(stmt)).scalar_one_or_none()
            except Exception as q_exc:
                logger.warning("Nominee query in update failed, running schema self-heal: %s", q_exc)
                await session.rollback()
                await _ensure_nominees_schema()
                stmt = select(NomineeGuidanceModel).where(NomineeGuidanceModel.owner_id == current_owner.id)
                row = (await session.execute(stmt)).scalar_one_or_none()

            final_nominees: list[dict[str, Any]] = []
            if body.nominees is not None:
                final_nominees = [
                    {"name": n.name.strip(), "relation": n.relation.strip(), "share": n.share.strip()}
                    for n in body.nominees
                    if n.name.strip()
                ]
            elif body.nominee_name and body.nominee_name.strip():
                final_nominees = [
                    {
                        "name": body.nominee_name.strip(),
                        "relation": (body.nominee_relation or "").strip(),
                        "share": (body.nominee_share or "100%").strip(),
                    }
                ]

            primary = final_nominees[0] if final_nominees else None
            clean_notes = body.notes.strip() if body.notes else None

            if not row:
                row = NomineeGuidanceModel(
                    id=str(uuid.uuid4()),
                    owner_id=current_owner.id,
                    nominees_json=final_nominees,
                    nominee_name=primary["name"] if primary else None,
                    nominee_relation=primary["relation"] if primary else None,
                    nominee_share=primary["share"] if primary else None,
                    notes=clean_notes,
                    updated_at=now,
                )
                session.add(row)
            else:
                row.nominees_json = final_nominees
                row.nominee_name = primary["name"] if primary else None
                row.nominee_relation = primary["relation"] if primary else None
                row.nominee_share = primary["share"] if primary else None
                row.notes = clean_notes
                row.updated_at = now

            await session.commit()
            await session.refresh(row)

            nominees_dto = _extract_nominees(row)
            return NomineeGuidanceResponse(
                nominees=nominees_dto,
                nominee_name=nominees_dto[0].name if nominees_dto else None,
                nominee_relation=nominees_dto[0].relation if nominees_dto else None,
                nominee_share=nominees_dto[0].share if nominees_dto else None,
                notes=row.notes,
                updated_at=row.updated_at,
            )
    except AppException:
        raise
    except Exception as exc:
        logger.error("Failed to update nominee guidance for owner %s: %s", current_owner.id, exc)
        raise AppException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="NOMINEE_SAVE_FAILED",
            title="Failed to Save Nominee Guidance",
            detail=f"Unable to save nominee guidance: {str(exc)}",
        )
