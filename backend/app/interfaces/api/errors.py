"""RFC 7807 problem details error models and exception handlers."""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.domain.errors import (
    ContactNotVerified,
    DomainError,
    InstallmentNotFound,
    InvalidDueDay,
    InvalidEmailAddress,
    InvalidMoney,
    InvalidPhoneNumber,
    InvalidThresholds,
    PauseTooLong,
)


class ValidationErrorItem(BaseModel):
    """Validation error for a specific field."""

    field: str
    message: str


class ProblemDetail(BaseModel):
    """RFC 7807 Problem Details representation."""

    type: str
    title: str
    status: int
    code: str
    detail: str
    errors: list[ValidationErrorItem] | None = None


class AppException(Exception):
    """Base application HTTP exception following problem details specification."""

    def __init__(
        self,
        status_code: int,
        code: str,
        title: str,
        detail: str,
        errors: list[ValidationErrorItem] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.title = title
        self.detail = detail
        self.errors = errors
        super().__init__(detail)

    def to_problem_detail(self) -> ProblemDetail:
        kebab_code = self.code.lower().replace("_", "-")
        return ProblemDetail(
            type=f"https://familysafetynet.app/errors/{kebab_code}",
            title=self.title,
            status=self.status_code,
            code=self.code,
            detail=self.detail,
            errors=self.errors,
        )


class BadRequestException(AppException):
    """Bad request error (400)."""

    def __init__(self, detail: str = "Invalid request parameters.") -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="BAD_REQUEST",
            title="Bad Request",
            detail=detail,
        )


class NotFoundException(AppException):
    """Resource not found error (404)."""

    def __init__(self, detail: str = "The requested resource was not found.") -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            title="Not Found",
            detail=detail,
        )


class UnauthorizedException(AppException):
    """Authentication required error (401)."""

    def __init__(self, detail: str = "Authentication credentials are required or invalid.") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="UNAUTHORIZED",
            title="Unauthorized",
            detail=detail,
        )


class ForbiddenException(AppException):
    """Action forbidden error (403)."""

    def __init__(self, detail: str = "You do not have permission to perform this action.") -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            title="Forbidden",
            detail=detail,
        )


class ConflictException(AppException):
    """Resource conflict error (409)."""

    def __init__(
        self,
        code: str = "CONFLICT",
        title: str = "Conflict",
        detail: str = "The request conflicts with current state.",
        errors: list[ValidationErrorItem] | None = None,
    ) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            code=code,
            title=title,
            detail=detail,
            errors=errors,
        )


class ValidationException(AppException):
    """Validation error (422)."""

    def __init__(
        self,
        detail: str = "Request failed validation.",
        errors: list[ValidationErrorItem] | None = None,
    ) -> None:
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="VALIDATION_ERROR",
            title="Validation Error",
            detail=detail,
            errors=errors,
        )


class CsrfException(AppException):
    """CSRF token mismatch error (403)."""

    def __init__(self, detail: str = "CSRF token validation failed.") -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            code="CSRF_VALIDATION_FAILED",
            title="CSRF Token Mismatch",
            detail=detail,
        )


class RateLimitException(AppException):
    """Too many requests error (429)."""

    def __init__(self, detail: str = "Rate limit exceeded. Please try again later.") -> None:
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code="RATE_LIMIT_EXCEEDED",
            title="Too Many Requests",
            detail=detail,
        )


class OtpLockedOutException(AppException):
    """Too many failed OTP attempts lockout (429)."""

    def __init__(
        self,
        detail: str = (
            "Too many failed OTP attempts. This access link is temporarily locked. "
            "Please try again in 15 minutes."
        ),
    ) -> None:
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code="OTP_LOCKED_OUT",
            title="OTP Lockout",
            detail=detail,
        )


class FeatureDisabledException(AppException):
    """Feature or integration adapter is disabled via feature flag (400)."""

    def __init__(
        self,
        detail: str = "The requested feature is currently disabled.",
    ) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="FEATURE_DISABLED",
            title="Feature Disabled",
            detail=detail,
        )


class GrowwAuthExpiredException(AppException):
    """Groww credentials or token expired (401)."""

    def __init__(
        self,
        detail: str = "Groww authentication has expired. Please re-authenticate.",
    ) -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="GROWW_AUTH_EXPIRED",
            title="Groww Authentication Expired",
            detail=detail,
        )


def register_error_handlers(app: FastAPI) -> None:
    """Register custom exception handlers with FastAPI application."""

    @app.exception_handler(AppException)
    async def app_exception_handler(_request: Request, exc: AppException) -> JSONResponse:
        problem = exc.to_problem_detail()
        return JSONResponse(
            status_code=exc.status_code,
            content=problem.model_dump(exclude_none=True),
            media_type="application/problem+json",
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors: list[ValidationErrorItem] = []
        for err in exc.errors():
            loc = err.get("loc", ())
            field_name = ".".join(str(elem) for elem in loc if elem != "body") or "body"
            errors.append(ValidationErrorItem(field=field_name, message=err.get("msg", "Invalid")))

        problem = ProblemDetail(
            type="https://familysafetynet.app/errors/validation-error",
            title="Validation Error",
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="VALIDATION_ERROR",
            detail="One or more fields in the request failed validation.",
            errors=errors,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=problem.model_dump(exclude_none=True),
            media_type="application/problem+json",
        )

    @app.exception_handler(DomainError)
    async def domain_error_handler(_request: Request, exc: DomainError) -> JSONResponse:
        status_code = status.HTTP_400_BAD_REQUEST
        code = "DOMAIN_ERROR"
        title = "Domain Error"

        if isinstance(exc, ContactNotVerified):
            status_code = status.HTTP_409_CONFLICT
            code = "CONTACT_NOT_VERIFIED"
            title = "Contact not verified"
        elif isinstance(exc, InstallmentNotFound):
            status_code = status.HTTP_404_NOT_FOUND
            code = "INSTALLMENT_NOT_FOUND"
            title = "Installment not found"
        elif isinstance(exc, PauseTooLong):
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
            code = "PAUSE_TOO_LONG"
            title = "Pause too long"
        elif isinstance(
            exc,
            InvalidMoney
            | InvalidPhoneNumber
            | InvalidEmailAddress
            | InvalidDueDay
            | InvalidThresholds,
        ):
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
            code = "INVALID_VALUE"
            title = "Invalid Value"

        kebab_code = code.lower().replace("_", "-")
        problem = ProblemDetail(
            type=f"https://familysafetynet.app/errors/{kebab_code}",
            title=title,
            status=status_code,
            code=code,
            detail=str(exc),
        )
        return JSONResponse(
            status_code=status_code,
            content=problem.model_dump(exclude_none=True),
            media_type="application/problem+json",
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code = "HTTP_ERROR"
        title = "HTTP Error"
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            code = "NOT_FOUND"
            title = "Not Found"
        elif exc.status_code == status.HTTP_401_UNAUTHORIZED:
            code = "UNAUTHORIZED"
            title = "Unauthorized"
        elif exc.status_code == status.HTTP_403_FORBIDDEN:
            code = "FORBIDDEN"
            title = "Forbidden"

        detail_text = str(exc.detail) if isinstance(exc.detail, str) else "An HTTP error occurred."
        kebab_code = code.lower().replace("_", "-")
        problem = ProblemDetail(
            type=f"https://familysafetynet.app/errors/{kebab_code}",
            title=title,
            status=exc.status_code,
            code=code,
            detail=detail_text,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=problem.model_dump(exclude_none=True),
            media_type="application/problem+json",
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(_request: Request, _exc: Exception) -> JSONResponse:
        # Don't leak internal details or stack traces
        problem = ProblemDetail(
            type="https://familysafetynet.app/errors/internal-server-error",
            title="Internal Server Error",
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INTERNAL_SERVER_ERROR",
            detail="An unexpected internal error occurred.",
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=problem.model_dump(exclude_none=True),
            media_type="application/problem+json",
        )
