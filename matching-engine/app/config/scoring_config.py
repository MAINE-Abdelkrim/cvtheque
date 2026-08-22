from dataclasses import dataclass
from types import MappingProxyType
from typing import Mapping


DEFAULT_WEIGHTS = MappingProxyType({
    "required_skills": 40.0,
    "experience": 25.0,
    "education": 10.0,
    "languages": 10.0,
    "preferred_skills": 5.0,
    "location_and_work_mode": 5.0,
    "contract_type": 5.0,
})


@dataclass(frozen=True)
class ScoringConfig:
    profile: str = "default-v1"
    partial_skill_credit: float = 0.5
    education_one_level_below_credit: float = 0.6
    language_one_level_below_credit: float = 0.7
    neutral_information_score: float = 50.0
    weights: Mapping[str, float] = DEFAULT_WEIGHTS


DEFAULT_CONFIG = ScoringConfig()

