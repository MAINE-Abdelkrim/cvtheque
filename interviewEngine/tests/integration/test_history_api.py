import base64
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.api.dependencies import get_interview_service
from app.api.fastapi_app import create_app
from app.config.settings import Settings, get_settings
from app.domain.interview_session import InterviewSession, InterviewType, SessionStatus
from app.providers.mock_provider import MockLLMProvider
from app.repositories.in_memory import InMemoryInterviewSessionRepository
from app.schemas.cv_schema import CanonicalCV
from app.services.interview_service import InterviewService
from app.strategies.deterministic import DeterministicInterviewPlanner
from tests.unit.test_repository_contract import complete_session

TOKEN = "fictional-history-service-token"
OWNER_A = "opaque-history-owner-a"
OWNER_B = "opaque-history-owner-b"


@pytest.fixture
async def history_api() -> AsyncIterator[
    tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository]
]:
    settings = Settings(
        _env_file=None,
        interview_provider="mock",
        interview_internal_auth_enabled=True,
        interview_internal_api_token=TOKEN,
    )
    repository = InMemoryInterviewSessionRepository()
    service = InterviewService(
        repository, MockLLMProvider(), DeterministicInterviewPlanner()
    )
    application = create_app(settings)
    application.dependency_overrides[get_settings] = lambda: settings
    application.dependency_overrides[get_interview_service] = lambda: service
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, repository


def headers(owner_id: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {TOKEN}",
        "X-Interview-Owner-Id": owner_id,
    }


def created_session(session_id: str, owner_id: str, created_at: datetime) -> InterviewSession:
    return InterviewSession(
        session_id=session_id,
        candidate_id=owner_id,
        interview_type=InterviewType.TECHNICAL,
        status=SessionStatus.CREATED,
        max_questions=5,
        created_at=created_at,
        cv=CanonicalCV(),
    )


async def test_history_summary_is_owner_scoped_and_strictly_private(
    history_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
) -> None:
    client, repository = history_api
    completed = complete_session("completed-a").model_copy(
        update={"candidate_id": OWNER_A}, deep=True
    )
    await repository.add(completed)
    await repository.add(
        created_session("created-b", OWNER_B, datetime(2027, 1, 1, tzinfo=UTC))
    )

    response = await client.get("/api/v1/interviews", headers=headers(OWNER_A))

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    item = response.json()["items"][0]
    assert set(item) == {
        "session_id",
        "interview_type",
        "status",
        "created_at",
        "completed_at",
        "questions_answered",
        "max_questions",
        "overall_score",
        "classification",
    }
    assert item["session_id"] == "completed-a"
    assert item["questions_answered"] == 1
    assert item["overall_score"] == 80
    assert item["classification"] == "good"
    serialized = response.text.lower()
    for forbidden in (
        "candidate_id",
        "owner_id",
        '"cv"',
        '"job"',
        '"turns"',
        '"answer"',
        '"question"',
        '"evaluation"',
        '"summary"',
        '"strengths"',
        '"weaknesses"',
        '"version"',
        "storage_schema_version",
        "provider",
    ):
        assert forbidden not in serialized


async def test_history_pagination_has_no_duplicates_or_missing_sessions(
    history_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
) -> None:
    client, repository = history_api
    base = datetime(2026, 1, 1, tzinfo=UTC)
    expected = ["session-4", "session-3", "session-2", "session-1", "session-0"]
    for index in range(5):
        await repository.add(
            created_session(f"session-{index}", OWNER_A, base + timedelta(days=index))
        )

    collected: list[str] = []
    cursor = None
    page_lengths: list[int] = []
    while True:
        params = {"page_size": "2"}
        if cursor is not None:
            params["cursor"] = cursor
        response = await client.get(
            "/api/v1/interviews", headers=headers(OWNER_A), params=params
        )
        assert response.status_code == 200
        body = response.json()
        page_lengths.append(len(body["items"]))
        assert all(item["overall_score"] is None for item in body["items"])
        assert all(item["classification"] is None for item in body["items"])
        collected.extend(item["session_id"] for item in body["items"])
        cursor = body["next_cursor"]
        if cursor is None:
            break

    assert page_lengths == [2, 2, 1]
    assert collected == expected
    assert len(collected) == len(set(collected)) == 5


async def test_history_default_and_bounded_page_sizes(
    history_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
) -> None:
    client, repository = history_api
    base = datetime(2026, 1, 1, tzinfo=UTC)
    for index in range(21):
        await repository.add(
            created_session(f"default-{index:02}", OWNER_A, base + timedelta(minutes=index))
        )

    default_page = await client.get("/api/v1/interviews", headers=headers(OWNER_A))
    minimum = await client.get(
        "/api/v1/interviews", headers=headers(OWNER_A), params={"page_size": 1}
    )
    maximum = await client.get(
        "/api/v1/interviews", headers=headers(OWNER_A), params={"page_size": 50}
    )
    zero = await client.get(
        "/api/v1/interviews", headers=headers(OWNER_A), params={"page_size": 0}
    )
    excessive = await client.get(
        "/api/v1/interviews", headers=headers(OWNER_A), params={"page_size": 51}
    )

    assert len(default_page.json()["items"]) == 20
    assert default_page.json()["next_cursor"] is not None
    assert len(minimum.json()["items"]) == 1
    assert len(maximum.json()["items"]) == 21
    assert zero.status_code == excessive.status_code == 422


@pytest.mark.parametrize(
    "cursor",
    [
        "not-valid-base64!",
        base64.urlsafe_b64encode(b"not json").decode("ascii"),
        base64.urlsafe_b64encode(b'{"created_at":"2026-01-01T00:00:00+00:00"}').decode(
            "ascii"
        ),
    ],
)
async def test_malformed_history_cursor_has_safe_error(
    history_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
    cursor: str,
) -> None:
    client, _ = history_api
    response = await client.get(
        "/api/v1/interviews",
        headers=headers(OWNER_A),
        params={"cursor": cursor},
    )
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "INVALID_CURSOR",
            "message": "The pagination cursor is invalid.",
        }
    }
    assert "created_at" not in response.text


async def test_oversized_history_cursor_is_rejected(
    history_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
) -> None:
    client, _ = history_api
    response = await client.get(
        "/api/v1/interviews",
        headers=headers(OWNER_A),
        params={"cursor": "a" * 1_025},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_CURSOR"


async def test_history_cursor_contains_no_owner_and_cannot_cross_owner_boundary(
    history_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
) -> None:
    client, repository = history_api
    base = datetime(2026, 1, 1, tzinfo=UTC)
    await repository.add(created_session("a-new", OWNER_A, base + timedelta(days=2)))
    await repository.add(created_session("a-old", OWNER_A, base + timedelta(days=1)))
    await repository.add(created_session("b-old", OWNER_B, base))
    first = await client.get(
        "/api/v1/interviews",
        headers=headers(OWNER_A),
        params={"page_size": 1},
    )
    cursor = first.json()["next_cursor"]
    assert cursor is not None
    assert OWNER_A not in cursor and OWNER_B not in cursor

    owner_b = await client.get(
        "/api/v1/interviews",
        headers=headers(OWNER_B),
        params={"cursor": cursor},
    )
    assert [item["session_id"] for item in owner_b.json()["items"]] == ["b-old"]


async def test_history_auth_and_owner_source_are_enforced(
    history_api: tuple[httpx.AsyncClient, InMemoryInterviewSessionRepository],
) -> None:
    client, repository = history_api
    await repository.add(
        created_session("owner-b-session", OWNER_B, datetime(2026, 1, 1, tzinfo=UTC))
    )
    missing_auth = await client.get("/api/v1/interviews")
    supplied_query_owner = await client.get(
        "/api/v1/interviews",
        headers=headers(OWNER_A),
        params={"owner_id": OWNER_B},
    )
    assert missing_auth.status_code == 401
    assert supplied_query_owner.status_code == 200
    assert supplied_query_owner.json()["items"] == []


async def test_history_is_unavailable_without_trusted_principal() -> None:
    settings = Settings(_env_file=None, interview_internal_auth_enabled=False)
    application = create_app(settings)
    service = InterviewService(
        InMemoryInterviewSessionRepository(),
        MockLLMProvider(),
        DeterministicInterviewPlanner(),
    )
    application.dependency_overrides[get_settings] = lambda: settings
    application.dependency_overrides[get_interview_service] = lambda: service
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/interviews", headers={"X-Interview-Owner-Id": OWNER_A}
        )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "OWNER_CONTEXT_REQUIRED"
