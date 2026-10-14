"""FastAPI application entrypoint."""

import logging
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.infrastructure.security import redact_sensitive_data
from app.interfaces.api.errors import RateLimitException, register_error_handlers
from app.interfaces.api.routers import (
    accounts_router,
    auth_router,
    bank_accounts_router,
    contacts_router,
    documents_router,
    health_router,
    loans_router,
    monitor_router,
    mutual_funds_router,
    notifications_router,
    packet_router,
)
from app.interfaces.api.routers.health import HealthResponse
from app.interfaces.api.security import general_rate_limiter


def setup_logging() -> None:
    """Configure structured logging with redaction processor."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            redact_sensitive_data,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


setup_logging()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan context manager."""
    from app.infrastructure.persistence.models import Base
    from app.interfaces.api.dependencies import get_engine

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        from sqlalchemy import text

        is_postgres = engine.dialect.name == "postgresql"
        tz_type = "TIMESTAMP WITH TIME ZONE" if is_postgres else "DATETIME"

        # Ensure nominee_guidance table and index exist
        await conn.execute(
            text(
                f"""
                CREATE TABLE IF NOT EXISTS nominee_guidance (
                    id VARCHAR(64) PRIMARY KEY,
                    owner_id VARCHAR(64) NOT NULL UNIQUE REFERENCES owners(id) ON DELETE CASCADE,
                    nominee_name VARCHAR(255),
                    nominee_relation VARCHAR(64),
                    nominee_share VARCHAR(32) DEFAULT '100%',
                    notes TEXT,
                    updated_at {tz_type} NOT NULL,
                    nominees_json {'JSONB' if is_postgres else 'JSON'}
                );
                """
            )
        )
        if is_postgres:
            await conn.execute(
                text("ALTER TABLE nominee_guidance ADD COLUMN IF NOT EXISTS nominees_json JSONB;")
            )
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_nominee_guidance_owner_id ON nominee_guidance (owner_id);")
            )
        else:
            try:
                cols_res = await conn.execute(text("PRAGMA table_info(nominee_guidance)"))
                col_names = [row[1] for row in cols_res.fetchall()]
                if "nominees_json" not in col_names:
                    await conn.execute(text("ALTER TABLE nominee_guidance ADD COLUMN nominees_json JSON;"))
            except Exception as ex:
                logger.warning("Could not add nominees_json column to sqlite: %s", ex)

        # Ensure contact_otps table and index exist
        await conn.execute(
            text(
                f"""
                CREATE TABLE IF NOT EXISTS contact_otps (
                    id VARCHAR(64) PRIMARY KEY,
                    contact_id VARCHAR(64) NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
                    otp_hash VARCHAR(255) NOT NULL,
                    attempts INTEGER DEFAULT 0 NOT NULL,
                    expires_at {tz_type} NOT NULL,
                    created_at {tz_type} NOT NULL
                );
                """
            )
        )
        if is_postgres:
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_contact_otps_contact_id ON contact_otps (contact_id);")
            )
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Register RFC 7807 Problem Details error handlers
register_error_handlers(app)

# CORS configuration (supports local and Vercel deployments)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-CSRF-Token", "X-Access-Token", "X-Refresh-Token", "Authorization"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next: Any) -> Response:
    """Attach defensive security headers to all responses."""
    try:
        response: Response = await call_next(request)
    except Exception as exc:
        logger.exception(
            "Unhandled error processing %s %s: %s", request.method, request.url.path, exc
        )
        response = JSONResponse(
            status_code=500,
            content={
                "type": "https://familysafetynet.app/errors/internal-server-error",
                "title": "Internal Server Error",
                "status": 500,
                "code": "INTERNAL_SERVER_ERROR",
                "detail": "An unexpected internal error occurred.",
            },
            media_type="application/problem+json",
        )

    # Attach CORS headers if missing (e.g. on unhandled errors)
    origin = request.headers.get("origin")
    if origin and "access-control-allow-origin" not in response.headers:
        if (origin in settings.cors_origins) or (
            settings.cors_origin_regex and re.match(settings.cors_origin_regex, origin)
        ):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Expose-Headers"] = (
                "X-CSRF-Token, X-Access-Token, X-Refresh-Token, Authorization"
            )

    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"
    )
    if request.url.path in ("/docs", "/redoc", "/docs/oauth2-redirect"):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            "frame-ancestors 'none'"
        )
    else:
        response.headers.setdefault(
            "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"
        )
    response.headers.setdefault(
        "Permissions-Policy", "geolocation=(), camera=(), microphone=(), payment=()"
    )
    response.headers.setdefault("X-XSS-Protection", "1; mode=block")
    return response


@app.middleware("http")
async def edge_rate_limit_middleware(request: Request, call_next: Any) -> Response:
    """Apply edge rate limiting per client IP to non-health endpoints."""
    path = request.url.path
    if not (path == "/health" or path.endswith("/health") or path.endswith("/health/scheduler")):
        client_ip = request.client.host if request.client else "unknown"
        try:
            general_rate_limiter.check(client_ip)
        except RateLimitException as exc:
            problem = exc.to_problem_detail()
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content=problem.model_dump(exclude_none=True),
                media_type="application/problem+json",
            )
    return await call_next(request)  # type: ignore[no-any-return]


# Register API v1 Routers
app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(monitor_router, prefix=settings.api_v1_prefix)
app.include_router(contacts_router, prefix=settings.api_v1_prefix)
app.include_router(loans_router, prefix=settings.api_v1_prefix)
app.include_router(accounts_router, prefix=settings.api_v1_prefix)
app.include_router(bank_accounts_router, prefix=settings.api_v1_prefix)
app.include_router(mutual_funds_router, prefix=settings.api_v1_prefix)
app.include_router(documents_router, prefix=settings.api_v1_prefix)
app.include_router(packet_router, prefix=settings.api_v1_prefix)
app.include_router(notifications_router, prefix=settings.api_v1_prefix)
app.include_router(health_router, prefix=settings.api_v1_prefix)


# Root health check endpoint for load balancers and orchestrators
@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["health"],
    operation_id="getRootHealth",
    summary="Root health check",
)
async def root_health() -> HealthResponse:
    """Root health check endpoint."""
    return HealthResponse()
