from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from time import perf_counter
from typing import Any, Literal

from pydantic import ValidationError

from app.config.ranking_config import DEFAULT_RANKING_CONFIG, RankingConfig
from app.constants import CV_SCHEMA_VERSION, JOB_SCHEMA_VERSION, MATCHING_VERSION
from app.exceptions import (
    InvalidCVPayloadError,
    InvalidJobPayloadError,
    InvalidRankingRequestError,
    UnsupportedSchemaVersionError,
)
from app.schemas.cv_schema import CVProfile
from app.schemas.job_schema import JobProfile
from app.schemas.match_schema import MatchResult
from app.schemas.ranking_schema import (
    CandidateRankingResult,
    DuplicateCandidateRecord,
    InvalidCandidateRecord,
    RankingMetadata,
)
from app.services.matching_service import MatchingService
from app.services.recruiter_result_formatter import RecruiterResultFormatter


@dataclass(frozen=True)
class _EvaluatedCandidate:
    index: int
    cv: CVProfile
    result: MatchResult


class CandidateRankingService:
    """Evaluate all valid CVs with MatchingService and return a deterministic Top K."""

    def __init__(
        self,
        matching_service: MatchingService | None = None,
        formatter: RecruiterResultFormatter | None = None,
        config: RankingConfig = DEFAULT_RANKING_CONFIG,
    ) -> None:
        self.matching_service = matching_service or MatchingService()
        self.formatter = formatter or RecruiterResultFormatter()
        self.config = config

    def rank_candidates(
        self,
        job_data: dict[str, Any] | JobProfile,
        candidates: list[dict[str, Any] | CVProfile],
        top_k: int = 3,
        include_technical_details: bool = False,
        invalid_candidate_policy: Literal["skip", "fail_fast"] = "skip",
    ) -> CandidateRankingResult:
        started = perf_counter()
        job = self._validate_job(job_data)
        self._validate_options(candidates, top_k, invalid_candidate_policy)
        evaluated: list[_EvaluatedCandidate] = []
        invalid: list[InvalidCandidateRecord] = []
        duplicates: list[DuplicateCandidateRecord] = []
        seen_ids: set[str] = set()

        for index, candidate_data in enumerate(candidates):
            reference = self._safe_reference(candidate_data)
            try:
                cv = self._validate_cv(candidate_data)
                if cv.schema_version != CV_SCHEMA_VERSION:
                    raise UnsupportedSchemaVersionError("Only CV schema version 1.0 is supported.")
                if cv.candidate_id is not None and cv.candidate_id in seen_ids:
                    duplicates.append(DuplicateCandidateRecord(
                        candidate_id=cv.candidate_id,
                        index=index,
                        message="A previous candidate with the same ID was already evaluated.",
                    ))
                    continue
                if cv.candidate_id is not None:
                    seen_ids.add(cv.candidate_id)
                # This is the sole scoring call. Passing validated models avoids re-parsing the job.
                result = self.matching_service.match(cv, job)
                evaluated.append(_EvaluatedCandidate(index=index, cv=cv, result=result))
            except (InvalidCVPayloadError, UnsupportedSchemaVersionError) as exc:
                if invalid_candidate_policy == "fail_fast":
                    raise
                invalid.append(InvalidCandidateRecord(
                    candidate_reference=reference,
                    index=index,
                    error_code=exc.code,
                    message="The candidate CV could not be evaluated because its structured data is invalid.",
                ))

        ranked = sorted(evaluated, key=self._sort_key)
        selected = ranked[:top_k]
        top_candidates = [
            self.formatter.format(
                item.cv,
                item.result,
                rank=rank,
                include_technical_details=include_technical_details,
            )
            for rank, item in enumerate(selected, start=1)
        ]
        eligible_count = sum(item.result.eligible for item in evaluated)
        elapsed_ms = round((perf_counter() - started) * 1000, 2)
        if evaluated:
            summary = f"{len(evaluated)} candidates were evaluated. The {len(selected)} strongest matching candidates are returned."
        else:
            summary = "No valid candidate could be evaluated. No candidates are returned."
        return CandidateRankingResult(
            job_id=job.job_id,
            job_title=job.job_title,
            candidates_received=len(candidates),
            candidates_evaluated=len(evaluated),
            invalid_candidates_count=len(invalid),
            duplicate_candidates_count=len(duplicates),
            eligible_candidates_count=eligible_count,
            ineligible_candidates_count=len(evaluated) - eligible_count,
            requested_top_k=top_k,
            returned_candidates_count=len(top_candidates),
            top_candidates=top_candidates,
            invalid_candidates=invalid,
            duplicate_candidates=duplicates,
            summary=summary,
            metadata=RankingMetadata(
                matching_version=MATCHING_VERSION,
                ranking_version=self.config.version,
                processed_at=datetime.now(timezone.utc),
                processing_time_ms=elapsed_ms,
            ),
        )

    @staticmethod
    def _validate_job(data: dict[str, Any] | JobProfile) -> JobProfile:
        try:
            job = data if isinstance(data, JobProfile) else JobProfile.model_validate(data)
        except ValidationError as exc:
            raise InvalidJobPayloadError("The job payload is invalid.", exc.errors()) from exc
        if job.schema_version != JOB_SCHEMA_VERSION:
            raise UnsupportedSchemaVersionError("Only job schema version 1.0 is supported.")
        return job

    @staticmethod
    def _validate_cv(data: dict[str, Any] | CVProfile) -> CVProfile:
        try:
            return data if isinstance(data, CVProfile) else CVProfile.model_validate(data)
        except ValidationError as exc:
            raise InvalidCVPayloadError("The CV payload is invalid.", exc.errors()) from exc

    def _validate_options(
        self,
        candidates: list[dict[str, Any] | CVProfile],
        top_k: int,
        policy: str,
    ) -> None:
        if not isinstance(candidates, list) or not candidates:
            raise InvalidRankingRequestError("At least one candidate is required.")
        if len(candidates) > self.config.maximum_candidates:
            raise InvalidRankingRequestError(f"At most {self.config.maximum_candidates} candidates are allowed.")
        if isinstance(top_k, bool) or not isinstance(top_k, int) or not 1 <= top_k <= self.config.maximum_top_k:
            raise InvalidRankingRequestError(f"top_k must be between 1 and {self.config.maximum_top_k}.")
        if policy not in {"skip", "fail_fast"}:
            raise InvalidRankingRequestError("invalid_candidate_policy must be 'skip' or 'fail_fast'.")

    @staticmethod
    def _safe_reference(data: dict[str, Any] | CVProfile) -> str | None:
        value = data.candidate_id if isinstance(data, CVProfile) else data.get("candidate_id")
        return value if isinstance(value, str) else None

    @staticmethod
    def _sort_key(item: _EvaluatedCandidate) -> tuple[Any, ...]:
        scores = item.result.scores
        identifier = item.result.candidate_id
        return (
            not item.result.eligible,
            -item.result.overall_score,
            -scores["required_skills"].score,
            -scores["experience"].score,
            len(item.result.missing_required_skills),
            -scores["education"].score,
            -scores["languages"].score,
            -scores["preferred_skills"].score,
            identifier is None,
            identifier or "",
            item.index,
        )
