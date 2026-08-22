from uuid import uuid4

import httpx
import pytest
from google.genai.errors import ClientError, ServerError

from app.domain.interview_session import (
    AnswerEvaluation,
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
)
from app.providers.errors import (
    ProviderFailureCause,
    ProviderInvalidResponseError,
    ProviderUnavailableError,
    ProviderValidationReason,
)
from app.providers.gemini_provider import GeminiInterviewProvider, classify_gemini_failure
from app.providers.validation import validate_evaluation, validate_question, validate_report
from app.schemas.cv_schema import CanonicalCV, CVSkill
from tests.fake_gemini import FakeGeminiClient


@pytest.mark.parametrize(
    ("failure", "expected"),
    [
        (ClientError(429, {"error": {"message": "sentinel"}}), ProviderFailureCause.RATE_LIMIT),
        (ClientError(401, {"error": {"message": "sentinel"}}), ProviderFailureCause.AUTHENTICATION),
        (ClientError(403, {"error": {"message": "sentinel"}}), ProviderFailureCause.PERMISSION),
        (
            ClientError(400, {"error": {"message": "sentinel"}}),
            ProviderFailureCause.MODEL_OR_REQUEST,
        ),
        (
            ClientError(404, {"error": {"message": "sentinel"}}),
            ProviderFailureCause.MODEL_OR_REQUEST,
        ),
        (ServerError(500, {"error": {"message": "sentinel"}}), ProviderFailureCause.SERVER),
        (ServerError(503, {"error": {"message": "sentinel"}}), ProviderFailureCause.SERVER),
        (httpx.ConnectError("sentinel"), ProviderFailureCause.TRANSPORT),
        (httpx.ReadTimeout("sentinel"), ProviderFailureCause.TIMEOUT),
        (RuntimeError("sentinel"), ProviderFailureCause.UNKNOWN),
    ],
)
def test_structured_gemini_failure_mapping(
    failure: Exception, expected: ProviderFailureCause
) -> None:
    assert classify_gemini_failure(failure) is expected


async def test_provider_error_is_generic_and_does_not_expose_sdk_message() -> None:
    sentinel = "SENTINEL_PRIVATE_SDK_MESSAGE"
    client = FakeGeminiClient([ClientError(429, {"error": {"message": sentinel}})])
    provider = GeminiInterviewProvider(client=client, model="fictional-model")  # type: ignore[arg-type]

    with pytest.raises(ProviderUnavailableError) as captured:
        await provider.generate_question(_session(), _intent())

    assert captured.value.cause is ProviderFailureCause.RATE_LIMIT
    assert str(captured.value) == "Gemini provider request failed"
    assert sentinel not in str(captured.value)
    assert sentinel not in repr(captured.value)


def _session() -> InterviewSession:
    return InterviewSession(
        session_id=str(uuid4()),
        interview_type=InterviewType.TECHNICAL,
        max_questions=1,
        cv=CanonicalCV(skills=[CVSkill(name="Python")]),
    )


def _intent() -> QuestionIntent:
    return QuestionIntent(
        category=QuestionCategory.TECHNICAL,
        topic="Python",
        source_refs=["cv:skill:Python"],
        difficulty=Difficulty.MEDIUM,
        objective="Assess Python decisions",
        grounding=IntentGrounding.CV,
        grounding_policy=QuestionGroundingPolicy.SKILL_ONLY,
        evidence=["Python"],
    )


def _question() -> InterviewQuestion:
    intent = _intent()
    return InterviewQuestion(
        question_id=str(uuid4()),
        category=intent.category,
        question="What factors matter when applying Python to an API?",
        based_on=intent.source_refs,
        difficulty=intent.difficulty,
    )


@pytest.mark.parametrize(
    ("updates", "previous", "expected"),
    [
        (
            {"category": QuestionCategory.BEHAVIORAL},
            None,
            ProviderValidationReason.CATEGORY_MISMATCH,
        ),
        ({"difficulty": Difficulty.HARD}, None, ProviderValidationReason.DIFFICULTY_MISMATCH),
        (
            {"based_on": ["job:skill:Python"]},
            None,
            ProviderValidationReason.SOURCE_REFERENCE_MISMATCH,
        ),
        (
            {},
            ["What factors matter when applying Python to an API?"],
            ProviderValidationReason.DUPLICATE_QUESTION,
        ),
    ],
)
def test_question_validation_reasons_are_stable(
    updates: dict[str, object],
    previous: list[str] | None,
    expected: ProviderValidationReason,
) -> None:
    with pytest.raises(ProviderInvalidResponseError) as captured:
        validate_question(_question().model_copy(update=updates), _intent(), previous)
    assert captured.value.reason is expected


def test_unsupported_history_reason_is_stable() -> None:
    question = _question().model_copy(
        update={"question": "How did you use Python in the production service you built?"}
    )
    with pytest.raises(ProviderInvalidResponseError) as captured:
        validate_question(question, _intent())
    assert captured.value.reason is ProviderValidationReason.UNSUPPORTED_HISTORY_PREMISE


def test_prohibited_inference_reason_is_stable() -> None:
    evaluation = AnswerEvaluation(
        score=70,
        classification="good",
        feedback="This answer proves exceptional intelligence.",
    )
    with pytest.raises(ProviderInvalidResponseError) as captured:
        validate_evaluation(evaluation)
    assert captured.value.reason is ProviderValidationReason.PROHIBITED_INFERENCE


def test_report_aggregate_mismatch_reason_is_stable() -> None:
    session = _session()
    session.turns.append(
        InterviewTurn(
            question=_question(),
            evaluation=AnswerEvaluation(
                score=70,
                classification="good",
                feedback="The answer addressed the observable question.",
            ),
        )
    )
    report = FinalInterviewReport(
        session_id=session.session_id,
        overall_score=99,
        classification="excellent",
        questions_answered=1,
        category_scores={"technical": 70},
        summary="The evaluated response supplied the report evidence.",
    )
    with pytest.raises(ProviderInvalidResponseError) as captured:
        validate_report(report, session)
    assert captured.value.reason is ProviderValidationReason.AGGREGATE_MISMATCH
