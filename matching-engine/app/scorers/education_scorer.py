from app.config.scoring_config import ScoringConfig
from app.normalizers.education_normalizer import EducationNormalizer
from app.schemas.cv_schema import EducationEntry
from app.schemas.job_schema import EducationRequirement
from app.schemas.match_schema import HardRequirementFailure
from .base import ScoreOutcome, inactive


def score_education(candidate: list[EducationEntry], requirement: EducationRequirement | None, normalizer: EducationNormalizer, config: ScoringConfig) -> ScoreOutcome:
    if requirement is None:
        return inactive("No education requirement was specified.")
    required_level = normalizer.level(requirement.minimum_level)
    candidate_level = max((normalizer.level(item.degree) for item in candidate), default=0)
    if candidate_level >= required_level and required_level > 0:
        level_credit = 1.0
    elif candidate_level == required_level - 1:
        level_credit = config.education_one_level_below_credit
    else:
        level_credit = 0.0
    fields = {normalizer.field(item.field) for item in candidate if item.field}
    preferred = {normalizer.field(item) for item in requirement.preferred_fields}
    field_match = not preferred or bool(fields & preferred)
    score = level_credit * (100 if not preferred else 80) + (20 if preferred and field_match else 0)
    failures = []
    if requirement.mandatory and level_credit < 1:
        failures.append(HardRequirementFailure(code="MANDATORY_EDUCATION_NOT_MET", criterion="education", requirement=requirement.minimum_level, message=f"Mandatory education level '{requirement.minimum_level}' was not satisfied."))
    return ScoreOutcome(score, True, matched=list(fields & preferred), missing=[] if field_match else list(requirement.preferred_fields), explanation=f"Candidate education level {candidate_level} was compared with required level {required_level}.", details={"candidate_level": candidate_level, "required_level": required_level, "field_matched": field_match}, failures=failures)

