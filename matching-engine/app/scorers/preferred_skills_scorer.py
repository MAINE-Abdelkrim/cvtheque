from app.config.scoring_config import ScoringConfig
from app.normalizers.skill_normalizer import SkillNormalizer
from app.schemas.job_schema import SkillRequirement
from .base import ScoreOutcome
from .skills_scorer import score_skills


def score_preferred_skills(candidate_skills: list[str], requirements: list[SkillRequirement], normalizer: SkillNormalizer, config: ScoringConfig) -> ScoreOutcome:
    # Preferred requirements can never affect eligibility.
    safe = [requirement.model_copy(update={"mandatory": False}) for requirement in requirements]
    return score_skills(candidate_skills, safe, normalizer, config, "preferred_skills")

