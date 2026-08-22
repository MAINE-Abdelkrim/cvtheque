from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.interview_session import (
    AnswerEvaluation,
    FinalInterviewReport,
    InterviewQuestion,
    InterviewTurn,
    InterviewType,
    SessionStatus,
)
from app.schemas.cv_schema import CanonicalCV
from app.schemas.job_schema import JobContext


class CreateInterviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate_id: str | None = Field(default=None, max_length=128)
    cv: CanonicalCV
    job: JobContext | None = None
    interview_type: InterviewType = InterviewType.MIXED
    max_questions: int = Field(default=5, ge=1, le=20)

    @field_validator("candidate_id")
    @classmethod
    def normalize_candidate_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("candidate_id must not be blank")
        return stripped


class SubmitAnswerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: str = Field(min_length=1, max_length=128)
    answer: str = Field(min_length=1, max_length=20_000)

    @field_validator("answer")
    @classmethod
    def reject_blank_answer(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("answer must contain non-whitespace characters")
        return stripped


class SessionView(BaseModel):
    """Safe operational view: CV/job snapshots and candidate identifier are omitted."""

    session_id: str
    interview_type: InterviewType
    status: SessionStatus
    current_question_index: int
    max_questions: int
    created_at: datetime
    completed_at: datetime | None
    turns: list[InterviewTurn]
    final_report: FinalInterviewReport | None


class CreateInterviewResponse(BaseModel):
    session: SessionView
    first_question: InterviewQuestion


class SubmitAnswerResponse(BaseModel):
    session_id: str
    status: SessionStatus
    evaluation: AnswerEvaluation
    next_question: InterviewQuestion | None = None
    final_report: FinalInterviewReport | None = None


class InterviewHistoryItem(BaseModel):
    session_id: str
    interview_type: InterviewType
    status: SessionStatus
    created_at: datetime
    completed_at: datetime | None
    questions_answered: int = Field(ge=0)
    max_questions: int = Field(ge=1, le=20)
    overall_score: int | None = Field(default=None, ge=0, le=100)
    classification: str | None = None


class InterviewHistoryResponse(BaseModel):
    items: list[InterviewHistoryItem]
    next_cursor: str | None = None


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
