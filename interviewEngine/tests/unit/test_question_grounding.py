from uuid import uuid4

import pytest

from app.domain.interview_session import (
    AnswerEvaluation,
    Difficulty,
    IntentGrounding,
    InterviewQuestion,
    InterviewSession,
    InterviewType,
    QuestionCategory,
    QuestionGroundingPolicy,
    QuestionIntent,
)
from app.providers.errors import ProviderInvalidResponseError
from app.providers.resilient import ResilientInterviewProvider
from app.providers.validation import validate_question
from app.repositories.in_memory import InMemoryInterviewSessionRepository
from app.schemas.cv_schema import CanonicalCV, CVExperience, CVSkill
from app.services.interview_service import InterviewService
from app.strategies.deterministic import DeterministicInterviewPlanner


def intent(
    policy: QuestionGroundingPolicy,
    *,
    topic: str,
    evidence: list[str],
    refs: list[str],
) -> QuestionIntent:
    return QuestionIntent(
        category=QuestionCategory.TECHNICAL,
        topic=topic,
        source_refs=refs,
        difficulty=Difficulty.MEDIUM,
        objective="Assess the topic without inventing candidate history",
        grounding=IntentGrounding.CV,
        grounding_policy=policy,
        evidence=evidence,
    )


def question(text: str, planned: QuestionIntent) -> InterviewQuestion:
    return InterviewQuestion(
        question_id=str(uuid4()),
        category=planned.category,
        question=text,
        based_on=planned.source_refs,
        difficulty=planned.difficulty,
    )


@pytest.mark.parametrize(
    ("planned", "text"),
    [
        (
            intent(
                QuestionGroundingPolicy.CV_FACT,
                topic="Backend Developer at Example Tech",
                evidence=["Backend Developer at Example Tech"],
                refs=["cv:experience:Backend Developer at Example Tech"],
            ),
            "During your work as a Backend Developer at Example Tech, what were your main "
            "responsibilities?",
        ),
        (
            intent(
                QuestionGroundingPolicy.CV_FACT,
                topic="Backend Developer at Example Tech",
                evidence=[
                    "Backend Developer at Example Tech",
                    "Developed REST APIs with FastAPI and PostgreSQL.",
                ],
                refs=["cv:experience:Backend Developer at Example Tech"],
            ),
            "Can you describe how you used FastAPI when developing REST APIs?",
        ),
        (
            intent(
                QuestionGroundingPolicy.SKILL_ONLY,
                topic="Python",
                evidence=["Python"],
                refs=["cv:skill:Python"],
            ),
            "What factors would you consider when choosing between asyncio and multiprocessing "
            "for a Python backend service?",
        ),
        (
            intent(
                QuestionGroundingPolicy.CV_FACT,
                topic="API latency reduction",
                evidence=["Reduced API latency from 900 ms to 350 ms."],
                refs=["cv:experience:API latency reduction"],
            ),
            "How did you reduce API latency from 900 ms to 350 ms?",
        ),
        (
            intent(
                QuestionGroundingPolicy.HYPOTHETICAL,
                topic="backend deployment",
                evidence=["backend development"],
                refs=[],
            ),
            "Suppose you needed to deploy a backend service with Kubernetes. What factors "
            "would you consider?",
        ),
    ],
)
def test_supported_or_hypothetical_question_is_accepted(
    planned: QuestionIntent, text: str
) -> None:
    assert validate_question(question(text, planned), planned).question == text


@pytest.mark.parametrize(
    ("planned", "text"),
    [
        (
            intent(
                QuestionGroundingPolicy.SKILL_ONLY,
                topic="Python",
                evidence=["Python"],
                refs=["cv:skill:Python"],
            ),
            "Why did you choose asyncio over multiprocessing in the production system you built?",
        ),
        (
            intent(
                QuestionGroundingPolicy.SKILL_ONLY,
                topic="PostgreSQL",
                evidence=["PostgreSQL"],
                refs=["cv:skill:PostgreSQL"],
            ),
            "How did you achieve a 50% database performance improvement?",
        ),
        (
            intent(
                QuestionGroundingPolicy.SKILL_ONLY,
                topic="backend development",
                evidence=["Python", "FastAPI", "PostgreSQL"],
                refs=["cv:skill:Python", "cv:skill:FastAPI", "cv:skill:PostgreSQL"],
            ),
            "When you deployed your Kubernetes cluster, what problems did you encounter?",
        ),
        (
            intent(
                QuestionGroundingPolicy.SKILL_ONLY,
                topic="Python",
                evidence=["Backend Developer", "Python", "FastAPI", "PostgreSQL", "Docker", "Git"],
                refs=["cv:skill:Python"],
            ),
            "What key architectural trade-offs guided your decision to choose between Python's "
            "asyncio module and multiprocessing for managing high-concurrency tasks in a "
            "production system you built?",
        ),
    ],
)
def test_unsupported_candidate_history_is_rejected(
    planned: QuestionIntent, text: str
) -> None:
    with pytest.raises(ProviderInvalidResponseError):
        validate_question(question(text, planned), planned)


def test_original_failure_has_safe_hypothetical_equivalent() -> None:
    planned = intent(
        QuestionGroundingPolicy.SKILL_ONLY,
        topic="Python",
        evidence=["Backend Developer", "Python", "FastAPI", "PostgreSQL", "Docker", "Git"],
        refs=["cv:skill:Python"],
    )
    safe = (
        "What factors would you consider when choosing between asyncio and multiprocessing for "
        "a high-concurrency Python backend system?"
    )
    assert validate_question(question(safe, planned), planned).question == safe


def test_planner_distinguishes_skill_from_documented_experience() -> None:
    planner = DeterministicInterviewPlanner()
    skill_session = InterviewSession(
        session_id="skill-grounding",
        interview_type=InterviewType.TECHNICAL,
        max_questions=1,
        cv=CanonicalCV(skills=[CVSkill(name="Python")]),
    )
    skill_intent = planner.plan_next(skill_session)
    assert skill_intent.grounding_policy is QuestionGroundingPolicy.SKILL_ONLY
    assert skill_intent.evidence == ["Python"]

    experience_session = InterviewSession(
        session_id="experience-grounding",
        interview_type=InterviewType.TECHNICAL,
        max_questions=2,
        cv=CanonicalCV(
            experiences=[
                CVExperience(
                    job_title="Backend Developer",
                    company="Example Tech",
                    description="Developed REST APIs with FastAPI and PostgreSQL.",
                )
            ]
        ),
    )
    experience_intent = planner.plan_next(experience_session)
    assert experience_intent.grounding_policy is QuestionGroundingPolicy.CV_FACT
    assert "Developed REST APIs with FastAPI and PostgreSQL." in experience_intent.evidence


class GroundingInvalidAfterFirstProvider:
    def __init__(self) -> None:
        self.question_calls = 0

    async def generate_question(
        self, session: InterviewSession, planned: QuestionIntent
    ) -> InterviewQuestion:
        del session
        self.question_calls += 1
        text = (
            "What factors would you consider when applying Python in a backend service?"
            if self.question_calls == 1
            else "Why did you choose asyncio in the production system you built?"
        )
        return question(text, planned)

    async def evaluate_answer(
        self, session: InterviewSession, asked: InterviewQuestion, answer: str
    ) -> AnswerEvaluation:
        del session, asked, answer
        return AnswerEvaluation(
            score=80,
            classification="good",
            strengths=["Provided a relevant explanation"],
            weaknesses=["Could add more detail"],
            feedback="The response was relevant and clear.",
        )


async def test_grounding_invalid_next_question_does_not_mutate_repository() -> None:
    repository = InMemoryInterviewSessionRepository()
    primary = GroundingInvalidAfterFirstProvider()
    provider = ResilientInterviewProvider(
        primary=primary,  # type: ignore[arg-type]
        primary_name="grounding-test",
        fallback=None,
        fallback_name=None,
        timeout_seconds=1,
        max_retries=0,
    )
    service = InterviewService(repository, provider, DeterministicInterviewPlanner())
    created = await service.create_session(
        cv=CanonicalCV(
            skills=[CVSkill(name="Python")],
            experiences=[CVExperience(job_title="Backend Developer")],
        ),
        candidate_id=None,
        job=None,
        interview_type=InterviewType.TECHNICAL,
        max_questions=2,
    )
    with pytest.raises(ProviderInvalidResponseError):
        await service.submit_answer(
            created.session_id,
            created.turns[0].question.question_id,
            "A relevant answer with enough detail to proceed to the next topic.",
        )
    stored = await service.get_session(created.session_id)
    assert len(stored.turns) == 1
    assert stored.turns[0].answer is None
    assert stored.turns[0].evaluation is None
    assert stored.current_question_index == 0
