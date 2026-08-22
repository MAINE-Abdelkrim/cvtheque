from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from app.schemas.cv_schema import CanonicalCV
from app.schemas.job_schema import JobContext


def utc_now() -> datetime:
    return datetime.now(UTC)


class InterviewType(StrEnum):
    GENERAL = "general"
    BEHAVIORAL = "behavioral"
    TECHNICAL = "technical"
    MIXED = "mixed"


class SessionStatus(StrEnum):
    CREATED = "CREATED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class QuestionCategory(StrEnum):
    INTRODUCTION = "introduction"
    EXPERIENCE = "experience"
    SKILLS = "skills"
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    MOTIVATION = "motivation"
    PROBLEM_SOLVING = "problem_solving"
    EDUCATION = "education"
    JOB_FIT = "job_fit"


class Difficulty(StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class IntentGrounding(StrEnum):
    CV = "cv"
    JOB = "job"
    BOTH = "both"
    GENERIC = "generic"


class QuestionGroundingPolicy(StrEnum):
    """Controls whether a provider may phrase the topic as candidate history."""

    CV_FACT = "cv_fact"
    SKILL_ONLY = "skill_only"
    HYPOTHETICAL = "hypothetical"
    GENERIC = "generic"


class QuestionIntent(BaseModel):
    """Internal plan describing what to assess, independently of wording."""

    category: QuestionCategory
    topic: str
    source_refs: list[str] = Field(default_factory=list)
    difficulty: Difficulty
    objective: str
    grounding: IntentGrounding
    grounding_policy: QuestionGroundingPolicy = QuestionGroundingPolicy.GENERIC
    evidence: list[str] = Field(default_factory=list)
    is_follow_up: bool = False


class InterviewCoverage(BaseModel):
    categories_asked: set[QuestionCategory] = Field(default_factory=set)
    topics_asked: set[str] = Field(default_factory=set)
    objectives_asked: set[str] = Field(default_factory=set)
    cv_sources_used: set[str] = Field(default_factory=set)
    job_requirements_covered: set[str] = Field(default_factory=set)


class InterviewQuestion(BaseModel):
    question_id: str
    category: QuestionCategory
    question: str
    based_on: list[str] = Field(default_factory=list)
    difficulty: Difficulty = Difficulty.MEDIUM


class CandidateAnswer(BaseModel):
    question_id: str
    answer: str
    submitted_at: datetime = Field(default_factory=utc_now)


class AnswerEvaluation(BaseModel):
    score: int = Field(ge=0, le=100)
    classification: str
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    feedback: str


class InterviewTurn(BaseModel):
    question: InterviewQuestion
    intent: QuestionIntent | None = Field(default=None, exclude=True)
    answer: CandidateAnswer | None = None
    evaluation: AnswerEvaluation | None = None


class FinalInterviewReport(BaseModel):
    session_id: str
    overall_score: int = Field(ge=0, le=100)
    classification: str
    questions_answered: int = Field(ge=0)
    category_scores: dict[str, int] = Field(default_factory=dict)
    strengths: list[str] = Field(default_factory=list)
    areas_for_improvement: list[str] = Field(default_factory=list)
    summary: str


class InterviewSession(BaseModel):
    session_id: str
    candidate_id: str | None = Field(default=None, max_length=128)
    version: int = Field(default=0, ge=0)
    interview_type: InterviewType = InterviewType.MIXED
    status: SessionStatus = SessionStatus.CREATED
    current_question_index: int = 0
    max_questions: int = Field(ge=1, le=20)
    created_at: datetime = Field(default_factory=utc_now)
    completed_at: datetime | None = None
    cv: CanonicalCV
    job: JobContext | None = None
    turns: list[InterviewTurn] = Field(default_factory=list)
    final_report: FinalInterviewReport | None = None
