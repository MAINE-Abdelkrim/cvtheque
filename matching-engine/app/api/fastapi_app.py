from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from app.config.ranking_config import DEFAULT_RANKING_CONFIG
from app.constants import MATCHING_VERSION
from app.exceptions import InvalidCVPayloadError, InvalidJobPayloadError, InvalidRankingRequestError, UnsupportedSchemaVersionError
from app.schemas.ranking_schema import CandidateRankingResult, RankingRequest
from app.services.candidate_ranking_service import CandidateRankingService
from app.services.matching_service import MatchingService

logger = logging.getLogger(__name__)
SINGLE_MATCH_MAX_REQUEST_BYTES = DEFAULT_RANKING_CONFIG.single_match_max_request_bytes
RANKING_MAX_REQUEST_BYTES = DEFAULT_RANKING_CONFIG.ranking_max_request_bytes


class MatchOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    include_explanation: bool = True


class MatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cv: dict[str, Any]
    job: dict[str, Any]
    options: MatchOptions = MatchOptions()


def error_response(status: int, code: str, message: str, details: list[Any] | None = None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, "details": details or []}})


def create_app(
    service: MatchingService | None = None,
    ranking_service: CandidateRankingService | None = None,
) -> FastAPI:
    matcher = service or MatchingService()
    ranker = ranking_service or CandidateRankingService(matching_service=matcher)
    app = FastAPI(title="Matching Engine", version=MATCHING_VERSION, docs_url="/docs")

    @app.middleware("http")
    async def enforce_request_size(request: Request, call_next):  # type: ignore[no-untyped-def]
        length = request.headers.get("content-length")
        limit = RANKING_MAX_REQUEST_BYTES if request.url.path == "/api/v1/rank-candidates" else SINGLE_MATCH_MAX_REQUEST_BYTES
        try:
            exceeds_limit = length is not None and int(length) > limit
        except ValueError:
            return error_response(400, "INVALID_CONTENT_LENGTH", "The Content-Length header is invalid.")
        if exceeds_limit:
            size = "20 MiB" if limit == RANKING_MAX_REQUEST_BYTES else "1 MiB"
            return error_response(413, "REQUEST_TOO_LARGE", f"The request exceeds the {size} limit.")
        return await call_next(request)

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(422, "INVALID_REQUEST", "The request payload is invalid.", exc.errors())

    @app.exception_handler(InvalidCVPayloadError)
    async def cv_error_handler(_: Request, exc: InvalidCVPayloadError) -> JSONResponse:
        details = exc.args[1] if len(exc.args) > 1 else []
        return error_response(422, exc.code, "The CV payload is invalid.", details)

    @app.exception_handler(InvalidJobPayloadError)
    async def job_error_handler(_: Request, exc: InvalidJobPayloadError) -> JSONResponse:
        details = exc.args[1] if len(exc.args) > 1 else []
        return error_response(422, exc.code, "The job payload is invalid.", details)

    @app.exception_handler(UnsupportedSchemaVersionError)
    async def version_error_handler(_: Request, exc: UnsupportedSchemaVersionError) -> JSONResponse:
        return error_response(400, exc.code, str(exc))

    @app.exception_handler(InvalidRankingRequestError)
    async def ranking_error_handler(_: Request, exc: InvalidRankingRequestError) -> JSONResponse:
        return error_response(422, exc.code, str(exc))

    @app.exception_handler(Exception)
    async def internal_error_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unexpected matching engine failure", exc_info=exc)
        return error_response(500, "INTERNAL_ERROR", "An unexpected internal error occurred.")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "matching-engine", "version": MATCHING_VERSION}

    @app.get("/version")
    def version() -> dict[str, str]:
        return {"service": "matching-engine", "version": MATCHING_VERSION, "api_version": "v1"}

    @app.post("/api/v1/match")
    def match(payload: MatchRequest):  # type: ignore[no-untyped-def]
        return matcher.match(payload.cv, payload.job, include_explanation=payload.options.include_explanation)

    @app.post(
        "/api/v1/rank-candidates",
        response_model=CandidateRankingResult,
        response_model_exclude_none=True,
    )
    def rank_candidates(payload: RankingRequest) -> CandidateRankingResult:
        return ranker.rank_candidates(
            job_data=payload.job,
            candidates=payload.candidates,
            top_k=payload.options.top_k,
            include_technical_details=payload.options.include_technical_details,
            invalid_candidate_policy=payload.options.invalid_candidate_policy,
        )

    return app


app = create_app()
