import logging
from uuid import UUID

import pytest
from pydantic import SecretStr

from app.config.settings import Settings
from app.domain.interview_session import (
    AnswerEvaluation,
    CandidateAnswer,
    Difficulty,
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
    ProviderConfigurationError,
    ProviderInvalidResponseError,
)
from app.providers.factory import create_provider
from app.providers.gemini_provider import GeminiInterviewProvider
from app.providers.mock_provider import MockLLMProvider
from app.providers.resilient import ResilientInterviewProvider
from app.schemas.cv_schema import CanonicalCV, CVIdentity, CVSkill
from tests.fake_gemini import FakeGeminiClient


def session() -> InterviewSession:
    return InterviewSession(
        session_id="4a7bc59e-d895-4124-85c8-05eddb821cab",
        interview_type=InterviewType.TECHNICAL,
        max_questions=1,
        cv=CanonicalCV(
            identity=CVIdentity(full_name="PRIVATE PERSON", location="private@example.com"),
            summary="PRIVATE CV SUMMARY",
            skills=[CVSkill(name="FastAPI")],
        ),
    )


def intent() -> QuestionIntent:
    return QuestionIntent(
        category=QuestionCategory.TECHNICAL,
        topic="FastAPI",
        source_refs=["cv:skill:FastAPI"],
        difficulty=Difficulty.HARD,
        objective="Assess technical API design decisions",
        grounding=IntentGrounding.CV,
        grounding_policy=QuestionGroundingPolicy.SKILL_ONLY,
        evidence=["FastAPI"],
    )


def provider(results: list[object]) -> tuple[GeminiInterviewProvider, FakeGeminiClient]:
    client = FakeGeminiClient(results)
    return GeminiInterviewProvider(client=client, model="test-model"), client  # type: ignore[arg-type]


def valid_evaluation() -> dict[str, object]:
    return {
        "score": 82,
        "classification": "good",
        "strengths": ["Specific example"],
        "weaknesses": ["Could quantify the outcome"],
        "feedback": "Relevant and clearly structured.",
    }


async def test_question_maps_text_and_planner_metadata() -> None:
    subject, client = provider([{"question": "How did you design a FastAPI service?"}])
    planned = intent()
    question = await subject.generate_question(session(), planned)
    UUID(question.question_id)
    assert question.question == "How did you design a FastAPI service?"
    assert question.category is planned.category
    assert question.difficulty is planned.difficulty
    assert question.based_on == planned.source_refs
    assert client.models.calls[0]["model"] == "test-model"
    response_schema = client.models.calls[0]["config"].response_schema
    assert "additionalProperties" not in str(response_schema)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("category", "behavioral"),
        ("difficulty", "easy"),
        ("based_on", ["job:skill:invented"]),
    ],
)
async def test_question_rejects_attempted_metadata_override(field: str, value: object) -> None:
    payload: dict[str, object] = {"question": "A valid question?", field: value}
    subject, _ = provider([payload])
    with pytest.raises(ProviderInvalidResponseError):
        await subject.generate_question(session(), intent())


async def test_evaluation_maps_existing_domain_model() -> None:
    subject, _ = provider([valid_evaluation()])
    evaluation = await subject.evaluate_answer(
        session(),
        InterviewQuestion(
            question_id="question-1",
            category=QuestionCategory.TECHNICAL,
            question="Explain your API design.",
            based_on=["cv:skill:FastAPI"],
            difficulty=Difficulty.HARD,
        ),
        "I separated validation from persistence and added contract tests.",
    )
    assert evaluation == AnswerEvaluation.model_validate(valid_evaluation())


@pytest.mark.parametrize(
    "payload",
    [
        {**valid_evaluation(), "score": 101},
        {"unexpected": "shape"},
        None,
        {"question": "   "},
    ],
)
async def test_invalid_or_empty_structured_response_is_rejected(payload: object) -> None:
    subject, _ = provider([payload])
    with pytest.raises(ProviderInvalidResponseError):
        if isinstance(payload, dict) and "question" in payload:
            await subject.generate_question(session(), intent())
        else:
            question = InterviewQuestion(
                question_id="question-1",
                category=QuestionCategory.TECHNICAL,
                question="Explain your design.",
                difficulty=Difficulty.HARD,
            )
            await subject.evaluate_answer(session(), question, "An answer")


async def test_final_report_uses_evaluations_without_raw_answers() -> None:
    raw_answer = "PRIVATE RAW ANSWER"
    current = session()
    current.turns.append(
        InterviewTurn(
            question=InterviewQuestion(
                question_id="question-1",
                category=QuestionCategory.TECHNICAL,
                question="Explain your API design.",
                difficulty=Difficulty.HARD,
            ),
            intent=intent(),
            answer=CandidateAnswer(question_id="question-1", answer=raw_answer),
            evaluation=AnswerEvaluation.model_validate(valid_evaluation()),
        )
    )
    subject, client = provider(
        [
            {
                "classification": "good",
                "strengths": ["Specific example"],
                "areas_for_improvement": ["Quantify outcomes"],
                "summary": "The response was relevant and structured.",
            }
        ]
    )
    report = await subject.generate_final_report(current)
    assert report.session_id == current.session_id
    assert report.questions_answered == 1
    assert report.overall_score == 82
    assert report.category_scores == {"technical": 82}
    assert raw_answer not in client.models.calls[0]["contents"]


async def test_question_prompt_uses_minimized_sanitized_context() -> None:
    subject, client = provider([{"question": "How did you use FastAPI?"}])
    await subject.generate_question(session(), intent())
    prompt = client.models.calls[0]["contents"]
    assert "FastAPI" in prompt
    assert '"grounding_policy": "skill_only"' in prompt
    assert "PRIVATE PERSON" not in prompt
    assert "private@example.com" not in prompt
    assert "PRIVATE CV SUMMARY" not in prompt
    assert "cv:skill:FastAPI" not in prompt


async def test_provider_logs_no_private_inputs_or_outputs(
    caplog: pytest.LogCaptureFixture,
) -> None:
    private_answer = "PRIVATE ANSWER TO LOG TEST"
    private_output = "PRIVATE MODEL OUTPUT"
    subject, _ = provider(
        [
            {
                **valid_evaluation(),
                "feedback": private_output,
            }
        ]
    )
    question = InterviewQuestion(
        question_id="question-1",
        category=QuestionCategory.TECHNICAL,
        question="PRIVATE QUESTION",
        difficulty=Difficulty.HARD,
    )
    with caplog.at_level(logging.DEBUG):
        await subject.evaluate_answer(session(), question, private_answer)
    logs = " ".join(record.getMessage() for record in caplog.records)
    assert private_answer not in logs
    assert private_output not in logs
    assert "PRIVATE CV SUMMARY" not in logs
    assert "Response context" not in logs


def test_factory_selects_mock() -> None:
    wrapped = create_provider(Settings(interview_provider="mock"))
    assert isinstance(wrapped, ResilientInterviewProvider)
    assert isinstance(wrapped._primary, MockLLMProvider)  # noqa: SLF001


def test_factory_selects_gemini_with_mock_fallback() -> None:
    client = FakeGeminiClient([{"question": "Question?"}])
    wrapped = create_provider(
        Settings(interview_provider="gemini", gemini_api_key=SecretStr("test-key")),
        gemini_client=client,  # type: ignore[arg-type]
    )
    assert isinstance(wrapped, ResilientInterviewProvider)
    assert isinstance(wrapped._primary, GeminiInterviewProvider)  # noqa: SLF001
    assert isinstance(wrapped._fallback, MockLLMProvider)  # noqa: SLF001


@pytest.mark.parametrize("key", [None, SecretStr("")])
def test_factory_rejects_missing_or_blank_gemini_key(key: SecretStr | None) -> None:
    with pytest.raises(ProviderConfigurationError):
        create_provider(Settings(interview_provider="gemini", gemini_api_key=key))


async def test_resilient_fallback_activates_after_gemini_failure() -> None:
    subject, _ = provider([RuntimeError("private SDK failure")])
    wrapped = ResilientInterviewProvider(
        primary=subject,
        primary_name="gemini",
        fallback=MockLLMProvider(),
        fallback_name="mock",
        timeout_seconds=1,
        max_retries=0,
    )
    question = await wrapped.generate_question(session(), intent())
    assert question.category is intent().category
