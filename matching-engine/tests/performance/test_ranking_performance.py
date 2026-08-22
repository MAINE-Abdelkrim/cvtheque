from time import perf_counter

import pytest

from app.services.candidate_ranking_service import CandidateRankingService


@pytest.mark.performance
def test_one_thousand_simple_candidates_complete_in_reasonable_mvp_time() -> None:
    candidates = [
        {
            "candidate_id": f"candidate-{index:04d}",
            "skills": ["Python", "Postgres"] if index % 2 else ["Python", "FastAPI", "PostgreSQL"],
            "total_experience_years": float(index % 8),
        }
        for index in range(1_000)
    ]
    job = {
        "required_skills": ["Python", "PostgreSQL"],
        "preferred_skills": ["FastAPI"],
        "minimum_experience_years": 3,
    }
    started = perf_counter()
    result = CandidateRankingService().rank_candidates(job, candidates)
    elapsed = perf_counter() - started
    assert result.candidates_evaluated == 1_000
    assert result.returned_candidates_count == 3
    assert elapsed < 30, f"1,000-candidate ranking took {elapsed:.2f}s"
