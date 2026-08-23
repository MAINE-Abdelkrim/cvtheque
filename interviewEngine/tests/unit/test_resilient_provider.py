import logging

import pytest

from app.config.settings import Settings
from app.domain.interview_session import (
    Difficulty,
    IntentGrounding,
    InterviewSession,
    InterviewType,
    QuestionCategory,
    QuestionIntent,
)
from app.providers.errors import (
    ProviderConfigurationError,
    ProviderInvalidResponseError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from app.providers.factory import create_provider
from app.providers.mock_provider import MockLLMProvider
from app.providers.resilient import ResilientInterviewProvider
from app.repositories.in_memory import InMemoryInterviewSessionRepository
from app.schemas.cv_schema import CanonicalCV, CVSkill
from app.services.interview_service import InterviewService
from app.strategies.deterministic import DeterministicInterviewPlanner
from tests.fake_providers import (
    AlwaysUnavailableProvider,
    CountingProvider,
    EvaluationUnavailableProvider,
    FailAfterFirstQuestionProvider,
    InvalidQuestionProvider,
    InvalidScoreProvider,
    MetadataChangingProvider,
    SlowProvider,
)


def sample_session(max_questions: int = 2) -> InterviewSession:
    return InterviewSession(
        session_id="4a7bc59e-d895-4124-85c8-05eddb821cab",
        interview_type=InterviewType.TECHNICAL,
        max_questions=max_questions,
        cv=CanonicalCV(skills=[CVSkill(name="FastAPI")]),
    )


def sample_intent() -> QuestionIntent:
    return QuestionIntent(
        category=QuestionCategory.TECHNICAL,
        topic="FastAPI",
        source_refs=["cv:skill:FastAPI"],
        difficulty=Difficulty.MEDIUM,
        objective="Assess technical decisions involving FastAPI",
        grounding=IntentGrounding.CV,
    )


def resilient(
    primary: object,
    *,
    fallback: object | None = None,
    timeout: float = 1.0,
    retries: int = 0,
) -> ResilientInterviewProvider:
    return ResilientInterviewProvider(
        primary=primary,  # type: ignore[arg-type]
        primary_name="fake-primary",
        fallback=fallback,  # type: ignore[arg-type]
        fallback_name="mock" if fallback else None,
        timeout_seconds=timeout,
        max_retries=retries,
    )


async def test_successful_provider_request() -> None:
    primary = CountingProvider()
    question = await resilient(primary).generate_question(sample_session(), sample_intent())
    assert question.category is QuestionCategory.TECHNICAL
    assert primary.question_calls == 1


async def test_provider_timeout() -> None:
    with pytest.raises(ProviderTimeoutError):
        await resilient(SlowProvider(), timeout=0.001).generate_question(
            sample_session(), sample_intent()
        )


async def test_transient_failure_is_retried_then_succeeds() -> None:
    primary = CountingProvider(question_failures=1)
    question = await resilient(primary, retries=1).generate_question(
        sample_session(), sample_intent()
    )
    assert question.question
    assert primary.question_calls == 2


async def test_retry_limit_is_enforced() -> None:
    primary = AlwaysUnavailableProvider()
    with pytest.raises(ProviderUnavailableError):
        await resilient(primary, retries=1).generate_question(sample_session(), sample_intent())
    assert primary.question_calls == 2


async def test_fallback_activated_after_primary_failure() -> None:
    primary = AlwaysUnavailableProvider()
    question = await resilient(primary, fallback=MockLLMProvider()).generate_question(
        sample_session(), sample_intent()
    )
    assert question.category is sample_intent().category
    assert primary.question_calls == 1


async def test_operational_logs_exclude_private_content(
    caplog: pytest.LogCaptureFixture,
) -> None:
    private_answer = "PRIVATE-ANSWER-CONTENT"
    current = sample_session()
    question = await MockLLMProvider().generate_question(current, sample_intent())
    with caplog.at_level(logging.INFO, logger="app.providers.resilient"):
        await resilient(CountingProvider()).evaluate_answer(current, question, private_answer)
    combined = " ".join(record.getMessage() for record in caplog.records)
    assert private_answer not in combined
    assert "evaluate_answer" in combined
    assert current.session_id not in combined


async def test_fallback_disabled_propagates_safe_failure() -> None:
    with pytest.raises(ProviderUnavailableError):
        await resilient(AlwaysUnavailableProvider()).generate_question(
            sample_session(), sample_intent()
        )


async def test_invalid_question_response_is_rejected_without_retry() -> None:
    primary = InvalidQuestionProvider()
    with pytest.raises(ProviderInvalidResponseError):
        await resilient(primary, retries=3).generate_question(sample_session(), sample_intent())
    assert primary.question_calls == 1


async def test_invalid_score_is_rejected() -> None:
    current = sample_session()
    question = await MockLLMProvider().generate_question(current, sample_intent())
    with pytest.raises(ProviderInvalidResponseError):
        await resilient(InvalidScoreProvider()).evaluate_answer(current, question, "answer")


async def test_planner_metadata_cannot_be_changed() -> None:
    with pytest.raises(ProviderInvalidResponseError):
        await resilient(MetadataChangingProvider()).generate_question(
            sample_session(), sample_intent()
        )


def test_unsupported_provider_configuration() -> None:
    with pytest.raises(ProviderConfigurationError):
        create_provider(Settings(interview_provider="unsupported"))


async def test_creation_failure_does_not_persist_partial_session() -> None:
    primary = AlwaysUnavailableProvider()
    repository = InMemoryInterviewSessionRepository()
    service = InterviewService(
        repository,
        resilient(primary),
        DeterministicInterviewPlanner(),
    )
    with pytest.raises(ProviderUnavailableError):
        await service.create_session(
            cv=CanonicalCV(),
            candidate_id=None,
            job=None,
            interview_type=InterviewType.MIXED,
            max_questions=2,
        )
    assert primary.question_calls == 1
    assert repository._sessions == {}  # noqa: SLF001 - verifies storage atomicity


async def test_evaluation_failure_leaves_stored_turn_untouched() -> None:
    repository = InMemoryInterviewSessionRepository()
    provider = EvaluationUnavailableProvider()
    service = InterviewService(repository, resilient(provider), DeterministicInterviewPlanner())
    session = await service.create_session(
        cv=CanonicalCV(),
        candidate_id=None,
        job=None,
        interview_type=InterviewType.MIXED,
        max_questions=2,
    )
    with pytest.raises(ProviderUnavailableError):
        await service.submit_answer(
            session.session_id, session.turns[0].question.question_id, "unsaved answer"
        )
    stored = await service.get_session(session.session_id)
    assert stored.turns[0].answer is None
    assert stored.turns[0].evaluation is None
    assert stored.current_question_index == 0
    assert len(stored.turns) == 1


async def test_next_question_failure_does_not_save_evaluation_or_duplicate_turn() -> None:
    repository = InMemoryInterviewSessionRepository()
    primary = FailAfterFirstQuestionProvider()
    service = InterviewService(repository, resilient(primary), DeterministicInterviewPlanner())
    session = await service.create_session(
        cv=CanonicalCV(),
        candidate_id=None,
        job=None,
        interview_type=InterviewType.MIXED,
        max_questions=2,
    )
    with pytest.raises(ProviderUnavailableError):
        await service.submit_answer(
            session.session_id, session.turns[0].question.question_id, "unsaved answer"
        )
    stored = await service.get_session(session.session_id)
    assert len(stored.turns) == 1
    assert stored.turns[0].answer is None
    assert stored.turns[0].evaluation is None
    assert primary.question_calls == 2


async def test_retry_success_creates_only_one_turn() -> None:
    primary = CountingProvider(question_failures=1)
    service = InterviewService(
        InMemoryInterviewSessionRepository(),
        resilient(primary, retries=1),
        DeterministicInterviewPlanner(),
    )
    session = await service.create_session(
        cv=CanonicalCV(),
        candidate_id=None,
        job=None,
        interview_type=InterviewType.MIXED,
        max_questions=2,
    )
    assert primary.question_calls == 2
    assert len(session.turns) == 1


async def test_factory_mock_completes_interview_offline() -> None:
    service = InterviewService(
        InMemoryInterviewSessionRepository(),
        create_provider(Settings(interview_provider="mock")),
        DeterministicInterviewPlanner(),
    )
    session = await service.create_session(
        cv=CanonicalCV(skills=[CVSkill(name="FastAPI")]),
        candidate_id=None,
        job=None,
        interview_type=InterviewType.TECHNICAL,
        max_questions=1,
    )
    completed = await service.submit_answer(
        session.session_id,
        session.turns[0].question.question_id,
        "For example, I designed and tested an API and improved the result.",
    )
    assert completed.final_report is not None
    assert completed.final_report.questions_answered == 1
