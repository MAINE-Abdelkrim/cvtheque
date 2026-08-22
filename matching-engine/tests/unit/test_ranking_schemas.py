import pytest
from pydantic import ValidationError

from app.config.ranking_config import DEFAULT_RANKING_CONFIG
from app.schemas.ranking_schema import RankingRequest


def test_ranking_request_defaults() -> None:
    request = RankingRequest.model_validate({"job": {}, "candidates": [{}]})
    assert request.options.top_k == 3
    assert request.options.invalid_candidate_policy == "skip"
    assert not request.options.include_technical_details


@pytest.mark.parametrize("candidates", [None, {}, [], "not-a-list"])
def test_candidates_must_be_non_empty_list(candidates: object) -> None:
    with pytest.raises(ValidationError):
        RankingRequest.model_validate({"job": {}, "candidates": candidates})


@pytest.mark.parametrize("top_k", [0, 101, -1])
def test_top_k_bounds(top_k: int) -> None:
    with pytest.raises(ValidationError):
        RankingRequest.model_validate({"job": {}, "candidates": [{}], "options": {"top_k": top_k}})


def test_maximum_candidate_batch_size() -> None:
    candidates = [{}] * (DEFAULT_RANKING_CONFIG.maximum_candidates + 1)
    with pytest.raises(ValidationError):
        RankingRequest.model_validate({"job": {}, "candidates": candidates})


def test_invalid_policy_and_unknown_options_rejected() -> None:
    with pytest.raises(ValidationError):
        RankingRequest.model_validate({"job": {}, "candidates": [{}], "options": {"invalid_candidate_policy": "ignore"}})
    with pytest.raises(ValidationError):
        RankingRequest.model_validate({"job": {}, "candidates": [{}], "options": {"unknown": True}})
