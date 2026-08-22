from dataclasses import dataclass, field
from typing import Any

from app.schemas.match_schema import HardRequirementFailure, PartialMatch


@dataclass
class ScoreOutcome:
    score: float
    active: bool
    matched: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    partial_matches: list[PartialMatch] = field(default_factory=list)
    explanation: str = ""
    warnings: list[str] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)
    failures: list[HardRequirementFailure] = field(default_factory=list)


def inactive(explanation: str) -> ScoreOutcome:
    return ScoreOutcome(score=0.0, active=False, explanation=explanation)

