from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class StrictOutputModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PartialMatch(StrictOutputModel):
    required: str
    candidate: str
    credit: float
    match_type: str


class CriterionScore(StrictOutputModel):
    score: float = Field(ge=0, le=100)
    weight: float = Field(ge=0, le=100)
    weighted_score: float = Field(ge=0, le=100)
    active: bool = True
    matched: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    partial_matches: list[PartialMatch] = Field(default_factory=list)
    explanation: str
    warnings: list[str] = Field(default_factory=list)
    details: dict[str, Any] = Field(default_factory=dict)


class HardRequirementFailure(StrictOutputModel):
    code: str
    criterion: str
    requirement: str
    message: str


class MatchMetadata(StrictOutputModel):
    scoring_profile: str
    cv_schema_version: str
    job_schema_version: str
    weights_redistributed: bool
    processed_at: datetime


class MatchResult(StrictOutputModel):
    matching_version: str
    candidate_id: str | None
    job_id: str | None
    overall_score: float = Field(ge=0, le=100)
    classification: str
    eligible: bool
    hard_requirement_failures: list[HardRequirementFailure]
    scores: dict[str, CriterionScore]
    matched_skills: list[str]
    missing_required_skills: list[str]
    missing_preferred_skills: list[str]
    strengths: list[str]
    gaps: list[str]
    warnings: list[str]
    explanation: str | None
    metadata: MatchMetadata

