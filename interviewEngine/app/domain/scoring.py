"""Deterministic response-quality scoring policy.

Scores describe observable answers within this interview workflow. They are not a
measure of general ability, employability, personality, or candidate worth.
"""

from collections import defaultdict
from collections.abc import Iterable

from app.domain.interview_session import InterviewTurn

CLASSIFICATION_EXCELLENT = 85
CLASSIFICATION_GOOD = 70
CLASSIFICATION_FAIR = 50
VALID_CLASSIFICATIONS = {
    "excellent",
    "good",
    "fair",
    "needs_improvement",
}


def classification_for_score(score: int) -> str:
    """Return the single authoritative classification for a bounded score."""
    if score >= CLASSIFICATION_EXCELLENT:
        return "excellent"
    if score >= CLASSIFICATION_GOOD:
        return "good"
    if score >= CLASSIFICATION_FAIR:
        return "fair"
    return "needs_improvement"


def aggregate_evaluated_turns(
    turns: Iterable[InterviewTurn],
) -> tuple[int, dict[str, int], int]:
    """Calculate authoritative overall/category scores and evaluated count."""
    category_values: dict[str, list[int]] = defaultdict(list)
    scores: list[int] = []
    for turn in turns:
        if turn.evaluation is None:
            continue
        score = turn.evaluation.score
        scores.append(score)
        category_values[turn.question.category.value].append(score)
    overall = round(sum(scores) / len(scores)) if scores else 0
    category_scores = {
        category: round(sum(values) / len(values))
        for category, values in category_values.items()
    }
    return overall, category_scores, len(scores)
