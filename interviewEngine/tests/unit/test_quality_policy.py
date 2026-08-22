from uuid import uuid4

import pytest

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
    QuestionIntent,
)
from app.domain.scoring import classification_for_score
from app.providers.errors import ProviderInvalidResponseError
from app.providers.mock_provider import MockLLMProvider
from app.providers.validation import validate_evaluation, validate_question, validate_report
from app.repositories.in_memory import InMemoryInterviewSessionRepository
from app.schemas.cv_schema import CanonicalCV, CVSkill
from app.services.interview_service import InterviewService
from app.strategies.deterministic import DeterministicInterviewPlanner


@pytest.mark.parametrize(
    ("score", "expected"),
    [
        (0, "needs_improvement"),
        (49, "needs_improvement"),
        (50, "fair"),
        (51, "fair"),
        (69, "fair"),
        (70, "good"),
        (71, "good"),
        (84, "good"),
        (85, "excellent"),
        (86, "excellent"),
        (100, "excellent"),
    ],
)
def test_classification_boundaries(score: int, expected: str) -> None:
    assert classification_for_score(score) == expected


def _session() -> InterviewSession:
    return InterviewSession(
        session_id=str(uuid4()),
        interview_type=InterviewType.TECHNICAL,
        max_questions=1,
        cv=CanonicalCV(skills=[CVSkill(name="Python")]),
    )


def _question() -> InterviewQuestion:
    return InterviewQuestion(
        question_id=str(uuid4()),
        category=QuestionCategory.TECHNICAL,
        question="What factors matter when applying Python to a reliable API service?",
        based_on=["cv:skill:Python"],
        difficulty=Difficulty.MEDIUM,
    )


def _evaluation(score: int, classification: str = "good") -> AnswerEvaluation:
    return AnswerEvaluation(
        score=score,
        classification=classification,
        strengths=["Explained an observable technical choice"],
        weaknesses=["Could include another concrete result"],
        feedback="The response was assessed from its observable content.",
    )


async def test_mock_quality_order_is_monotonic_and_irrelevant_stays_low() -> None:
    provider = MockLLMProvider()
    current = _session()
    asked = _question()
    strong = await provider.evaluate_answer(
        current,
        asked,
        "For example, I applied Python dependency injection and validation to the API "
        "because explicit boundaries made failures easier to test. I measured the result, "
        "improved error handling by 30%, and documented the trade-off for the team.",
    )
    partial = await provider.evaluate_answer(
        current,
        asked,
        "I would use Python validation for the API because it catches invalid input, but I "
        "have not described the testing or operational trade-offs.",
    )
    weak = await provider.evaluate_answer(
        current, asked, "Python is useful for APIs and I would use it carefully."
    )
    irrelevant = await provider.evaluate_answer(
        current,
        asked,
        "The coastal weather was pleasant, and the train arrived beside a crowded market "
        "before lunch on a quiet Tuesday.",
    )
    assert strong.score > partial.score > weak.score
    assert strong.score > irrelevant.score
    assert irrelevant.score < 50


async def test_controlled_contradictory_technical_answer_does_not_score_highly() -> None:
    provider = MockLLMProvider()
    question = _question().model_copy(
        update={
            "question": "What does HTTP status 404 mean?",
            "based_on": [],
        }
    )

    evaluation = await provider.evaluate_answer(
        _session(), question, "It means the request succeeded."
    )

    # This protects the score boundary for a sparse contradictory answer. It does not
    # claim that the mock provider has recognized the technical contradiction.
    assert evaluation.score < 50
    assert evaluation.classification == "needs_improvement"


def test_evaluation_classification_is_normalized_from_score() -> None:
    validated = validate_evaluation(_evaluation(25, "excellent"))
    assert validated.classification == "needs_improvement"


def test_report_aggregate_and_classification_are_authoritative() -> None:
    current = _session()
    asked = _question()
    current.turns.append(
        InterviewTurn(
            question=asked,
            answer=CandidateAnswer(question_id=asked.question_id, answer="Fictional answer"),
            evaluation=_evaluation(25, "needs_improvement"),
        )
    )
    contradictory = FinalInterviewReport(
        session_id=current.session_id,
        overall_score=25,
        classification="excellent",
        questions_answered=1,
        category_scores={"technical": 25},
        strengths=[],
        areas_for_improvement=["Add relevant supporting detail"],
        summary="The response needs more relevant technical evidence.",
    )
    validated = validate_report(contradictory, current)
    assert validated.classification == "needs_improvement"

    with pytest.raises(ProviderInvalidResponseError):
        validate_report(contradictory.model_copy(update={"overall_score": 90}), current)


def test_duplicate_question_text_is_rejected_after_normalization() -> None:
    intent = QuestionIntent(
        category=QuestionCategory.TECHNICAL,
        topic="Python",
        source_refs=["cv:skill:Python"],
        difficulty=Difficulty.MEDIUM,
        objective="Assess Python reasoning",
        grounding=IntentGrounding.CV,
    )
    asked = _question()
    with pytest.raises(ProviderInvalidResponseError):
        validate_question(
            asked,
            intent,
            ["  WHAT factors matter when applying Python to a reliable API service?  "],
        )


@pytest.mark.parametrize(
    "invalid_text",
    [
        "Explain Python reliability without a question mark.",
        "How is Python applied? What reliability trade-offs matter?",
        "What matters?" + "x" * 500,
    ],
)
def test_question_must_be_one_concise_main_question(invalid_text: str) -> None:
    intent = QuestionIntent(
        category=QuestionCategory.TECHNICAL,
        topic="Python",
        source_refs=["cv:skill:Python"],
        difficulty=Difficulty.MEDIUM,
        objective="Assess Python reasoning",
        grounding=IntentGrounding.CV,
    )
    with pytest.raises(ProviderInvalidResponseError):
        validate_question(_question().model_copy(update={"question": invalid_text}), intent)


@pytest.mark.parametrize(
    "unsafe_text",
    [
        "The candidate is highly intelligent.",
        "Their IQ appears exceptional.",
        "This proves an honest personality.",
        "The response indicates deliberate deception.",
        "The candidate seems emotionally unstable.",
        "The answer suggests a mental health concern.",
        "Their physical health may limit performance.",
        "Their race appears relevant to this assessment.",
        "The candidate's ethnicity may explain the answer.",
        "Their religion may influence their work.",
        "Gender affects suitability for this role.",
        "Their sexual orientation may affect team fit.",
        "Gender identity affects this assessment.",
        "A disability makes the candidate less suitable.",
        "Their family situation may reduce availability.",
        "Marital status suggests they may not relocate.",
        "Their political views suggest poor judgment.",
    ],
)
def test_prohibited_inferences_are_rejected(unsafe_text: str) -> None:
    with pytest.raises(ProviderInvalidResponseError):
        validate_evaluation(
            _evaluation(70).model_copy(update={"feedback": unsafe_text})
        )


def test_prohibited_inference_is_also_rejected_in_final_report() -> None:
    current = _session()
    asked = _question()
    current.turns.append(
        InterviewTurn(question=asked, evaluation=_evaluation(70))
    )
    report = FinalInterviewReport(
        session_id=current.session_id,
        overall_score=70,
        classification="good",
        questions_answered=1,
        category_scores={"technical": 70},
        summary="The candidate's political affiliation makes them unsuitable.",
    )

    with pytest.raises(ProviderInvalidResponseError):
        validate_report(report, current)


def test_weak_answer_does_not_escalate_late_difficulty() -> None:
    current = InterviewSession(
        session_id=str(uuid4()),
        interview_type=InterviewType.TECHNICAL,
        max_questions=4,
        cv=CanonicalCV(
            skills=[CVSkill(name="Python"), CVSkill(name="SQL"), CVSkill(name="Docker")]
        ),
    )
    for topic in ("Python", "SQL", "Docker"):
        intent = QuestionIntent(
            category=QuestionCategory.TECHNICAL,
            topic=topic,
            source_refs=[f"cv:skill:{topic}"],
            difficulty=Difficulty.MEDIUM,
            objective=f"Assess {topic}",
            grounding=IntentGrounding.CV,
        )
        asked = _question().model_copy(
            update={"question_id": str(uuid4()), "based_on": intent.source_refs}
        )
        current.turns.append(
            InterviewTurn(question=asked, intent=intent, evaluation=_evaluation(30))
        )
    planned = DeterministicInterviewPlanner().plan_next(current)
    assert planned.difficulty is Difficulty.MEDIUM


def test_strong_technical_answer_can_deepen_one_step_early() -> None:
    current = InterviewSession(
        session_id=str(uuid4()),
        interview_type=InterviewType.TECHNICAL,
        max_questions=6,
        cv=CanonicalCV(
            skills=[CVSkill(name="Python"), CVSkill(name="SQL"), CVSkill(name="Docker")]
        ),
    )
    for topic in ("Python", "SQL"):
        intent = QuestionIntent(
            category=QuestionCategory.TECHNICAL,
            topic=topic,
            source_refs=[f"cv:skill:{topic}"],
            difficulty=Difficulty.MEDIUM,
            objective=f"Assess {topic}",
            grounding=IntentGrounding.CV,
        )
        asked = _question().model_copy(
            update={"question_id": str(uuid4()), "based_on": intent.source_refs}
        )
        current.turns.append(
            InterviewTurn(question=asked, intent=intent, evaluation=_evaluation(90))
        )
    planned = DeterministicInterviewPlanner().plan_next(current)
    assert planned.difficulty is Difficulty.HARD


async def test_junior_minimal_profile_stays_bounded_after_weak_answers() -> None:
    service = InterviewService(
        InMemoryInterviewSessionRepository(),
        MockLLMProvider(),
        DeterministicInterviewPlanner(),
    )
    current = await service.create_session(
        cv=CanonicalCV.model_validate(
            {
                "identity": {"job_title": "Junior Backend Developer"},
                "skills": [{"name": "Python"}],
            }
        ),
        candidate_id="fictional-junior-owner",
        job=None,
        interview_type=InterviewType.TECHNICAL,
        max_questions=3,
    )
    assert current.turns[0].question.difficulty is Difficulty.EASY

    for _ in range(2):
        current = await service.submit_answer(
            current.session_id,
            current.turns[-1].question.question_id,
            "Python can be useful.",
        )

    assert len(current.turns) == 3
    assert current.max_questions == 3
    assert [turn.question.difficulty for turn in current.turns] == [
        Difficulty.EASY,
        Difficulty.MEDIUM,
        Difficulty.MEDIUM,
    ]
    assert sum(bool(turn.intent and turn.intent.is_follow_up) for turn in current.turns) == 1

    completed = await service.submit_answer(
        current.session_id,
        current.turns[-1].question.question_id,
        "Python can be useful.",
    )
    assert len(completed.turns) == completed.max_questions == 3


def test_report_aggregation_excludes_unanswered_turn() -> None:
    current = _session().model_copy(update={"max_questions": 2})
    evaluated_question = _question()
    unanswered_question = _question().model_copy(
        update={
            "question_id": str(uuid4()),
            "category": QuestionCategory.BEHAVIORAL,
            "question": "How do you handle a disagreement with a teammate?",
            "based_on": [],
        }
    )
    current.turns.extend(
        [
            InterviewTurn(
                question=evaluated_question,
                answer=CandidateAnswer(
                    question_id=evaluated_question.question_id,
                    answer="Fictional evaluated answer",
                ),
                evaluation=_evaluation(85, "excellent"),
            ),
            InterviewTurn(question=unanswered_question),
        ]
    )
    report = FinalInterviewReport(
        session_id=current.session_id,
        overall_score=85,
        classification="excellent",
        questions_answered=1,
        category_scores={"technical": 85},
        summary="One evaluated response supplied the report aggregate.",
    )

    validated = validate_report(report, current)

    assert validated.questions_answered == 1
    assert validated.overall_score == 85
    assert validated.category_scores == {"technical": 85}
    assert validated.classification == "excellent"


async def test_one_question_interview_has_valid_complete_report() -> None:
    service = InterviewService(
        InMemoryInterviewSessionRepository(),
        MockLLMProvider(),
        DeterministicInterviewPlanner(),
    )
    current = await service.create_session(
        cv=CanonicalCV(skills=[CVSkill(name="Python")]),
        candidate_id="fictional-owner",
        job=None,
        interview_type=InterviewType.TECHNICAL,
        max_questions=1,
    )
    completed = await service.submit_answer(
        current.session_id,
        current.turns[0].question.question_id,
        "For example, Python validation improved the API result because errors became explicit.",
    )
    assert completed.final_report is not None
    assert completed.turns[0].evaluation is not None
    assert completed.final_report.questions_answered == 1
    assert completed.final_report.overall_score == completed.turns[0].evaluation.score
    assert completed.final_report.category_scores == {
        completed.turns[0].question.category.value: completed.turns[0].evaluation.score
    }
