import json
from pathlib import Path
from typing import Any

import pytest

from app.domain.interview_session import InterviewType, SessionStatus
from app.domain.scoring import classification_for_score
from app.providers.mock_provider import MockLLMProvider
from app.repositories.in_memory import InMemoryInterviewSessionRepository
from app.schemas.cv_schema import CanonicalCV
from app.schemas.job_schema import JobContext
from app.services.interview_service import InterviewService
from app.strategies.deterministic import DeterministicInterviewPlanner

SCENARIOS_PATH = (
    Path(__file__).parents[1] / "fixtures" / "interview_quality" / "scenarios.json"
)

ANSWER_TEMPLATES = {
    "strong": (
        "For example, I applied {topic} with explicit validation and automated tests because "
        "reliable boundaries made failures easier to diagnose. I compared trade-offs, measured "
        "the result, improved the workflow by 30%, and documented the reasoning for the team."
    ),
    "partial": (
        "I would apply {topic} with validation because it helps reliability, but this answer "
        "does not yet include measurements or a complete discussion of trade-offs."
    ),
    "weak": "{topic} can be useful, and I would try to use it carefully.",
    "irrelevant": (
        "The coastal weather was pleasant, and a train arrived beside a crowded market before "
        "lunch on a quiet Tuesday."
    ),
}


def _scenarios() -> list[dict[str, Any]]:
    loaded = json.loads(SCENARIOS_PATH.read_text(encoding="utf-8"))
    assert isinstance(loaded, list)
    return loaded


@pytest.mark.parametrize("scenario", _scenarios(), ids=lambda item: item["name"])
async def test_offline_interview_quality_scenario(scenario: dict[str, Any]) -> None:
    service = InterviewService(
        InMemoryInterviewSessionRepository(),
        MockLLMProvider(),
        DeterministicInterviewPlanner(),
    )
    job_payload = scenario["job"]
    session = await service.create_session(
        cv=CanonicalCV.model_validate(scenario["cv"]),
        candidate_id="fictional-quality-owner",
        job=JobContext.model_validate(job_payload) if job_payload is not None else None,
        interview_type=InterviewType(scenario["interview_type"]),
        max_questions=scenario["max_questions"],
    )
    for quality in scenario["answers"]:
        turn = session.turns[-1]
        assert turn.intent is not None
        answer = ANSWER_TEMPLATES[quality].format(topic=turn.intent.topic)
        session = await service.submit_answer(
            session.session_id, turn.question.question_id, answer
        )

    assert session.status is SessionStatus.COMPLETED
    assert len(session.turns) == scenario["max_questions"]
    assert session.current_question_index == scenario["max_questions"]
    question_ids = [turn.question.question_id for turn in session.turns]
    question_texts = [" ".join(turn.question.question.casefold().split()) for turn in session.turns]
    assert len(question_ids) == len(set(question_ids))
    assert len(question_texts) == len(set(question_texts))

    topics = [turn.intent.topic.casefold() for turn in session.turns if turn.intent]
    assert any(
        expected.casefold() in topic
        for expected in scenario["required_topics_any"]
        for topic in topics
    )
    assert all(turn.evaluation is not None for turn in session.turns)
    assert session.final_report is not None
    low, high = scenario["expected_score_band"]
    assert low <= session.final_report.overall_score <= high
    assert session.final_report.classification == classification_for_score(
        session.final_report.overall_score
    )
    assert session.final_report.questions_answered == scenario["max_questions"]
    assessed_categories = {turn.question.category.value for turn in session.turns}
    assert set(session.final_report.category_scores) == assessed_categories
    assert all(0 <= score <= 100 for score in session.final_report.category_scores.values())
    if "strong" in scenario["answers"]:
        assert session.final_report.strengths
    if {"weak", "irrelevant"} & set(scenario["answers"]):
        assert session.final_report.areas_for_improvement
    assert all(turn.answer is not None for turn in session.turns)
    assert all(
        turn.answer.answer not in session.final_report.summary
        for turn in session.turns
        if turn.answer is not None
    )
