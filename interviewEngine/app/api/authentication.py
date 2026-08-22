from dataclasses import dataclass
from secrets import compare_digest
from typing import Annotated

from fastapi import Depends, Request, status

from app.config.settings import Settings, get_settings

MAX_OWNER_ID_LENGTH = 128


@dataclass(frozen=True, slots=True)
class InterviewPrincipal:
    """Opaque ownership context established by a trusted backend call."""

    owner_id: str


class InterviewAuthenticationError(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def _internal_tokens_match(supplied: str, expected: str) -> bool:
    """Compare one token pair without content-dependent early exit."""

    return compare_digest(supplied.encode("utf-8"), expected.encode("utf-8"))


def internal_token_is_valid(
    supplied_token: str,
    current_token: str,
    previous_token: str | None = None,
) -> bool:
    """Accept the current token or the one optional token retained during rotation."""

    current_matches = _internal_tokens_match(supplied_token, current_token)
    previous_matches = (
        _internal_tokens_match(supplied_token, previous_token)
        if previous_token is not None
        else False
    )
    return current_matches or previous_matches


def get_interview_principal(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> InterviewPrincipal | None:
    """Authenticate the backend caller and establish opaque owner context when enabled."""

    if not settings.interview_internal_auth_enabled:
        return None

    authorization = request.headers.get("Authorization")
    if authorization is None:
        raise InterviewAuthenticationError(
            "AUTH_REQUIRED",
            "Internal service authentication is required",
            status.HTTP_401_UNAUTHORIZED,
        )

    scheme, separator, supplied_token = authorization.partition(" ")
    if (
        not separator
        or scheme.lower() != "bearer"
        or not supplied_token
        or supplied_token != supplied_token.strip()
        or any(character.isspace() for character in supplied_token)
    ):
        raise InterviewAuthenticationError(
            "AUTH_INVALID",
            "Internal service authentication is invalid",
            status.HTTP_401_UNAUTHORIZED,
        )

    current = settings.interview_internal_api_token
    previous = settings.interview_internal_api_token_previous
    if current is None or not internal_token_is_valid(
        supplied_token,
        current.get_secret_value(),
        previous.get_secret_value() if previous is not None else None,
    ):
        raise InterviewAuthenticationError(
            "AUTH_INVALID",
            "Internal service authentication is invalid",
            status.HTTP_401_UNAUTHORIZED,
        )

    owner_id = request.headers.get(settings.interview_owner_header)
    normalized_owner = owner_id.strip() if owner_id is not None else ""
    if not normalized_owner or len(normalized_owner) > MAX_OWNER_ID_LENGTH:
        raise InterviewAuthenticationError(
            "OWNER_CONTEXT_REQUIRED",
            "A valid interview owner context is required",
            status.HTTP_400_BAD_REQUEST,
        )
    return InterviewPrincipal(owner_id=normalized_owner)


def get_required_interview_principal(
    principal: Annotated[InterviewPrincipal | None, Depends(get_interview_principal)],
) -> InterviewPrincipal:
    """Require trusted owner context for operations with no safe global fallback."""

    if principal is None:
        raise InterviewAuthenticationError(
            "OWNER_CONTEXT_REQUIRED",
            "A valid interview owner context is required",
            status.HTTP_400_BAD_REQUEST,
        )
    return principal
