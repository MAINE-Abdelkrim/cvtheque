import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.authentication import InterviewAuthenticationError
from app.api.deployment import RequestBodyLimitMiddleware
from app.api.routes import router
from app.config.settings import Settings, get_settings
from app.providers.errors import InterviewProviderError
from app.repositories.errors import (
    InterviewRepositoryError,
    RepositorySessionNotFoundError,
    SessionConflictError,
)
from app.services.errors import (
    AnswerAlreadySubmittedError,
    InterviewError,
    InvalidCursorError,
    SessionNotFoundError,
)


async def authentication_error_handler(
    request: Request, exc: InterviewAuthenticationError
) -> JSONResponse:
    del request
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": str(exc)}},
    )


async def repository_error_handler(
    request: Request, exc: InterviewRepositoryError
) -> JSONResponse:
    del request
    if isinstance(exc, RepositorySessionNotFoundError):
        status_code = status.HTTP_404_NOT_FOUND
        message = "Interview session was not found"
    elif isinstance(exc, SessionConflictError):
        status_code = status.HTTP_409_CONFLICT
        message = "The interview changed while this request was being processed. Reload and retry."
    else:
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        message = "Interview session storage is unavailable"
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": exc.code, "message": message}},
    )


async def interview_error_handler(request: Request, exc: InterviewError) -> JSONResponse:
    del request
    status_code = (
        status.HTTP_404_NOT_FOUND
        if isinstance(exc, SessionNotFoundError)
        else status.HTTP_409_CONFLICT
    )
    if isinstance(exc, AnswerAlreadySubmittedError):
        status_code = status.HTTP_409_CONFLICT
    elif isinstance(exc, InvalidCursorError):
        status_code = status.HTTP_400_BAD_REQUEST
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": exc.code, "message": str(exc)}},
    )


async def provider_error_handler(request: Request, exc: InterviewProviderError) -> JSONResponse:
    del request
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "error": {
                "code": exc.code,
                "message": "Interview provider is temporarily unavailable",
            }
        },
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    active_settings = settings or get_settings()
    logging.basicConfig(level=active_settings.log_level.upper())
    application = FastAPI(title=active_settings.app_name, version="0.1.0")
    application.add_middleware(
        RequestBodyLimitMiddleware,
        max_request_bytes=active_settings.interview_max_request_bytes,
    )
    allowed_hosts = active_settings.parsed_interview_allowed_hosts
    if allowed_hosts:
        application.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)
    application.include_router(router)
    application.add_exception_handler(
        InterviewAuthenticationError, authentication_error_handler  # type: ignore[arg-type]
    )
    application.add_exception_handler(
        InterviewRepositoryError, repository_error_handler  # type: ignore[arg-type]
    )
    application.add_exception_handler(
        InterviewError, interview_error_handler  # type: ignore[arg-type]
    )
    application.add_exception_handler(
        InterviewProviderError, provider_error_handler  # type: ignore[arg-type]
    )
    return application


app = create_app()
