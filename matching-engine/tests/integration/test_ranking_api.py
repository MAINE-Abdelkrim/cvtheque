from fastapi.testclient import TestClient

from app.api.fastapi_app import RANKING_MAX_REQUEST_BYTES, create_app


def candidate(identifier: str, skills: list[str], years: float) -> dict:
    return {"candidate_id": identifier, "full_name": f"Candidate {identifier}", "skills": skills, "total_experience_years": years}


def request_payload(count: int = 5) -> dict:
    return {
        "job": {"job_id": "job-ranking", "required_skills": ["Python", "SQL"], "minimum_experience_years": 3},
        "candidates": [candidate(f"candidate-{index:03d}", ["Python", "SQL"] if index > 1 else ["Python"], float(index)) for index in range(count)],
    }


def test_ranking_endpoint_returns_default_top_three() -> None:
    response = TestClient(create_app()).post("/api/v1/rank-candidates", json=request_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["candidates_received"] == 5
    assert body["candidates_evaluated"] == 5
    assert body["requested_top_k"] == 3
    assert body["returned_candidates_count"] == 3
    assert len(body["top_candidates"]) == 3
    assert all("technical_result" not in item for item in body["top_candidates"])


def test_technical_details_included_only_for_top_k() -> None:
    payload = request_payload()
    payload["options"] = {"top_k": 2, "include_technical_details": True}
    body = TestClient(create_app()).post("/api/v1/rank-candidates", json=payload).json()
    assert len(body["top_candidates"]) == 2
    assert all("technical_result" in item for item in body["top_candidates"])


def test_invalid_candidate_skip_and_fail_fast() -> None:
    payload = request_payload(2)
    payload["candidates"].append({"candidate_id": "invalid", "skills": "bad"})
    client = TestClient(create_app())
    skipped = client.post("/api/v1/rank-candidates", json=payload)
    assert skipped.status_code == 200
    assert skipped.json()["invalid_candidates_count"] == 1
    payload["options"] = {"invalid_candidate_policy": "fail_fast"}
    failed = client.post("/api/v1/rank-candidates", json=payload)
    assert failed.status_code == 422
    assert failed.json()["error"]["code"] == "INVALID_CV_PAYLOAD"


def test_all_invalid_is_successful_empty_ranking() -> None:
    payload = {"job": {}, "candidates": [{"skills": "bad"}]}
    response = TestClient(create_app()).post("/api/v1/rank-candidates", json=payload)
    assert response.status_code == 200
    assert response.json()["top_candidates"] == []


def test_invalid_job_rejects_batch() -> None:
    payload = {"job": {"minimum_experience_years": -1}, "candidates": [{}]}
    response = TestClient(create_app()).post("/api/v1/rank-candidates", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_JOB_PAYLOAD"


def test_outer_ranking_validation() -> None:
    client = TestClient(create_app())
    empty = client.post("/api/v1/rank-candidates", json={"job": {}, "candidates": []})
    zero = client.post("/api/v1/rank-candidates", json={"job": {}, "candidates": [{}], "options": {"top_k": 0}})
    too_many = client.post("/api/v1/rank-candidates", json={"job": {}, "candidates": [{}] * 5001})
    assert empty.status_code == zero.status_code == too_many.status_code == 422
    assert empty.json()["error"]["code"] == "INVALID_REQUEST"


def test_ranking_payload_limit_is_separate() -> None:
    response = TestClient(create_app()).post(
        "/api/v1/rank-candidates",
        content=b"{}",
        headers={"content-type": "application/json", "content-length": str(RANKING_MAX_REQUEST_BYTES + 1)},
    )
    assert response.status_code == 413
    assert "20 MiB" in response.json()["error"]["message"]


def test_recruiter_response_has_no_weights() -> None:
    body = TestClient(create_app()).post("/api/v1/rank-candidates", json=request_payload()).json()
    text = str(body).lower()
    assert "weighted_score" not in text
    assert "scoring_profile" not in text
    assert "'weight'" not in text


def test_single_match_endpoint_remains_backward_compatible(sample_cv: dict, sample_job: dict) -> None:
    response = TestClient(create_app()).post("/api/v1/match", json={"cv": sample_cv, "job": sample_job})
    assert response.status_code == 200
    assert response.json()["overall_score"] == 97.5
    assert "scores" in response.json()
