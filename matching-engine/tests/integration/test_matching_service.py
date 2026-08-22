import copy

import pytest

from app.exceptions import InvalidCVPayloadError, InvalidJobPayloadError
from app.services.matching_service import MatchingService


def test_strong_backend_match(sample_cv: dict, sample_job: dict) -> None:
    result = MatchingService().match(sample_cv, sample_job)
    assert result.overall_score == 97.5
    assert result.classification == "excellent_match"
    assert result.eligible
    assert result.scores["required_skills"].score == 100


def test_missing_required_skill(sample_cv: dict, sample_job: dict) -> None:
    sample_job["required_skills"].append("Redis")
    result = MatchingService().match(sample_cv, sample_job)
    assert result.scores["required_skills"].score == 75
    assert "Redis" in result.missing_required_skills


def test_alias_scenario(sample_cv: dict, sample_job: dict) -> None:
    sample_cv["skills"] = ["Python", "FastAPI", "Postgres"]
    assert MatchingService().match(sample_cv, sample_job).scores["required_skills"].score == 100


def test_insufficient_experience(sample_cv: dict, sample_job: dict) -> None:
    sample_cv["total_experience_years"] = 2
    assert MatchingService().match(sample_cv, sample_job).scores["experience"].score == 66.67


def test_mandatory_language_failure_preserves_score(sample_cv: dict, sample_job: dict) -> None:
    sample_cv["languages"] = [{"name": "English", "level": "fluent"}]
    result = MatchingService().match(sample_cv, sample_job)
    assert not result.eligible
    assert result.overall_score > 50
    assert result.hard_requirement_failures[0].code == "MANDATORY_LANGUAGE_NOT_MET"


def test_no_education_redistributes_weight(sample_cv: dict, sample_job: dict) -> None:
    sample_job["required_education"] = None
    result = MatchingService().match(sample_cv, sample_job)
    assert not result.scores["education"].active
    assert result.metadata.weights_redistributed
    assert sum(item.weight for item in result.scores.values()) == pytest.approx(100, abs=.02)


def test_only_skills_and_experience() -> None:
    result = MatchingService().match({"skills": ["Python"], "total_experience_years": 2}, {"required_skills": ["Python"], "minimum_experience_years": 4})
    assert result.overall_score == pytest.approx(80.77, abs=.01)


def test_sparse_cv_uses_neutral_preference_policies() -> None:
    result = MatchingService().match({}, {"location": "Casablanca", "work_mode": "hybrid", "contract_type": "CDI"})
    assert result.overall_score == 50


def test_custom_scoring_weights() -> None:
    result = MatchingService().match({"skills": ["Python"], "total_experience_years": 0}, {"required_skills": ["Python"], "minimum_experience_years": 2, "scoring_weights": {"required_skills": .8, "experience": .2}})
    assert result.overall_score == 80


def test_high_score_with_mandatory_failure(sample_cv: dict, sample_job: dict) -> None:
    sample_job["required_skills"][0] = {"name": "Python", "mandatory": True}
    sample_cv["skills"].remove("Python")
    for entry in sample_cv["experiences"]:
        entry["skills"] = [skill for skill in entry["skills"] if skill != "Python"]
    result = MatchingService().match(sample_cv, sample_job)
    assert result.overall_score >= 70
    assert not result.eligible


def test_determinism_except_timestamp(sample_cv: dict, sample_job: dict) -> None:
    service = MatchingService()
    first = service.match(sample_cv, sample_job).model_dump()
    second = service.match(copy.deepcopy(sample_cv), copy.deepcopy(sample_job)).model_dump()
    first["metadata"].pop("processed_at")
    second["metadata"].pop("processed_at")
    assert first == second


@pytest.mark.parametrize(("cv", "job", "error"), [
    ({"skills": "bad"}, {}, InvalidCVPayloadError),
    ({}, {"minimum_experience_years": -1}, InvalidJobPayloadError),
])
def test_service_validation_errors(cv: dict, job: dict, error: type[Exception]) -> None:
    with pytest.raises(error):
        MatchingService().match(cv, job)


@pytest.mark.parametrize(("score", "label"), [(85, "excellent_match"), (70, "strong_match"), (50, "moderate_match"), (30, "weak_match"), (0, "low_match")])
def test_classification_boundaries(score: float, label: str) -> None:
    assert MatchingService._classify(score) == label
