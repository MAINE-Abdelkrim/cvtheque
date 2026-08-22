from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import pytest

from app.api.routes import session_view
from app.domain.interview_session import (
    AnswerEvaluation,
    CandidateAnswer,
    Difficulty,
    FinalInterviewReport,
    IntentGrounding,
    InterviewQuestion,
    InterviewSession,
    InterviewTurn,
    InterviewType,
    QuestionCategory,
    QuestionGroundingPolicy,
    QuestionIntent,
    SessionStatus,
)
from app.repositories.base import InterviewSessionRepository
from app.repositories.errors import (
    InterviewRepositoryError,
    InvalidStoredSessionError,
    RepositorySessionNotFoundError,
    SessionConflictError,
    UnsupportedStorageSchemaVersionError,
)
from app.repositories.firestore import FirestoreInterviewSessionRepository
from app.repositories.in_memory import InMemoryInterviewSessionRepository
from app.repositories.serialization import (
    deserialize_interview_session,
    serialize_interview_session,
    validate_persisted_session,
)
from app.schemas.cv_schema import CanonicalCV, CVExperience, CVSkill
from app.schemas.job_schema import JobContext
from tests.fake_firestore import FakeFirestoreClient


def firestore_repository_factory() -> InterviewSessionRepository:
    return FirestoreInterviewSessionRepository(FakeFirestoreClient())


@pytest.fixture(
    params=[InMemoryInterviewSessionRepository, firestore_repository_factory],
    ids=["in-memory", "firestore"],
)
def repository_factory(
    request: pytest.FixtureRequest,
) -> Callable[[], InterviewSessionRepository]:
    return request.param  # type: ignore[no-any-return]


def complete_session(session_id: str = "session-1") -> InterviewSession:
    question = InterviewQuestion(
        question_id="question-1",
        category=QuestionCategory.TECHNICAL,
        question="How would you structure a FastAPI service?",
        based_on=["cv:skill:FastAPI"],
        difficulty=Difficulty.MEDIUM,
    )
    intent = QuestionIntent(
        category=QuestionCategory.TECHNICAL,
        topic="FastAPI",
        source_refs=["cv:skill:FastAPI"],
        difficulty=Difficulty.MEDIUM,
        objective="Assess FastAPI design knowledge",
        grounding=IntentGrounding.CV,
        grounding_policy=QuestionGroundingPolicy.SKILL_ONLY,
        evidence=["FastAPI"],
    )
    evaluation = AnswerEvaluation(
        score=80,
        classification="good",
        strengths=["Used clear boundaries"],
        weaknesses=["Could add a concrete metric"],
        feedback="The fictional answer was relevant and structured.",
    )
    return InterviewSession(
        session_id=session_id,
        candidate_id="opaque-owner-1",
        interview_type=InterviewType.TECHNICAL,
        status=SessionStatus.COMPLETED,
        current_question_index=1,
        max_questions=1,
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
        completed_at=datetime(2026, 1, 1, 0, 5, tzinfo=UTC),
        cv=CanonicalCV(
            skills=[CVSkill(name="FastAPI")],
            experiences=[
                CVExperience(job_title="Backend Developer", company="Example Tech")
            ],
        ),
        job=JobContext(title="Backend Developer", required_skills=["FastAPI"]),
        turns=[
            InterviewTurn(
                question=question,
                intent=intent,
                answer=CandidateAnswer(
                    question_id=question.question_id,
                    answer="I separate transport, service, and persistence concerns.",
                ),
                evaluation=evaluation,
            )
        ],
        final_report=FinalInterviewReport(
            session_id=session_id,
            overall_score=80,
            classification="good",
            questions_answered=1,
            category_scores={"technical": 80},
            strengths=["Used clear boundaries"],
            areas_for_improvement=["Add metrics"],
            summary="The fictional response was relevant and structured.",
        ),
    )


async def test_repository_add_get_round_trip_and_isolation(
    repository_factory: Callable[[], InterviewSessionRepository],
) -> None:
    repository = repository_factory()
    original = complete_session()
    added = await repository.add(original)
    fetched = await repository.get(original.session_id)
    assert added == original
    assert fetched == original
    assert fetched is not None
    assert fetched.cv.skills[0].name == "FastAPI"
    assert fetched.job is not None and fetched.job.title == "Backend Developer"
    assert fetched.turns[0].intent is not None
    assert fetched.turns[0].evaluation is not None
    assert fetched.final_report is not None

    fetched.cv.skills[0].name = "mutated"
    isolated = await repository.get(original.session_id)
    assert isolated is not None
    assert isolated.cv.skills[0].name == "FastAPI"


async def test_repository_duplicate_add_is_rejected(
    repository_factory: Callable[[], InterviewSessionRepository],
) -> None:
    repository = repository_factory()
    session = complete_session()
    await repository.add(session)
    with pytest.raises(SessionConflictError):
        await repository.add(session)


async def test_repository_save_increments_version_and_rejects_stale_copy(
    repository_factory: Callable[[], InterviewSessionRepository],
) -> None:
    repository = repository_factory()
    await repository.add(complete_session())
    copy_a = await repository.get("session-1")
    copy_b = await repository.get("session-1")
    assert copy_a is not None and copy_b is not None
    assert copy_a.version == copy_b.version == 0

    assert copy_a.final_report is not None
    copy_a.final_report.summary = "Committed update from request A."
    committed = await repository.save(copy_a, expected_version=0)
    assert committed.version == 1

    assert copy_b.final_report is not None
    copy_b.final_report.summary = "Stale update from request B."
    with pytest.raises(SessionConflictError):
        await repository.save(copy_b, expected_version=0)
    stored = await repository.get("session-1")
    assert stored is not None and stored.final_report is not None
    assert stored.version == 1
    assert stored.final_report.summary == "Committed update from request A."


async def test_repository_nonexistent_save_is_controlled(
    repository_factory: Callable[[], InterviewSessionRepository],
) -> None:
    repository = repository_factory()
    with pytest.raises(RepositorySessionNotFoundError):
        await repository.save(complete_session("missing"), expected_version=0)


async def test_owner_read_does_not_reveal_mismatch(
    repository_factory: Callable[[], InterviewSessionRepository],
) -> None:
    repository = repository_factory()
    await repository.add(complete_session())
    assert await repository.get_for_owner("session-1", "opaque-owner-1") is not None
    assert await repository.get_for_owner("session-1", "another-owner") is None
    assert await repository.get_for_owner("missing", "opaque-owner-1") is None


async def test_owner_history_is_isolated_ordered_and_cursor_paginated(
    repository_factory: Callable[[], InterviewSessionRepository],
) -> None:
    repository = repository_factory()
    timestamps = [
        datetime(2026, 1, 3, tzinfo=UTC),
        datetime(2026, 1, 3, tzinfo=UTC),
        datetime(2026, 1, 2, tzinfo=UTC),
        datetime(2026, 1, 1, 12, tzinfo=UTC),
        datetime(2026, 1, 1, tzinfo=UTC),
    ]
    session_ids = ["session-e", "session-d", "session-c", "session-b", "session-a"]
    for session_id, created_at in zip(session_ids, timestamps, strict=True):
        session = complete_session(session_id).model_copy(
            update={
                "candidate_id": "owner-a",
                "created_at": created_at,
                "completed_at": created_at,
            },
            deep=True,
        )
        await repository.add(session)
    other_owner = complete_session("other-owner-session").model_copy(
        update={"candidate_id": "owner-b", "created_at": datetime(2027, 1, 1, tzinfo=UTC)},
        deep=True,
    )
    await repository.add(other_owner)

    collected: list[str] = []
    cursor = None
    page_sizes: list[int] = []
    while True:
        page = await repository.list_for_owner("owner-a", limit=2, cursor=cursor)
        page_sizes.append(len(page.sessions))
        collected.extend(session.session_id for session in page.sessions)
        if page.next_cursor is None:
            break
        cursor = page.next_cursor

    assert page_sizes == [2, 2, 1]
    assert collected == session_ids
    assert len(collected) == len(set(collected)) == 5
    assert "other-owner-session" not in collected

    isolated = await repository.list_for_owner("owner-a", limit=1)
    isolated.sessions[0].candidate_id = "mutated"
    stored = await repository.get(isolated.sessions[0].session_id)
    assert stored is not None and stored.candidate_id == "owner-a"


@pytest.mark.parametrize("limit", [0, 51])
async def test_owner_history_rejects_unbounded_limits(
    repository_factory: Callable[[], InterviewSessionRepository], limit: int
) -> None:
    with pytest.raises(ValueError, match="limit is invalid"):
        await repository_factory().list_for_owner("owner-a", limit=limit)


def test_storage_serialization_round_trip_and_schema_version() -> None:
    session = complete_session()
    document = serialize_interview_session(session)
    assert document["storage_schema_version"] == 1
    restored = deserialize_interview_session(document)
    assert restored == session
    assert restored.turns[0].intent == session.turns[0].intent

    future: dict[str, Any] = {**document, "storage_schema_version": 999}
    with pytest.raises(UnsupportedStorageSchemaVersionError):
        deserialize_interview_session(future)


@pytest.mark.parametrize(
    "session",
    [
        InterviewSession(
            session_id="invalid-in-progress",
            status=SessionStatus.IN_PROGRESS,
            max_questions=1,
            cv=CanonicalCV(),
        ),
        InterviewSession(
            session_id="invalid-cancelled",
            status=SessionStatus.CANCELLED,
            max_questions=1,
            cv=CanonicalCV(),
        ),
        complete_session().model_copy(update={"current_question_index": 0}),
        complete_session().model_copy(update={"completed_at": None}),
    ],
)
def test_impossible_persisted_states_are_rejected(session: InterviewSession) -> None:
    with pytest.raises(InvalidStoredSessionError):
        validate_persisted_session(session)


def test_public_session_view_omits_internal_persistence_and_ownership_fields() -> None:
    public = session_view(complete_session()).model_dump(mode="json")
    assert "candidate_id" not in public
    assert "version" not in public
    assert "storage_schema_version" not in public
    assert "cv" not in public
    assert "job" not in public


async def test_firestore_rejects_unsupported_schema_and_invalid_state() -> None:
    client = FakeFirestoreClient()
    repository = FirestoreInterviewSessionRepository(client)
    document = serialize_interview_session(complete_session())
    document.update(
        owner_id="opaque-owner-1",
        version=0,
        created_at="2026-01-01T00:00:00+00:00",
        status="COMPLETED",
    )
    document["storage_schema_version"] = 999
    client.inject_document("interviewSessions", "session-1", document)
    with pytest.raises(UnsupportedStorageSchemaVersionError):
        await repository.get("session-1")

    invalid = serialize_interview_session(complete_session())
    invalid["session"]["current_question_index"] = 0
    invalid.update(
        owner_id="opaque-owner-1",
        version=0,
        created_at="2026-01-01T00:00:00+00:00",
        status="COMPLETED",
    )
    client.inject_document("interviewSessions", "session-1", invalid)
    with pytest.raises(InvalidStoredSessionError):
        await repository.get("session-1")


async def test_firestore_metadata_must_match_nested_session() -> None:
    client = FakeFirestoreClient()
    repository = FirestoreInterviewSessionRepository(client)
    await repository.add(complete_session())
    client.documents[("interviewSessions", "session-1")]["owner_id"] = "wrong-owner"
    with pytest.raises(InvalidStoredSessionError):
        await repository.get("session-1")


async def test_firestore_failed_transaction_leaves_document_unchanged() -> None:
    client = FakeFirestoreClient()
    repository = FirestoreInterviewSessionRepository(client)
    await repository.add(complete_session())
    before = await repository.get("session-1")
    assert before is not None and before.final_report is not None
    update = before.model_copy(deep=True)
    assert update.final_report is not None
    update.final_report.summary = "This write must not become visible."
    client.fail_after_transaction_operation = True

    with pytest.raises(InterviewRepositoryError) as caught:
        await repository.save(update, expected_version=0)
    assert "private SDK" not in str(caught.value)

    client.fail_after_transaction_operation = False
    stored = await repository.get("session-1")
    assert stored == before


@pytest.mark.parametrize("operation", ["create", "read", "transaction"])
async def test_firestore_internal_errors_are_safely_mapped(operation: str) -> None:
    client = FakeFirestoreClient()
    repository = FirestoreInterviewSessionRepository(client)
    session = complete_session()
    if operation == "create":
        client.fail_creates = True
        action = repository.add(session)
    elif operation == "read":
        client.fail_reads = True
        action = repository.get(session.session_id)
    else:
        await repository.add(session)
        client.fail_transactions = True
        action = repository.save(session, expected_version=0)
    with pytest.raises(InterviewRepositoryError) as caught:
        await action
    assert str(caught.value) == "Interview session storage is unavailable"


async def test_firestore_history_query_errors_are_safely_mapped() -> None:
    client = FakeFirestoreClient()
    client.fail_queries = True
    repository = FirestoreInterviewSessionRepository(client)
    with pytest.raises(InterviewRepositoryError) as caught:
        await repository.list_for_owner("owner-a", limit=20)
    assert str(caught.value) == "Interview session storage is unavailable"
    assert "private SDK" not in str(caught.value)
