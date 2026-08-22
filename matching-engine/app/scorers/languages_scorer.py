from app.config.scoring_config import ScoringConfig
from app.normalizers.language_normalizer import LanguageNormalizer
from app.schemas.cv_schema import LanguageEntry
from app.schemas.job_schema import LanguageRequirement
from app.schemas.match_schema import HardRequirementFailure, PartialMatch
from .base import ScoreOutcome, inactive


def score_languages(candidate: list[LanguageEntry], requirements: list[LanguageRequirement], normalizer: LanguageNormalizer, config: ScoringConfig) -> ScoreOutcome:
    if not requirements:
        return inactive("No language requirement was specified.")
    levels = {normalizer.name(item.name): normalizer.level(item.level) for item in candidate}
    credits, matched, missing, partials, failures = 0.0, [], [], [], []
    for requirement in requirements:
        name, required = normalizer.name(requirement.name), normalizer.level(requirement.minimum_level)
        actual = levels.get(name, 0)
        if actual >= required and required > 0:
            credits += 1
            matched.append(requirement.name)
        elif actual == required - 1 and actual > 0:
            credits += config.language_one_level_below_credit
            partials.append(PartialMatch(required=requirement.name, candidate=requirement.name, credit=config.language_one_level_below_credit, match_type="partial"))
        else:
            missing.append(requirement.name)
        if requirement.mandatory and actual < required:
            failures.append(HardRequirementFailure(code="MANDATORY_LANGUAGE_NOT_MET", criterion="languages", requirement=requirement.name, message=f"Mandatory language '{requirement.name}' at level '{requirement.minimum_level}' was not satisfied."))
    return ScoreOutcome(credits / len(requirements) * 100, True, matched, missing, partials, f"{len(matched)} of {len(requirements)} language requirements were fully satisfied.", details={"candidate_levels": levels}, failures=failures)

