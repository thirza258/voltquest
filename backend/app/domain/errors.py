"""Application failures; the HTTP adapter chooses status codes and headers."""


class ServiceError(Exception):
    """An application operation could not be completed."""


class InvalidInput(ServiceError):
    """Input violates a business rule."""


class InvalidOperation(ServiceError):
    """The resource's current state does not allow this operation."""


class AuthenticationFailed(ServiceError):
    """Credentials do not identify an existing player."""


class NotFound(ServiceError):
    """The requested resource is missing or inaccessible to the caller."""


class Conflict(ServiceError):
    """An operation conflicts with an existing resource."""


class AssistantUnavailable(ServiceError):
    """The tutor has not been configured."""


class AssistantUpstreamError(ServiceError):
    """The AI provider could not produce a usable response."""


class AssistantTimeout(ServiceError):
    """The provider exceeded the request deadline."""


class TooManyRequests(ServiceError):
    """The transient request budget is exhausted."""
