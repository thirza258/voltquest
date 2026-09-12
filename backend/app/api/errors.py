"""Translate application failures to the existing API error contract."""

from fastapi import Request
from fastapi.responses import JSONResponse

from app.domain.errors import (
    AuthenticationFailed,
    Conflict,
    InvalidInput,
    InvalidOperation,
    NotFound,
    ServiceError,
)

STATUS_CODES = {
    InvalidOperation: 400,
    AuthenticationFailed: 401,
    NotFound: 404,
    Conflict: 409,
    InvalidInput: 422,
}


async def service_error_response(_request: Request, exc: ServiceError) -> JSONResponse:
    return JSONResponse(
        status_code=STATUS_CODES.get(type(exc), 500),
        content={"detail": str(exc)},
    )
