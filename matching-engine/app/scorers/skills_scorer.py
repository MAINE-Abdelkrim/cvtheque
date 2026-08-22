from app.config.scoring_config import ScoringConfig
from app.normalizers.skill_normalizer import SkillNormalizer
from app.schemas.job_schema import SkillRequirement
from app.schemas.match_schema import HardRequirementFailure, PartialMatch
from .base import ScoreOutcome, inactive


def score_skills(candidate_skills: list[str], requirements: list[SkillRequirement], normalizer: SkillNormalizer, config: ScoringConfig, criterion: str = "required_skills") -> ScoreOutcome:
    if not requirements:
        return inactive(f"No {criterion.replace('_', ' ')} were specified.")
    candidates = [normalizer.normalize(item) for item in candidate_skills]
    matched, missing, partials, failures = [], [], [], []
    credits = 0.0
    for requirement in requirements:
        required = normalizer.normalize(requirement.name)
        exact = next((item for item in candidates if item.canonical == required.canonical), None)
        if exact:
            credits += 1
            matched.append(requirement.name)
            continue
        partial = next((item for item in candidates if normalizer.is_approved_partial(required.canonical, item.canonical)), None)
        if partial:
            credits += config.partial_skill_credit
            partials.append(PartialMatch(required=requirement.name, candidate=partial.original, credit=config.partial_skill_credit, match_type="partial"))
            continue
        missing.append(requirement.name)
        if requirement.mandatory:
            failures.append(HardRequirementFailure(code="MANDATORY_SKILL_MISSING", criterion=criterion, requirement=requirement.name, message=f"Mandatory skill '{requirement.name}' was not found."))
    score = credits / len(requirements) * 100
    explanation = f"{len(matched)} of {len(requirements)} {criterion.replace('_', ' ')} matched"
    if partials:
        explanation += f", with {len(partials)} approved partial match(es)"
    return ScoreOutcome(score, True, matched, missing, partials, explanation + ".", failures=failures)

