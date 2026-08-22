from typing import Protocol

from app.domain.interview_session import InterviewSession, QuestionIntent


class InterviewPlanner(Protocol):
    def plan_next(self, session: InterviewSession) -> QuestionIntent: ...
