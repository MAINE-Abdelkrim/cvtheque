import json
import logging
from collections.abc import AsyncIterator

import httpx
import pytest
from pydantic import ValidationError

from app.api import authentication
from app.api.dependencies import get_interview_service
from app.api.fastapi_app import app
from app.config.settings import Settings, get_settings
from app.providers.mock_provider import MockLLMProvider
from app.repositories.in_memory import InMemoryInterviewSessionRepository
from app.services.interview_service import InterviewService
from app.strategies.deterministic import DeterministicInterviewPlanner

INTERNAL_TOKEN = "fictional-current-secret-do-not-expose"
PREVIOUS_TOKEN = "fictional-previous-secret-do-not-expose"
OWNER_A = "opaque-owner-a"
OWNER_B = "opaque-owner-b"


@pytest.fixture
async def authenticated_api() -> AsyncIterator[
    tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository]
]:
    repository = InMemoryInterviewSessionRepository()
    service = InterviewService(
        repository, MockLLMProvider(), DeterministicInterviewPlanner()
    )
    settings = Settings(
        _env_file=None,
        interview_internal_auth_enabled=True,
        interview_internal_api_token=INTERNAL_TOKEN,
        interview_internal_api_token_previous=PREVIOUS_TOKEN,
        interview_provider="mock",
    )
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_interview_service] = lambda: service
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        yield client, repository
    app.dependency_overrides.clear()


def trusted_headers(owner_id: str = OWNER_A) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {INTERNAL_TOKEN}",
        "X-Interview-Owner-Id": owner_id,
    }


def previous_token_headers(owner_id: str = OWNER_A) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {PREVIOUS_TOKEN}",
        "X-Interview-Owner-Id": owner_id,
    }


async def create_interview(
    client: httpx.AsyncClient, owner_id: str = OWNER_A, *, max_questions: int = 2
) -> httpx.Response:
    return await client.post(
        "/api/v1/interviews",
        headers=trusted_headers(owner_id),
        json={"cv": {}, "max_questions": max_questions},
    )


def test_auth_disabled_without_token_is_valid() -> None:
    settings = Settings(
        _env_file=None,
        interview_internal_auth_enabled=False,
        interview_internal_api_token=None,
    )
    assert settings.interview_internal_api_token is None


@pytest.mark.parametrize("token", [None, "   "])
def test_auth_enabled_without_usable_current_token_fails_configuration(
    token: str | None,
) -> None:
    with pytest.raises(ValidationError, match="Internal API token is required") as caught:
        Settings(
            _env_file=None,
            interview_internal_auth_enabled=True,
            interview_internal_api_token=token,
        )
    assert INTERNAL_TOKEN not in str(caught.value)
    assert PREVIOUS_TOKEN not in str(caught.value)


def test_current_only_and_current_plus_previous_are_valid() -> None:
    current_only = Settings(
        _env_file=None,
        interview_internal_auth_enabled=True,
        interview_internal_api_token=INTERNAL_TOKEN,
    )
    rotating = Settings(
        _env_file=None,
        interview_internal_auth_enabled=True,
        interview_internal_api_token=INTERNAL_TOKEN,
        interview_internal_api_token_previous=PREVIOUS_TOKEN,
    )
    assert current_only.interview_internal_api_token_previous is None
    assert rotating.interview_internal_api_token_previous is not None


def test_identical_current_and_previous_tokens_are_rejected_without_exposure() -> None:
    with pytest.raises(ValidationError, match="must differ") as caught:
        Settings(
            _env_file=None,
            interview_internal_auth_enabled=True,
            interview_internal_api_token=INTERNAL_TOKEN,
            interview_internal_api_token_previous=INTERNAL_TOKEN,
        )
    assert INTERNAL_TOKEN not in str(caught.value)


def test_blank_previous_token_is_normalized_to_absent() -> None:
    settings = Settings(
        _env_file=None,
        interview_internal_auth_enabled=True,
        interview_internal_api_token=INTERNAL_TOKEN,
        interview_internal_api_token_previous="   ",
    )
    assert settings.interview_internal_api_token_previous is None


@pytest.mark.parametrize(
    ("authorization", "expected_code"),
    [
        (None, "AUTH_REQUIRED"),
        ("Basic abc", "AUTH_INVALID"),
        ("Bearer", "AUTH_INVALID"),
        ("Bearer wrong-token", "AUTH_INVALID"),
    ],
)
async def test_authentication_rejects_missing_malformed_and_wrong_tokens(
    authenticated_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
    authorization: str | None,
    expected_code: str,
) -> None:
    client, _ = authenticated_api
    headers = {"X-Interview-Owner-Id": OWNER_A}
    if authorization is not None:
        headers["Authorization"] = authorization

    response = await client.post("/api/v1/interviews", headers=headers, json={"cv": {}})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == expected_code
    assert INTERNAL_TOKEN not in response.text
    assert "wrong-token" not in response.text


@pytest.mark.parametrize("owner_id", [None, "   ", "x" * 129])
async def test_owner_context_is_required_and_bounded(
    authenticated_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
    owner_id: str | None,
) -> None:
    client, _ = authenticated_api
    headers = {"Authorization": f"Bearer {INTERNAL_TOKEN}"}
    if owner_id is not None:
        headers["X-Interview-Owner-Id"] = owner_id

    response = await client.post("/api/v1/interviews", headers=headers, json={"cv": {}})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "OWNER_CONTEXT_REQUIRED"
    assert INTERNAL_TOKEN not in response.text
    if owner_id is not None:
        assert owner_id not in response.text


async def test_valid_auth_uses_comparison_helper_and_trusted_create_owner(
    authenticated_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, repository = authenticated_api
    comparisons: list[tuple[str, str]] = []
    original_comparison = authentication._internal_tokens_match

    def checked_comparison(supplied: str, expected: str) -> bool:
        comparisons.append((supplied, expected))
        return original_comparison(supplied, expected)

    monkeypatch.setattr(authentication, "_internal_tokens_match", checked_comparison)
    response = await client.post(
        "/api/v1/interviews",
        headers={
            **trusted_headers(),
            "X-Forwarded-For": "203.0.113.20",
            "X-Forwarded-Host": "untrusted.example",
            "Forwarded": "for=203.0.113.20;host=untrusted.example",
        },
        json={"candidate_id": OWNER_B, "cv": {}},
    )

    assert response.status_code == 201
    assert len(comparisons) == 2
    session_id = response.json()["session"]["session_id"]
    stored = await repository.get(session_id)
    assert stored is not None and stored.candidate_id == OWNER_A
    assert OWNER_A not in response.text
    assert OWNER_B not in response.text
    assert INTERNAL_TOKEN not in response.text
    assert PREVIOUS_TOKEN not in response.text


async def test_previous_token_is_accepted_during_rotation(
    authenticated_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
) -> None:
    client, _ = authenticated_api
    response = await client.post(
        "/api/v1/interviews",
        headers=previous_token_headers(),
        json={"cv": {}},
    )
    assert response.status_code == 201
    assert INTERNAL_TOKEN not in response.text
    assert PREVIOUS_TOKEN not in response.text


async def test_previous_token_is_rejected_after_rotation_window_closes(
    authenticated_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
) -> None:
    client, _ = authenticated_api
    current_only = Settings(
        _env_file=None,
        interview_internal_auth_enabled=True,
        interview_internal_api_token=INTERNAL_TOKEN,
        interview_internal_api_token_previous=None,
        interview_provider="mock",
    )
    app.dependency_overrides[get_settings] = lambda: current_only
    response = await client.post(
        "/api/v1/interviews",
        headers=previous_token_headers(),
        json={"cv": {}},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_INVALID"
    assert INTERNAL_TOKEN not in response.text
    assert PREVIOUS_TOKEN not in response.text


async def test_tokens_are_absent_from_settings_schema_responses_logs_and_sessions(
    authenticated_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
    caplog: pytest.LogCaptureFixture,
) -> None:
    client, repository = authenticated_api
    settings = Settings(
        _env_file=None,
        interview_internal_auth_enabled=True,
        interview_internal_api_token=INTERNAL_TOKEN,
        interview_internal_api_token_previous=PREVIOUS_TOKEN,
    )
    caplog.set_level(logging.DEBUG)
    response = await client.post(
        "/api/v1/interviews", headers=trusted_headers(), json={"cv": {}}
    )
    session_id = response.json()["session"]["session_id"]
    session = await repository.get(session_id)
    exposed_surfaces = [
        repr(settings),
        str(settings.model_dump()),
        settings.model_dump_json(),
        json.dumps(app.openapi()),
        response.text,
        caplog.text,
        repr(session),
        session.model_dump_json() if session is not None else "",
    ]
    for surface in exposed_surfaces:
        assert INTERNAL_TOKEN not in surface
        assert PREVIOUS_TOKEN not in surface


async def test_read_owner_isolation_conceals_mismatch_like_missing_session(
    authenticated_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
) -> None:
    client, _ = authenticated_api
    created = await create_interview(client)
    session_id = created.json()["session"]["session_id"]

    allowed = await client.get(
        f"/api/v1/interviews/{session_id}", headers=trusted_headers(OWNER_A)
    )
    denied = await client.get(
        f"/api/v1/interviews/{session_id}", headers=trusted_headers(OWNER_B)
    )
    missing = await client.get(
        "/api/v1/interviews/missing-session", headers=trusted_headers(OWNER_B)
    )

    assert allowed.status_code == 200
    assert denied.status_code == missing.status_code == 404
    assert denied.json() == missing.json()
    assert denied.json()["error"]["code"] == "SESSION_NOT_FOUND"
    assert OWNER_A not in denied.text and OWNER_B not in denied.text


async def test_answer_is_owner_scoped_and_wrong_owner_cannot_mutate(
    authenticated_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
) -> None:
    client, repository = authenticated_api
    created = await create_interview(client)
    session_id = created.json()["session"]["session_id"]
    question_id = created.json()["first_question"]["question_id"]

    denied = await client.post(
        f"/api/v1/interviews/{session_id}/answers",
        headers=trusted_headers(OWNER_B),
        json={"question_id": question_id, "answer": "A fictional answer."},
    )
    unchanged = await repository.get(session_id)
    allowed = await client.post(
        f"/api/v1/interviews/{session_id}/answers",
        headers=trusted_headers(OWNER_A),
        json={"question_id": question_id, "answer": "A fictional answer."},
    )

    assert denied.status_code == 404
    assert denied.json()["error"]["code"] == "SESSION_NOT_FOUND"
    assert unchanged is not None and unchanged.current_question_index == 0
    assert unchanged.turns[0].answer is None
    assert allowed.status_code == 200


async def test_cancel_is_owner_scoped_and_wrong_owner_cannot_mutate(
    authenticated_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
) -> None:
    client, repository = authenticated_api
    created = await create_interview(client)
    session_id = created.json()["session"]["session_id"]

    denied = await client.post(
        f"/api/v1/interviews/{session_id}/cancel", headers=trusted_headers(OWNER_B)
    )
    unchanged = await repository.get(session_id)
    allowed = await client.post(
        f"/api/v1/interviews/{session_id}/cancel", headers=trusted_headers(OWNER_A)
    )

    assert denied.status_code == 404
    assert denied.json()["error"]["code"] == "SESSION_NOT_FOUND"
    assert unchanged is not None and unchanged.status.value == "IN_PROGRESS"
    assert allowed.status_code == 200
    assert allowed.json()["status"] == "CANCELLED"
