from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.config.ranking_config import DEFAULT_RANKING_CONFIG
from app.schemas.match_schema import MatchResult


class StrictRankingModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RankingOptions(StrictRankingModel):
    top_k: int = Field(
        default=DEFAULT_RANKING_CONFIG.default_top_k,
        ge=1,
        le=DEFAULT_RANKING_CONFIG.maximum_top_k,
    )
    include_technical_details: bool = False
    invalid_candidate_policy: Literal["skip", "fail_fast"] = "skip"


class RankingRequest(StrictRankingModel):
    job: dict[str, Any]
    candidates: list[dict[str, Any]] = Field(
        min_length=1,
        max_length=DEFAULT_RANKING_CONFIG.maximum_candidates,
    )
    options: RankingOptions = Field(default_factory=RankingOptions)


class RecruiterSkillsResult(StrictRankingModel):
    matched_count: int = Field(ge=0)
    required_count: int = Field(ge=0)
    display: str
    matched: list[str]
    missing: list[str]


class RecruiterExperienceResult(StrictRankingModel):
    candidate_years: float | None
    required_years: float | None
    status: str
    display: str


class RecruiterCriterionResult(StrictRankingModel):
    status: str
    display: str


class RecruiterCandidateResult(StrictRankingModel):
    rank: int = Field(ge=1)
    candidate_id: str | None
    candidate_name: str | None
    score: float = Field(ge=0, le=100)
    match_level: str
    eligible: bool
    eligibility_message: str
    summary: str
    required_skills: RecruiterSkillsResult
    experience: RecruiterExperienceResult
    education: RecruiterCriterionResult
    languages: RecruiterCriterionResult
    location_and_work_mode: RecruiterCriterionResult
    contract: RecruiterCriterionResult
    main_strengths: list[str] = Field(max_length=3)
    main_gaps: list[str] = Field(max_length=3)
    mandatory_failures: list[str]
    technical_result: MatchResult | None = None


class InvalidCandidateRecord(StrictRankingModel):
    candidate_reference: str | None
    index: int = Field(ge=0)
    error_code: str
    message: str


class DuplicateCandidateRecord(StrictRankingModel):
    candidate_id: str
    index: int = Field(ge=0)
    message: str


class RankingMetadata(StrictRankingModel):
    matching_version: str
    ranking_version: str
    processed_at: datetime
    processing_time_ms: float = Field(ge=0)


class CandidateRankingResult(StrictRankingModel):
    job_id: str | None
    job_title: str | None
    candidates_received: int = Field(ge=0)
    candidates_evaluated: int = Field(ge=0)
    invalid_candidates_count: int = Field(ge=0)
    duplicate_candidates_count: int = Field(ge=0)
    eligible_candidates_count: int = Field(ge=0)
    ineligible_candidates_count: int = Field(ge=0)
    requested_top_k: int = Field(ge=1, le=DEFAULT_RANKING_CONFIG.maximum_top_k)
    returned_candidates_count: int = Field(ge=0)
    top_candidates: list[RecruiterCandidateResult]
    invalid_candidates: list[InvalidCandidateRecord]
    duplicate_candidates: list[DuplicateCandidateRecord]
    summary: str
    metadata: RankingMetadata
