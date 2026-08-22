import copy

import pytest

from app.exceptions import InvalidCVPayloadError, InvalidJobPayloadError, InvalidRankingRequestError
from app.schemas.cv_schema import CVProfile
from app.services.candidate_ranking_service import CandidateRankingService, _EvaluatedCandidate
from app.services.matching_service import MatchingService


def candidate(identifier: str | None, skills: list[str], years: float, *, name: str | None = None) -> dict:
    return {"candidate_id": identifier, "full_name": name, "skills": skills, "total_experience_years": years}


def simple_job() -> dict:
    return {"job_id": "job-1", "job_title": "Backend Developer", "required_skills": ["Python", "SQL"], "minimum_experience_years": 3}


def test_default_top_three_and_best_first() -> None:
    candidates = [
        candidate("c4", [], 0), candidate("c2", ["Python"], 2),
        candidate("c1", ["Python", "SQL"], 4), candidate("c3", ["Python", "SQL"], 3),
    ]
    result = CandidateRankingService().rank_candidates(simple_job(), candidates)
    assert result.candidates_evaluated == 4
    assert result.returned_candidates_count == 3
    assert [item.candidate_id for item in result.top_candidates] == ["c1", "c3", "c2"]


def test_top_k_limits_output_and_valid_count() -> None:
    service = CandidateRankingService()
    candidates = [candidate("a", ["Python"], 1), candidate("b", [], 0)]
    assert service.rank_candidates(simple_job(), candidates, top_k=1).returned_candidates_count == 1
    assert service.rank_candidates(simple_job(), candidates, top_k=10).returned_candidates_count == 2


def test_eligible_candidate_outranks_higher_scoring_ineligible() -> None:
    job = {
        "required_skills": [{"name": "Python", "mandatory": True}],
        "preferred_skills": ["SQL"],
        "minimum_experience_years": 10,
        "scoring_weights": {"required_skills": 15, "preferred_skills": 5, "experience": 80},
    }
    candidates = [candidate("ineligible", ["SQL"], 10), candidate("eligible", ["Python"], 0)]
    result = CandidateRankingService().rank_candidates(job, candidates)
    by_id = {item.candidate_id: item for item in result.top_candidates}
    assert by_id["ineligible"].score > by_id["eligible"].score
    assert result.top_candidates[0].candidate_id == "eligible"


def test_invalid_skipped_and_fail_fast() -> None:
    candidates = [candidate("valid", ["Python"], 3), {"candidate_id": "bad", "skills": "invalid"}]
    skipped = CandidateRankingService().rank_candidates(simple_job(), candidates)
    assert skipped.candidates_evaluated == 1
    assert skipped.invalid_candidates[0].candidate_reference == "bad"
    assert skipped.invalid_candidates[0].index == 1
    with pytest.raises(InvalidCVPayloadError):
        CandidateRankingService().rank_candidates(simple_job(), candidates, invalid_candidate_policy="fail_fast")


def test_all_invalid_returns_empty_success() -> None:
    result = CandidateRankingService().rank_candidates(simple_job(), [{"skills": "bad"}])
    assert result.candidates_evaluated == 0
    assert result.top_candidates == []
    assert "No valid candidate" in result.summary


def test_duplicate_non_null_ids_and_null_ids() -> None:
    candidates = [candidate("same", ["Python"], 1), candidate("same", ["Python", "SQL"], 4), candidate(None, [], 0), candidate(None, ["Python"], 1)]
    result = CandidateRankingService().rank_candidates(simple_job(), candidates, top_k=10)
    assert result.duplicate_candidates_count == 1
    assert result.duplicate_candidates[0].index == 1
    assert result.candidates_evaluated == 3
    assert sum(item.candidate_id is None for item in result.top_candidates) == 2


def test_candidate_identifier_breaks_complete_score_tie() -> None:
    candidates = [candidate("z-candidate", ["Python", "SQL"], 3), candidate("a-candidate", ["Python", "SQL"], 3)]
    result = CandidateRankingService().rank_candidates(simple_job(), candidates)
    assert [item.candidate_id for item in result.top_candidates] == ["a-candidate", "z-candidate"]


@pytest.mark.parametrize(("criterion", "lower_missing"), [
    ("required_skills", []),
    ("experience", []),
])
def test_criterion_score_tie_breakers(criterion: str, lower_missing: list[str]) -> None:
    base = MatchingService().match(candidate("base", ["Python", "SQL"], 3), simple_job())
    high_scores = dict(base.scores)
    low_scores = dict(base.scores)
    high_scores[criterion] = high_scores[criterion].model_copy(update={"score": 90.0})
    low_scores[criterion] = low_scores[criterion].model_copy(update={"score": 80.0})
    high = base.model_copy(update={"candidate_id": "z", "overall_score": 75.0, "scores": high_scores})
    low = base.model_copy(update={"candidate_id": "a", "overall_score": 75.0, "scores": low_scores, "missing_required_skills": lower_missing})
    items = [
        _EvaluatedCandidate(0, CVProfile(candidate_id="a"), low),
        _EvaluatedCandidate(1, CVProfile(candidate_id="z"), high),
    ]
    assert sorted(items, key=CandidateRankingService._sort_key)[0].result.candidate_id == "z"


def test_fewer_missing_required_skills_breaks_score_tie() -> None:
    base = MatchingService().match(candidate("base", ["Python", "SQL"], 3), simple_job())
    fewer = base.model_copy(update={"candidate_id": "z", "overall_score": 75.0, "missing_required_skills": []})
    more = base.model_copy(update={"candidate_id": "a", "overall_score": 75.0, "missing_required_skills": ["SQL"]})
    items = [
        _EvaluatedCandidate(0, CVProfile(candidate_id="a"), more),
        _EvaluatedCandidate(1, CVProfile(candidate_id="z"), fewer),
    ]
    assert sorted(items, key=CandidateRankingService._sort_key)[0].result.candidate_id == "z"


def test_original_index_is_final_fallback_for_null_ids() -> None:
    candidates = [candidate(None, ["Python", "SQL"], 3, name="First"), candidate(None, ["Python", "SQL"], 3, name="Second")]
    result = CandidateRankingService().rank_candidates(simple_job(), candidates)
    assert [item.candidate_name for item in result.top_candidates] == ["First", "Second"]


def test_stable_ids_make_order_independent() -> None:
    original = [candidate("b", ["Python", "SQL"], 3), candidate("a", ["Python", "SQL"], 3), candidate("c", [], 0)]
    reversed_result = CandidateRankingService().rank_candidates(simple_job(), list(reversed(original)))
    first_result = CandidateRankingService().rank_candidates(simple_job(), original)
    assert [item.candidate_id for item in first_result.top_candidates] == [item.candidate_id for item in reversed_result.top_candidates]


def test_deterministic_ranking_except_metadata() -> None:
    candidates = [candidate("b", ["Python"], 2), candidate("a", ["Python", "SQL"], 3)]
    first = CandidateRankingService().rank_candidates(simple_job(), candidates).model_dump()
    second = CandidateRankingService().rank_candidates(copy.deepcopy(simple_job()), copy.deepcopy(candidates)).model_dump()
    first.pop("metadata")
    second.pop("metadata")
    assert first == second


def test_malformed_job_rejects_whole_request() -> None:
    with pytest.raises(InvalidJobPayloadError):
        CandidateRankingService().rank_candidates({"minimum_experience_years": -1}, [candidate("a", [], 0)])


@pytest.mark.parametrize(("top_k", "candidates"), [(0, [candidate("a", [], 0)]), (101, [candidate("a", [], 0)]), (3, [])])
def test_direct_service_input_limits(top_k: int, candidates: list[dict]) -> None:
    with pytest.raises(InvalidRankingRequestError):
        CandidateRankingService().rank_candidates(simple_job(), candidates, top_k=top_k)


def test_technical_details_only_on_returned_candidates() -> None:
    candidates = [candidate(str(index), ["Python"], float(index)) for index in range(5)]
    default = CandidateRankingService().rank_candidates(simple_job(), candidates, top_k=2)
    technical = CandidateRankingService().rank_candidates(simple_job(), candidates, top_k=2, include_technical_details=True)
    assert all(item.technical_result is None for item in default.top_candidates)
    assert len(technical.top_candidates) == 2
    assert all(item.technical_result is not None for item in technical.top_candidates)


def test_one_hundred_candidates_are_all_evaluated_but_only_three_returned() -> None:
    candidates = [candidate(f"candidate-{index:03d}", ["Python"], index % 5) for index in range(100)]
    result = CandidateRankingService().rank_candidates(simple_job(), candidates)
    assert result.candidates_evaluated == 100
    assert len(result.top_candidates) == 3
