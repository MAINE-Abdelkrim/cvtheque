from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from app.config import DEFAULT_CONFIG, ScoringConfig
from app.constants import CV_SCHEMA_VERSION, JOB_SCHEMA_VERSION, MATCHING_VERSION
from app.exceptions import InvalidCVPayloadError, InvalidJobPayloadError, UnsupportedSchemaVersionError
from app.normalizers.education_normalizer import EducationNormalizer
from app.normalizers.language_normalizer import LanguageNormalizer
from app.normalizers.skill_normalizer import SkillNormalizer
from app.schemas.cv_schema import CVProfile
from app.schemas.job_schema import JobProfile
from app.schemas.match_schema import CriterionScore, HardRequirementFailure, MatchMetadata, MatchResult
from app.scorers.base import ScoreOutcome
from app.scorers.contract_scorer import score_contract
from app.scorers.education_scorer import score_education
from app.scorers.experience_scorer import score_experience
from app.scorers.languages_scorer import score_languages
from app.scorers.location_scorer import score_location
from app.scorers.preferred_skills_scorer import score_preferred_skills
from app.scorers.skills_scorer import score_skills


class MatchingService:
    """Stateless deterministic CV-to-job matching orchestration service."""

    def __init__(self, config: ScoringConfig = DEFAULT_CONFIG) -> None:
        self.config = config
        self.skills = SkillNormalizer()
        self.education = EducationNormalizer()
        self.languages = LanguageNormalizer()

    def match(self, cv_data: dict[str, Any] | CVProfile, job_data: dict[str, Any] | JobProfile, *, include_explanation: bool = True) -> MatchResult:
        cv = self._validate_cv(cv_data)
        job = self._validate_job(job_data)
        self._check_versions(cv, job)
        all_candidate_skills = list(dict.fromkeys(cv.skills + [skill for item in cv.experiences for skill in item.skills]))
        outcomes: dict[str, ScoreOutcome] = {
            "required_skills": score_skills(all_candidate_skills, job.required_skills, self.skills, self.config),
            "experience": score_experience(cv, job.minimum_experience_years),
            "education": score_education(cv.education, job.required_education, self.education, self.config),
            "languages": score_languages(cv.languages, job.required_languages, self.languages, self.config),
            "preferred_skills": score_preferred_skills(all_candidate_skills, job.preferred_skills, self.skills, self.config),
            "location_and_work_mode": score_location(cv.location, cv.preferred_work_mode, job.location, job.work_mode, job.remote_allowed, self.config),
            "contract_type": score_contract(cv.preferred_contract_types, job.contract_type, self.config),
        }
        configured = job.scoring_weights.percentages() if job.scoring_weights else dict(self.config.weights)
        active_total = sum(configured[name] for name, outcome in outcomes.items() if outcome.active)
        effective = {name: (configured[name] / active_total * 100 if outcome.active and active_total else 0.0) for name, outcome in outcomes.items()}
        overall = sum(outcome.score * effective[name] / 100 for name, outcome in outcomes.items()) if active_total else 0.0
        failures = [failure for outcome in outcomes.values() for failure in outcome.failures]
        for requirement in job.mandatory_requirements:
            if requirement.satisfied is False:
                failures.append(HardRequirementFailure(code="EXPLICIT_MANDATORY_REQUIREMENT_FAILED", criterion="mandatory_requirements", requirement=requirement.code, message=requirement.description))
        scores = {
            name: CriterionScore(
                score=self._round(outcome.score), weight=self._round(effective[name]),
                weighted_score=self._round(outcome.score * effective[name] / 100), active=outcome.active,
                matched=outcome.matched, missing=outcome.missing, partial_matches=outcome.partial_matches,
                explanation=outcome.explanation, warnings=outcome.warnings, details=outcome.details,
            ) for name, outcome in outcomes.items()
        }
        strengths = self._strengths(outcomes)
        gaps = self._gaps(outcomes, failures)
        explanation = " ".join(outcome.explanation for outcome in outcomes.values() if outcome.active)
        if failures:
            explanation += f" {len(failures)} explicit hard requirement(s) failed; the numerical score remains informational."
        return MatchResult(
            matching_version=MATCHING_VERSION, candidate_id=cv.candidate_id, job_id=job.job_id,
            overall_score=self._round(overall), classification=self._classify(overall), eligible=not failures,
            hard_requirement_failures=failures, scores=scores,
            matched_skills=list(dict.fromkeys(outcomes["required_skills"].matched + outcomes["preferred_skills"].matched)),
            missing_required_skills=outcomes["required_skills"].missing,
            missing_preferred_skills=outcomes["preferred_skills"].missing,
            strengths=strengths, gaps=gaps,
            warnings=list(dict.fromkeys(warning for outcome in outcomes.values() for warning in outcome.warnings)),
            explanation=explanation.strip() if include_explanation else None,
            metadata=MatchMetadata(scoring_profile=self.config.profile, cv_schema_version=cv.schema_version,
                job_schema_version=job.schema_version, weights_redistributed=any(not item.active for item in outcomes.values()),
                processed_at=datetime.now(timezone.utc)),
        )

    @staticmethod
    def _validate_cv(data: dict[str, Any] | CVProfile) -> CVProfile:
        try:
            return data if isinstance(data, CVProfile) else CVProfile.model_validate(data)
        except ValidationError as exc:
            raise InvalidCVPayloadError("The CV payload is invalid.", exc.errors()) from exc

    @staticmethod
    def _validate_job(data: dict[str, Any] | JobProfile) -> JobProfile:
        try:
            return data if isinstance(data, JobProfile) else JobProfile.model_validate(data)
        except ValidationError as exc:
            raise InvalidJobPayloadError("The job payload is invalid.", exc.errors()) from exc

    @staticmethod
    def _check_versions(cv: CVProfile, job: JobProfile) -> None:
        if cv.schema_version != CV_SCHEMA_VERSION or job.schema_version != JOB_SCHEMA_VERSION:
            raise UnsupportedSchemaVersionError("Only CV and job schema version 1.0 are supported.")

    @staticmethod
    def _classify(score: float) -> str:
        if score >= 85: return "excellent_match"
        if score >= 70: return "strong_match"
        if score >= 50: return "moderate_match"
        if score >= 30: return "weak_match"
        return "low_match"

    @staticmethod
    def _round(value: float) -> float:
        return round(value + 1e-12, 2)

    @staticmethod
    def _strengths(outcomes: dict[str, ScoreOutcome]) -> list[str]:
        labels = {"required_skills": "Required skills", "experience": "Experience", "education": "Education", "languages": "Languages", "preferred_skills": "Preferred skills", "location_and_work_mode": "Location and work mode", "contract_type": "Contract preference"}
        return [f"{labels[name]} requirement is fully satisfied." for name, item in outcomes.items() if item.active and item.score >= 99.999]

    @staticmethod
    def _gaps(outcomes: dict[str, ScoreOutcome], failures: list[HardRequirementFailure]) -> list[str]:
        gaps = [f"{item} was required but was not found." for item in outcomes["required_skills"].missing]
        gaps += [f"{item} was preferred but was not found." for item in outcomes["preferred_skills"].missing]
        gaps += [failure.message for failure in failures if failure.message not in gaps]
        return list(dict.fromkeys(gaps))

