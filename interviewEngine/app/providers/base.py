from typing import Protocol

from app.domain.interview_session import (
    AnswerEvaluation,
    FinalInterviewReport,
    InterviewQuestion,
    InterviewSession,
    QuestionIntent,
)


class InterviewLLMProvider(Protocol):
    async def generate_question(
        self, session: InterviewSession, intent: QuestionIntent
    ) -> InterviewQuestion: ...

    async def evaluate_answer(
        self, session: InterviewSession, question: InterviewQuestion, answer: str
    ) -> AnswerEvaluation: ...

    async def generate_final_report(self, session: InterviewSession) -> FinalInterviewReport: ...
