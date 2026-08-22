from __future__ import annotations

from app.schemas.cv_schema import CVProfile
from app.schemas.match_schema import CriterionScore, HardRequirementFailure, MatchResult
from app.schemas.ranking_schema import (
    RecruiterCandidateResult,
    RecruiterCriterionResult,
    RecruiterExperienceResult,
    RecruiterSkillsResult,
)


MATCH_LEVEL_LABELS = {
    "excellent_match": "Excellent match",
    "strong_match": "Strong match",
    "moderate_match": "Moderate match",
    "weak_match": "Weak match",
    "low_match": "Low match",
}


class RecruiterResultFormatter:
    """Convert an auditable MatchResult into concise recruiter-facing English."""

    def format(
        self,
        cv: CVProfile,
        result: MatchResult,
        *,
        rank: int,
        include_technical_details: bool = False,
    ) -> RecruiterCandidateResult:
        required = result.scores["required_skills"]
        experience = result.scores["experience"]
        failures = [self._failure_message(item) for item in result.hard_requirement_failures]
        return RecruiterCandidateResult(
            rank=rank,
            candidate_id=result.candidate_id,
            candidate_name=cv.full_name,
            score=result.overall_score,
            match_level=MATCH_LEVEL_LABELS.get(result.classification, "Match unavailable"),
            eligible=result.eligible,
            eligibility_message=(
                "All mandatory requirements are satisfied."
                if result.eligible
                else "One or more mandatory requirements are not satisfied."
            ),
            summary=self._summary(result),
            required_skills=self._required_skills(required),
            experience=self._experience(experience),
            education=self._criterion(result.scores["education"], "Education", "job requirement"),
            languages=self._criterion(result.scores["languages"], "Language requirements", "job requirements"),
            location_and_work_mode=self._criterion(
                result.scores["location_and_work_mode"], "Location and work mode", "job needs"
            ),
            contract=self._criterion(result.scores["contract_type"], "Contract preference", "job contract"),
            main_strengths=self._strengths(result)[:3],
            main_gaps=self._gaps(result, failures)[:3],
            mandatory_failures=failures,
            technical_result=result if include_technical_details else None,
        )

    @staticmethod
    def _summary(result: MatchResult) -> str:
        level = MATCH_LEVEL_LABELS.get(result.classification, "The profile")
        if result.eligible:
            return f"{level}. The candidate satisfies all mandatory requirements."
        return f"{level}, but one or more mandatory requirements are not satisfied."

    @staticmethod
    def _required_skills(score: CriterionScore) -> RecruiterSkillsResult:
        partial_count = len(score.partial_matches)
        required_count = len(score.matched) + len(score.missing) + partial_count
        found_count = len(score.matched)
        return RecruiterSkillsResult(
            matched_count=found_count,
            required_count=required_count,
            display=f"{found_count} of {required_count} required skills found",
            matched=score.matched,
            missing=score.missing,
        )

    @staticmethod
    def _experience(score: CriterionScore) -> RecruiterExperienceResult:
        candidate = score.details.get("candidate_years")
        required = score.details.get("required_years")
        if not score.active:
            return RecruiterExperienceResult(
                candidate_years=candidate,
                required_years=required,
                status="Not specified",
                display="The job does not specify a minimum experience requirement",
            )
        if candidate is None:
            status, display = "Information unavailable", "Candidate experience could not be determined"
        elif score.score >= 100:
            status = "Meets requirement"
            display = f"{candidate:g} years found for {required:g} years required"
        else:
            status = "Below requirement"
            display = f"{candidate:g} years found for {required:g} years required"
        return RecruiterExperienceResult(
            candidate_years=candidate,
            required_years=required,
            status=status,
            display=display,
        )

    @staticmethod
    def _criterion(score: CriterionScore, subject: str, target: str) -> RecruiterCriterionResult:
        singular = subject in {"Education", "Contract preference"}
        verb = "is" if singular else "are"
        if not score.active:
            requirement = "requirement was" if singular else "requirements were"
            return RecruiterCriterionResult(status="Not specified", display=f"No {subject.lower()} {requirement} specified for this job")
        if score.score >= 99.999:
            return RecruiterCriterionResult(status="Compatible", display=f"{subject} {verb} compatible with the {target}")
        if score.score >= 50:
            return RecruiterCriterionResult(status="Partially compatible", display=f"{subject} {verb} partially compatible with the {target}")
        negative = "does" if singular else "do"
        return RecruiterCriterionResult(status="Gap identified", display=f"{subject} {negative} not fully meet the {target}")

    @staticmethod
    def _failure_message(failure: HardRequirementFailure) -> str:
        if failure.code == "MANDATORY_SKILL_MISSING":
            return f"Mandatory skill {failure.requirement} was not found."
        if failure.code == "MANDATORY_LANGUAGE_NOT_MET":
            return f"Required {failure.requirement} level was not satisfied."
        if failure.code == "MANDATORY_EDUCATION_NOT_MET":
            return "Mandatory education level was not satisfied."
        return failure.message.rstrip(".") + "."

    @staticmethod
    def _strengths(result: MatchResult) -> list[str]:
        scores = result.scores
        strengths: list[str] = []
        if scores["required_skills"].active and scores["required_skills"].score >= 99.999:
            strengths.append("All required skills were found")
        experience = scores["experience"]
        if experience.active and experience.score >= 99.999:
            candidate = experience.details.get("candidate_years")
            required = experience.details.get("required_years")
            strengths.append(
                "Experience exceeds the minimum requirement"
                if candidate is not None and required is not None and candidate > required
                else "Experience meets the minimum requirement"
            )
        if scores["education"].active and scores["education"].score >= 99.999:
            strengths.append("Education is compatible with the role")
        if scores["languages"].active and scores["languages"].score >= 99.999:
            strengths.append("All language requirements are satisfied")
        if scores["preferred_skills"].active and scores["preferred_skills"].score >= 99.999:
            strengths.append("All preferred skills were found")
        return list(dict.fromkeys(strengths))

    @staticmethod
    def _gaps(result: MatchResult, failures: list[str]) -> list[str]:
        gaps = [f"{skill} was required but was not found" for skill in result.missing_required_skills]
        gaps.extend(f"{skill} was preferred but was not found" for skill in result.missing_preferred_skills)
        gaps.extend(message.rstrip(".") for message in failures)
        return list(dict.fromkeys(gaps))
