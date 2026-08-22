from uuid import uuid4

import pytest

from app.domain.interview_session import (
    CandidateAnswer,
    Difficulty,
    IntentGrounding,
    InterviewSession,
    InterviewTurn,
    InterviewType,
    QuestionCategory,
    QuestionIntent,
)
from app.providers.base import InterviewLLMProvider
from app.providers.gemini_provider import GeminiInterviewProvider
from app.providers.mock_provider import MockLLMProvider
from app.schemas.cv_schema import CanonicalCV, CVSkill
from tests.fake_gemini import FakeGeminiClient


def provider(kind: str, results: list[object]) -> InterviewLLMProvider:
    if kind == "mock":
        return MockLLMProvider()
    client = FakeGeminiClient(results)
    return GeminiInterviewProvider(client=client, model="test-model")  # type: ignore[arg-type]


def session() -> InterviewSession:
    return InterviewSession(
        session_id=str(uuid4()),
        interview_type=InterviewType.TECHNICAL,
        max_questions=1,
        cv=CanonicalCV(skills=[CVSkill(name="FastAPI")]),
    )


def intent() -> QuestionIntent:
    return QuestionIntent(
        category=QuestionCategory.TECHNICAL,
        topic="FastAPI",
        source_refs=["cv:skill:FastAPI"],
        difficulty=Difficulty.HARD,
        objective="Assess technical decisions involving FastAPI",
        grounding=IntentGrounding.CV,
    )


@pytest.mark.parametrize("provider_kind", ["mock", "gemini"])
async def test_generate_question_contract(provider_kind: str) -> None:
    subject = provider(
        provider_kind,
        [{"question": "What design decisions did you make with FastAPI?"}],
    )
    current = session()
    planned = intent()
    question = await subject.generate_question(current, planned)
    assert question.category is planned.category
    assert question.difficulty is planned.difficulty
    assert question.based_on == planned.source_refs
    assert question.question.strip().endswith("?")
    assert "reasoning" not in question.model_fields_set


@pytest.mark.parametrize("provider_kind", ["mock", "gemini"])
async def test_evaluate_answer_contract(provider_kind: str) -> None:
    subject = provider(
        provider_kind,
        [
            {"question": "How did you use FastAPI?"},
            {
                "score": 80,
                "classification": "good",
                "strengths": ["Used a concrete example"],
                "weaknesses": ["Could add metrics"],
                "feedback": "Relevant and specific.",
            },
        ],
    )
    current = session()
    question = await subject.generate_question(current, intent())
    evaluation = await subject.evaluate_answer(
        current,
        question,
        "For example, I used FastAPI to validate requests and improved the result.",
    )
    assert 0 <= evaluation.score <= 100
    assert evaluation.classification
    assert isinstance(evaluation.strengths, list)
    assert isinstance(evaluation.weaknesses, list)
    assert evaluation.feedback


@pytest.mark.parametrize("provider_kind", ["mock", "gemini"])
async def test_generate_final_report_contract(provider_kind: str) -> None:
    subject = provider(
        provider_kind,
        [
            {"question": "How did you use FastAPI?"},
            {
                "score": 80,
                "classification": "good",
                "strengths": ["Used a concrete example"],
                "weaknesses": ["Could add metrics"],
                "feedback": "Relevant and specific.",
            },
            {
                "classification": "good",
                "strengths": ["Used a concrete example"],
                "areas_for_improvement": ["Add metrics"],
                "summary": "The response was relevant and specific.",
            },
        ],
    )
    current = session()
    planned = intent()
    question = await subject.generate_question(current, planned)
    answer_text = "A concrete answer"
    evaluation = await subject.evaluate_answer(current, question, answer_text)
    current.turns.append(
        InterviewTurn(
            question=question,
            intent=planned,
            answer=CandidateAnswer(question_id=question.question_id, answer=answer_text),
            evaluation=evaluation,
        )
    )
    report = await subject.generate_final_report(current)
    assert report.session_id == current.session_id
    assert report.questions_answered == 1
    assert set(report.category_scores) == {"technical"}
    assert 0 <= report.overall_score <= 100
