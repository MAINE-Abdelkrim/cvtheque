import pytest

from app.domain.interview_session import (
    Difficulty,
    IntentGrounding,
    InterviewSession,
    InterviewType,
    QuestionCategory,
)
from app.schemas.cv_schema import CanonicalCV
from app.schemas.job_schema import JobContext
from app.services.interview_service import InterviewService

STRONG_ANSWER = (
    "For example, I took specific responsibility for the design, explained the tradeoffs, "
    "tested the implementation with the team, and improved the final result for users."
)


async def start(
    service: InterviewService,
    cv: dict[str, object],
    interview_type: InterviewType,
    *,
    job: dict[str, object] | None = None,
    maximum: int = 6,
) -> InterviewSession:
    return await service.create_session(
        cv=CanonicalCV.model_validate(cv),
        candidate_id=None,
        job=JobContext.model_validate(job) if job else None,
        interview_type=interview_type,
        max_questions=maximum,
    )


async def advance(
    service: InterviewService, session: InterviewSession, answer: str = STRONG_ANSWER
) -> InterviewSession:
    return await service.submit_answer(
        session.session_id, session.turns[-1].question.question_id, answer
    )


async def complete(service: InterviewService, session: InterviewSession) -> InterviewSession:
    while session.status.value == "IN_PROGRESS":
        session = await advance(service, session)
    return session


@pytest.mark.parametrize(
    ("interview_type", "expected"),
    [
        (
            InterviewType.GENERAL,
            {
                QuestionCategory.INTRODUCTION,
                QuestionCategory.EXPERIENCE,
                QuestionCategory.MOTIVATION,
            },
        ),
        (
            InterviewType.TECHNICAL,
            {
                QuestionCategory.TECHNICAL,
                QuestionCategory.SKILLS,
                QuestionCategory.PROBLEM_SOLVING,
            },
        ),
        (InterviewType.BEHAVIORAL, {QuestionCategory.BEHAVIORAL}),
        (
            InterviewType.MIXED,
            {
                QuestionCategory.INTRODUCTION,
                QuestionCategory.EXPERIENCE,
                QuestionCategory.TECHNICAL,
                QuestionCategory.BEHAVIORAL,
            },
        ),
    ],
)
async def test_interview_type_controls_category_mix(
    service: InterviewService,
    cv_payload: dict[str, object],
    interview_type: InterviewType,
    expected: set[QuestionCategory],
) -> None:
    session = await start(service, cv_payload, interview_type, maximum=6)
    session = await complete(service, session)
    categories = {turn.question.category for turn in session.turns}
    assert expected <= categories
    if interview_type is InterviewType.TECHNICAL:
        assert session.turns[0].question.category is QuestionCategory.TECHNICAL
    if interview_type is InterviewType.BEHAVIORAL:
        assert session.turns[0].question.category is QuestionCategory.BEHAVIORAL


async def test_cv_skill_and_experience_are_grounded(
    service: InterviewService, cv_payload: dict[str, object]
) -> None:
    session = await start(service, cv_payload, InterviewType.TECHNICAL, maximum=5)
    session = await complete(service, session)
    refs = {ref for turn in session.turns for ref in turn.question.based_on}
    assert any(ref.startswith("cv:skill:Python") for ref in refs)
    assert any(ref.startswith("cv:experience:Backend Developer at ABC Tech") for ref in refs)


async def test_job_only_skill_is_open_and_not_claimed_as_cv_fact(
    service: InterviewService,
) -> None:
    session = await start(
        service,
        {},
        InterviewType.TECHNICAL,
        job={"required_skills": ["Kubernetes"]},
        maximum=1,
    )
    question = session.turns[0].question
    assert question.based_on == ["job:skill:Kubernetes"]
    assert "This role includes Kubernetes" in question.question
    assert "experience, if any" in question.question
    assert "your Kubernetes" not in question.question
    assert session.turns[0].intent is not None
    assert session.turns[0].intent.grounding is IntentGrounding.JOB


async def test_cv_and_job_skill_uses_combined_grounding(
    service: InterviewService,
) -> None:
    session = await start(
        service,
        {"skills": [{"name": "FastAPI"}]},
        InterviewType.TECHNICAL,
        job={"required_skills": ["FastAPI"]},
        maximum=1,
    )
    assert set(session.turns[0].question.based_on) == {
        "cv:skill:FastAPI",
        "job:skill:FastAPI",
    }
    assert "CV lists FastAPI" in session.turns[0].question.question
    assert "also relevant to this role" in session.turns[0].question.question


async def test_topics_are_not_repeated_while_fresh_topics_exist(
    service: InterviewService, cv_payload: dict[str, object]
) -> None:
    session = await start(service, cv_payload, InterviewType.TECHNICAL, maximum=4)
    session = await complete(service, session)
    topics = [turn.intent.topic for turn in session.turns if turn.intent]
    assert len(topics) == len(set(topic.casefold() for topic in topics))


async def test_revisited_topic_has_different_objective_after_weak_answer(
    service: InterviewService,
) -> None:
    session = await start(
        service,
        {"skills": [{"name": "FastAPI"}]},
        InterviewType.TECHNICAL,
        maximum=3,
    )
    first_intent = session.turns[0].intent
    session = await advance(service, session, "Yes, I used it.")
    follow_up = session.turns[1].intent
    assert first_intent is not None and follow_up is not None
    assert follow_up.topic == first_intent.topic
    assert follow_up.objective != first_intent.objective
    assert follow_up.is_follow_up
    assert "concrete example" in session.turns[1].question.question.lower()


async def test_strong_answer_advances_to_new_topic(
    service: InterviewService, cv_payload: dict[str, object]
) -> None:
    session = await start(service, cv_payload, InterviewType.TECHNICAL, maximum=3)
    first_topic = session.turns[0].intent.topic if session.turns[0].intent else None
    session = await advance(service, session)
    assert session.turns[1].intent is not None
    assert session.turns[1].intent.topic != first_topic
    assert not session.turns[1].intent.is_follow_up


async def test_difficulty_progresses_and_technical_reaches_hard_earlier(
    service: InterviewService, cv_payload: dict[str, object]
) -> None:
    technical = await start(service, cv_payload, InterviewType.TECHNICAL, maximum=5)
    technical = await complete(service, technical)
    difficulties = [turn.question.difficulty for turn in technical.turns]
    assert difficulties[0] is Difficulty.EASY
    assert difficulties[1] is Difficulty.MEDIUM
    assert Difficulty.HARD in difficulties[2:]


async def test_empty_cv_with_job_produces_job_grounded_question(
    service: InterviewService,
) -> None:
    session = await start(
        service,
        {},
        InterviewType.TECHNICAL,
        job={"required_skills": ["Docker"]},
        maximum=1,
    )
    assert session.turns[0].question.based_on == ["job:skill:Docker"]
    assert "Docker" in session.turns[0].question.question


async def test_unknown_aws_is_never_invented(service: InterviewService) -> None:
    session = await start(
        service,
        {"skills": [{"name": "Python"}]},
        InterviewType.TECHNICAL,
        maximum=4,
    )
    session = await complete(service, session)
    assert all("AWS" not in turn.question.question for turn in session.turns)


async def test_contact_name_and_url_values_do_not_leak(service: InterviewService) -> None:
    cv = {
        "identity": {
            "full_name": "Private Candidate",
            "job_title": "https://private.example/profile",
        },
        "skills": [
            {"name": "person@example.com"},
            {"name": "+212 612 345 678"},
            {"name": "www.private.example"},
        ],
    }
    session = await start(service, cv, InterviewType.MIXED, maximum=3)
    session = await complete(service, session)
    combined = " ".join(turn.question.question for turn in session.turns)
    assert "Private Candidate" not in combined
    assert "@" not in combined
    assert "+212" not in combined
    assert "private.example" not in combined


async def test_final_report_only_has_assessed_categories(
    service: InterviewService, cv_payload: dict[str, object]
) -> None:
    session = await start(service, cv_payload, InterviewType.MIXED, maximum=2)
    session = await complete(service, session)
    assert session.final_report is not None
    assessed = {turn.question.category.value for turn in session.turns}
    assert set(session.final_report.category_scores) == assessed
    assert "education" not in session.final_report.category_scores
