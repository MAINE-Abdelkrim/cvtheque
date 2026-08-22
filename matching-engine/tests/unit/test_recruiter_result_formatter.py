from app.schemas.cv_schema import CVProfile
from app.services.matching_service import MatchingService
from app.services.recruiter_result_formatter import RecruiterResultFormatter


def test_formatter_produces_readable_result(sample_cv: dict, sample_job: dict) -> None:
    cv = CVProfile.model_validate(sample_cv)
    technical = MatchingService().match(cv, sample_job)
    result = RecruiterResultFormatter().format(cv, technical, rank=1)
    assert result.rank == 1
    assert result.candidate_name == "Example Candidate"
    assert result.match_level == "Excellent match"
    assert result.eligibility_message == "All mandatory requirements are satisfied."
    assert result.required_skills.display == "3 of 3 required skills found"
    assert result.experience.status == "Meets requirement"
    assert len(result.main_strengths) <= 3
    assert len(result.main_gaps) <= 3
    assert result.technical_result is None


def test_formatter_can_include_complete_technical_result(sample_cv: dict, sample_job: dict) -> None:
    cv = CVProfile.model_validate(sample_cv)
    technical = MatchingService().match(cv, sample_job)
    result = RecruiterResultFormatter().format(cv, technical, rank=1, include_technical_details=True)
    assert result.technical_result == technical


def test_mandatory_failure_is_human_readable(sample_cv: dict, sample_job: dict) -> None:
    sample_job["required_skills"][0] = {"name": "Python", "mandatory": True}
    sample_cv["skills"] = [skill for skill in sample_cv["skills"] if skill != "Python"]
    sample_cv["experiences"][0]["skills"] = [skill for skill in sample_cv["experiences"][0]["skills"] if skill != "Python"]
    cv = CVProfile.model_validate(sample_cv)
    technical = MatchingService().match(cv, sample_job)
    result = RecruiterResultFormatter().format(cv, technical, rank=1)
    assert not result.eligible
    assert result.mandatory_failures == ["Mandatory skill Python was not found."]
    assert "MANDATORY_SKILL_MISSING" not in result.model_dump_json()


def test_recruiter_payload_has_no_scoring_internals(sample_cv: dict, sample_job: dict) -> None:
    cv = CVProfile.model_validate(sample_cv)
    technical = MatchingService().match(cv, sample_job)
    payload = RecruiterResultFormatter().format(cv, technical, rank=1).model_dump(exclude_none=True)
    serialized = str(payload).lower()
    assert "weight" not in serialized
    assert "weighted_score" not in serialized
    assert "scoring_profile" not in serialized


def test_name_is_presentation_only(sample_cv: dict, sample_job: dict) -> None:
    first = MatchingService().match(sample_cv, sample_job)
    sample_cv["full_name"] = "A Completely Different Name"
    second = MatchingService().match(sample_cv, sample_job)
    assert first.overall_score == second.overall_score
    assert first.scores == second.scores
