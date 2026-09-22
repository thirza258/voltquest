"""Translate application failures to the existing API error contract."""

from fastapi import Request
from fastapi.responses import JSONResponse

from app.domain.errors import (
    AssistantUnavailable,
    AssistantUpstreamError,
    AssistantTimeout,
    TooManyRequests,
    AuthenticationFailed,
    Conflict,
    InvalidInput,
    InvalidOperation,
    NotFound,
    PermissionDenied,
    ServiceError,
)

STATUS_CODES = {
    AssistantUnavailable: 503,
    AssistantUpstreamError: 502,
    AssistantTimeout: 504,
    TooManyRequests: 429,
    InvalidOperation: 400,
    AuthenticationFailed: 401,
    PermissionDenied: 403,
    NotFound: 404,
    Conflict: 409,
    InvalidInput: 422,
}


async def service_error_response(_request: Request, exc: ServiceError) -> JSONResponse:
    return JSONResponse(
        status_code=STATUS_CODES.get(type(exc), 500),
        content={"detail": str(exc)},
    )
