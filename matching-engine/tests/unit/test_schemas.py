import pytest
from pydantic import ValidationError

from app.schemas.cv_schema import CVProfile
from app.schemas.job_schema import JobProfile


def test_valid_minimal_payloads() -> None:
    assert CVProfile.model_validate({}).skills == []
    assert JobProfile.model_validate({}).required_skills == []


def test_valid_full_payload(sample_cv: dict, sample_job: dict) -> None:
    assert CVProfile.model_validate(sample_cv).candidate_id == "candidate-123"
    assert JobProfile.model_validate(sample_job).required_skills[0].name == "Python"


def test_unknown_fields_are_ignored() -> None:
    cv = CVProfile.model_validate({"age": 99, "gender": "ignored", "skills": ["Python"]})
    assert not hasattr(cv, "age")


@pytest.mark.parametrize("payload", [
    {"skills": "Python"},
    {"total_experience_years": -1},
    {"experiences": [{"duration_months": -1}]},
    {"education": [{"field": "CS"}]},
])
def test_malformed_cv_rejected(payload: dict) -> None:
    with pytest.raises(ValidationError):
        CVProfile.model_validate(payload)


def test_job_supports_both_skill_forms() -> None:
    job = JobProfile.model_validate({"required_skills": ["Python", {"name": "SQL", "mandatory": True}]})
    assert [item.mandatory for item in job.required_skills] == [False, True]


@pytest.mark.parametrize("weights", [
    {"required_skills": 20},
    {"required_skills": 101},
])
def test_invalid_weight_total_rejected(weights: dict) -> None:
    with pytest.raises(ValidationError, match="must total"):
        JobProfile.model_validate({"scoring_weights": weights})


def test_fractional_weights_are_normalized() -> None:
    job = JobProfile.model_validate({"scoring_weights": {"required_skills": .4, "experience": .6}})
    assert job.scoring_weights is not None
    assert job.scoring_weights.percentages()["experience"] == 60


def test_invalid_experience_range_rejected() -> None:
    with pytest.raises(ValidationError, match="maximum experience"):
        JobProfile.model_validate({"minimum_experience_years": 5, "maximum_experience_years": 2})
