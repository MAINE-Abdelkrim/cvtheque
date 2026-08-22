import json
from pathlib import Path

from app.schemas.cv_schema import CVProfile
from app.schemas.job_schema import JobProfile
from app.schemas.match_schema import MatchResult
from app.schemas.ranking_schema import CandidateRankingResult, RankingRequest


ROOT = Path(__file__).resolve().parents[2]


def test_all_example_json_is_valid() -> None:
    cv = json.loads((ROOT / "examples" / "sample_cv.json").read_text(encoding="utf-8"))
    job = json.loads((ROOT / "examples" / "sample_job.json").read_text(encoding="utf-8"))
    result = json.loads((ROOT / "examples" / "sample_match_result.json").read_text(encoding="utf-8"))
    CVProfile.model_validate(cv)
    JobProfile.model_validate(job)
    MatchResult.model_validate(result)


def test_ranking_examples_are_valid_and_show_top_three() -> None:
    request = json.loads((ROOT / "examples" / "ranking_request.json").read_text(encoding="utf-8"))
    response = json.loads((ROOT / "examples" / "ranking_response.json").read_text(encoding="utf-8"))
    parsed_request = RankingRequest.model_validate(request)
    parsed_response = CandidateRankingResult.model_validate(response)
    assert len(parsed_request.candidates) == 5
    assert len(parsed_response.top_candidates) == 3


def test_scenario_catalog_has_ten_cases() -> None:
    scenarios = json.loads((ROOT / "tests" / "fixtures" / "scenarios.json").read_text(encoding="utf-8"))
    assert [item["id"] for item in scenarios] == list(range(1, 11))
