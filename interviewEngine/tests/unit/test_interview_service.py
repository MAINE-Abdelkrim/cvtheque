import asyncio

import pytest

from app.domain.interview_session import (
    AnswerEvaluation,
    InterviewQuestion,
    InterviewSession,
    InterviewType,
    QuestionIntent,
    SessionStatus,
)
from app.providers.mock_provider import MockLLMProvider
from app.repositories.errors import SessionConflictError
from app.repositories.in_memory import InMemoryInterviewSessionRepository
from app.schemas.cv_schema import CanonicalCV
from app.services.errors import (
    AnswerAlreadySubmittedError,
    InvalidSessionStateError,
    QuestionMismatchError,
    SessionNotFoundError,
)
from app.services.interview_service import InterviewService
from app.strategies.deterministic import DeterministicInterviewPlanner


class PausingEvaluationProvider:
    def __init__(self) -> None:
        self.delegate = MockLLMProvider()
        self.evaluation_started = asyncio.Event()
        self.allow_evaluation = asyncio.Event()

    async def generate_question(
        self, session: InterviewSession, intent: QuestionIntent
    ) -> InterviewQuestion:
        return await self.delegate.generate_question(session, intent)

    async def evaluate_answer(
        self, session: InterviewSession, question: InterviewQuestion, answer: str
    ) -> AnswerEvaluation:
        self.evaluation_started.set()
        await self.allow_evaluation.wait()
        return await self.delegate.evaluate_answer(session, question, answer)


async def create(service: InterviewService, cv_payload: dict[str, object], max_questions: int = 3):
    return await service.create_session(
        cv=CanonicalCV.model_validate(cv_payload),
        candidate_id="candidate-123",
        job=None,
        interview_type=InterviewType.MIXED,
        max_questions=max_questions,
    )


@pytest.mark.asyncio
async def test_session_creation_generates_cv_based_first_question(
    service: InterviewService, cv_payload: dict[str, object]
) -> None:
    session = await create(service, cv_payload)
    assert session.status is SessionStatus.IN_PROGRESS
    assert len(session.turns) == 1
    assert "Backend Developer" in session.turns[0].question.question
    assert session.turns[0].question.based_on == ["cv:job_title:Backend Developer"]


@pytest.mark.asyncio
async def test_answer_is_evaluated_and_next_question_generated(
    service: InterviewService, cv_payload: dict[str, object]
) -> None:
    session = await create(service, cv_payload)
    first_id = session.turns[0].question.question_id
    updated = await service.submit_answer(
        session.session_id,
        first_id,
        "For example, I built FastAPI services and improved the release process for the team.",
    )
    assert updated.turns[0].answer is not None
    assert updated.turns[0].evaluation is not None
    assert 0 <= updated.turns[0].evaluation.score <= 100
    assert len(updated.turns) == 2
    assert updated.turns[1].question.question_id != first_id
    assert updated.version == 1


@pytest.mark.asyncio
async def test_session_completes_at_limit_and_builds_report(
    service: InterviewService, cv_payload: dict[str, object]
) -> None:
    session = await create(service, cv_payload, max_questions=2)
    for _ in range(2):
        question = session.turns[-1].question
        session = await service.submit_answer(
            session.session_id,
            question.question_id,
            "I handled this work carefully because the result needed to be reliable for users.",
        )
    assert session.status is SessionStatus.COMPLETED
    assert session.completed_at is not None
    assert session.final_report is not None
    assert session.final_report.questions_answered == 2
    assert session.final_report.overall_score > 0
    assert len(session.turns) == 2


@pytest.mark.asyncio
async def test_invalid_session_is_rejected(service: InterviewService) -> None:
    with pytest.raises(SessionNotFoundError):
        await service.get_session("does-not-exist")


@pytest.mark.asyncio
async def test_wrong_question_id_is_rejected(
    service: InterviewService, cv_payload: dict[str, object]
) -> None:
    session = await create(service, cv_payload)
    with pytest.raises(QuestionMismatchError):
        await service.submit_answer(session.session_id, "wrong", "A valid non-empty answer")


@pytest.mark.asyncio
async def test_same_question_cannot_be_answered_twice(
    service: InterviewService, cv_payload: dict[str, object]
) -> None:
    session = await create(service, cv_payload)
    question_id = session.turns[0].question.question_id
    await service.submit_answer(session.session_id, question_id, "A first useful answer")
    with pytest.raises(AnswerAlreadySubmittedError):
        await service.submit_answer(session.session_id, question_id, "A second answer")


@pytest.mark.asyncio
async def test_completed_session_rejects_answers(
    service: InterviewService, cv_payload: dict[str, object]
) -> None:
    session = await create(service, cv_payload, max_questions=1)
    question_id = session.turns[0].question.question_id
    await service.submit_answer(session.session_id, question_id, "A complete answer")
    with pytest.raises(InvalidSessionStateError):
        await service.submit_answer(session.session_id, question_id, "Another answer")


@pytest.mark.asyncio
async def test_empty_cv_gets_safe_fallback_question(service: InterviewService) -> None:
    session = await create(service, {}, max_questions=1)
    assert "professional background" in session.turns[0].question.question.lower()
    assert session.turns[0].question.based_on == []


@pytest.mark.asyncio
async def test_sessions_are_isolated(
    service: InterviewService, cv_payload: dict[str, object]
) -> None:
    first = await create(service, cv_payload)
    second = await create(service, cv_payload)
    await service.submit_answer(first.session_id, first.turns[0].question.question_id, "Answer")
    unchanged = await service.get_session(second.session_id)
    assert unchanged.current_question_index == 0
    assert unchanged.turns[0].answer is None
    assert first.session_id != second.session_id


@pytest.mark.asyncio
async def test_contact_details_do_not_leak_into_questions(service: InterviewService) -> None:
    cv = {
        "identity": {"full_name": "person@example.com", "job_title": "+212 612 345 678"},
        "skills": [{"name": "secret@example.com"}, {"name": "+1 (555) 123-4567"}],
        "experiences": [{"job_title": "person@example.com", "company": "+33123456789"}],
    }
    session = await create(service, cv, max_questions=1)
    text = session.turns[0].question.question
    assert "@" not in text
    assert "+212" not in text
    assert "+1" not in text


@pytest.mark.asyncio
async def test_mock_evaluation_is_deterministic(
    service: InterviewService, cv_payload: dict[str, object]
) -> None:
    first = await create(service, cv_payload, max_questions=1)
    second = await create(service, cv_payload, max_questions=1)
    answer = "For example, I owned the API result and improved delivery for the team."
    result_one = await service.submit_answer(
        first.session_id, first.turns[0].question.question_id, answer
    )
    result_two = await service.submit_answer(
        second.session_id, second.turns[0].question.question_id, answer
    )
    assert result_one.turns[0].evaluation == result_two.turns[0].evaluation


async def test_stale_service_transition_cannot_overwrite_newer_commit() -> None:
    repository = InMemoryInterviewSessionRepository()
    pausing_provider = PausingEvaluationProvider()
    planner = DeterministicInterviewPlanner()
    submitting_service = InterviewService(repository, pausing_provider, planner)
    competing_service = InterviewService(repository, MockLLMProvider(), planner)
    session = await submitting_service.create_session(
        cv=CanonicalCV(),
        candidate_id="opaque-owner",
        job=None,
        interview_type=InterviewType.MIXED,
        max_questions=2,
    )

    stale_transition = asyncio.create_task(
        submitting_service.submit_answer(
            session.session_id,
            session.turns[0].question.question_id,
            "A fictional answer being evaluated concurrently.",
        )
    )
    await pausing_provider.evaluation_started.wait()
    cancelled = await competing_service.cancel_session(session.session_id)
    assert cancelled.version == 1
    pausing_provider.allow_evaluation.set()

    with pytest.raises(SessionConflictError):
        await stale_transition
    stored = await competing_service.get_session(session.session_id)
    assert stored.status is SessionStatus.CANCELLED
    assert stored.version == 1
    assert stored.turns[0].answer is None
    assert stored.turns[0].evaluation is None
    assert len(stored.turns) == 1
