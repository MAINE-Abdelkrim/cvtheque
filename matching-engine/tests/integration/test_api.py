from fastapi.testclient import TestClient

from app.api.fastapi_app import create_app


def test_health_and_version() -> None:
    client = TestClient(create_app())
    assert client.get("/health").json() == {"status": "ok", "service": "matching-engine", "version": "1.0.0"}
    assert client.get("/version").status_code == 200


def test_valid_match_request(sample_cv: dict, sample_job: dict) -> None:
    response = TestClient(create_app()).post("/api/v1/match", json={"cv": sample_cv, "job": sample_job})
    assert response.status_code == 200
    assert response.json()["overall_score"] == 97.5


def test_explanation_option(sample_cv: dict, sample_job: dict) -> None:
    response = TestClient(create_app()).post("/api/v1/match", json={"cv": sample_cv, "job": sample_job, "options": {"include_explanation": False}})
    assert response.json()["explanation"] is None


def test_invalid_cv_and_job_mapping() -> None:
    client = TestClient(create_app())
    cv_response = client.post("/api/v1/match", json={"cv": {"skills": "bad"}, "job": {}})
    job_response = client.post("/api/v1/match", json={"cv": {}, "job": {"minimum_experience_years": -1}})
    assert cv_response.status_code == 422
    assert cv_response.json()["error"]["code"] == "INVALID_CV_PAYLOAD"
    assert job_response.json()["error"]["code"] == "INVALID_JOB_PAYLOAD"


def test_invalid_outer_request_contract() -> None:
    response = TestClient(create_app()).post("/api/v1/match", json={"cv": {}})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_unsupported_version() -> None:
    response = TestClient(create_app()).post("/api/v1/match", json={"cv": {"schema_version": "2.0"}, "job": {}})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "UNSUPPORTED_SCHEMA_VERSION"


class BrokenService:
    def match(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        raise RuntimeError("secret stack detail")


def test_internal_error_is_safe() -> None:
    client = TestClient(create_app(BrokenService()), raise_server_exceptions=False)  # type: ignore[arg-type]
    response = client.post("/api/v1/match", json={"cv": {}, "job": {}})
    assert response.status_code == 500
    assert "secret" not in response.text


def test_request_size_limit() -> None:
    response = TestClient(create_app()).post("/api/v1/match", content=b"{}", headers={"content-type": "application/json", "content-length": "1048577"})
    assert response.status_code == 413
