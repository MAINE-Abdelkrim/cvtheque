import asyncio

from app.domain.interview_session import (
    AnswerEvaluation,
    FinalInterviewReport,
    InterviewQuestion,
    InterviewSession,
    QuestionCategory,
    QuestionIntent,
)
from app.providers.errors import ProviderUnavailableError
from app.providers.mock_provider import MockLLMProvider


class CountingProvider:
    def __init__(self, question_failures: int = 0) -> None:
        self.delegate = MockLLMProvider()
        self.question_failures = question_failures
        self.question_calls = 0
        self.evaluation_calls = 0
        self.report_calls = 0

    async def generate_question(
        self, session: InterviewSession, intent: QuestionIntent
    ) -> InterviewQuestion:
        self.question_calls += 1
        if self.question_calls <= self.question_failures:
            raise ProviderUnavailableError("synthetic transient failure")
        return await self.delegate.generate_question(session, intent)

    async def evaluate_answer(
        self, session: InterviewSession, question: InterviewQuestion, answer: str
    ) -> AnswerEvaluation:
        self.evaluation_calls += 1
        return await self.delegate.evaluate_answer(session, question, answer)

    async def generate_final_report(self, session: InterviewSession) -> FinalInterviewReport:
        self.report_calls += 1
        return await self.delegate.generate_final_report(session)


class AlwaysUnavailableProvider(CountingProvider):
    async def generate_question(
        self, session: InterviewSession, intent: QuestionIntent
    ) -> InterviewQuestion:
        del session, intent
        self.question_calls += 1
        raise ProviderUnavailableError("synthetic unavailable failure")

    async def evaluate_answer(
        self, session: InterviewSession, question: InterviewQuestion, answer: str
    ) -> AnswerEvaluation:
        del session, question, answer
        self.evaluation_calls += 1
        raise ProviderUnavailableError("synthetic unavailable failure")

    async def generate_final_report(self, session: InterviewSession) -> FinalInterviewReport:
        del session
        self.report_calls += 1
        raise ProviderUnavailableError("synthetic unavailable failure")


class SlowProvider(CountingProvider):
    async def generate_question(
        self, session: InterviewSession, intent: QuestionIntent
    ) -> InterviewQuestion:
        self.question_calls += 1
        await asyncio.sleep(0.05)
        return await self.delegate.generate_question(session, intent)


class InvalidQuestionProvider(CountingProvider):
    async def generate_question(
        self, session: InterviewSession, intent: QuestionIntent
    ) -> InterviewQuestion:
        del session
        self.question_calls += 1
        return InterviewQuestion.model_construct(
            question_id="not-a-uuid",
            category=intent.category,
            question=" ",
            based_on=intent.source_refs,
            difficulty=intent.difficulty,
        )


class MetadataChangingProvider(CountingProvider):
    async def generate_question(
        self, session: InterviewSession, intent: QuestionIntent
    ) -> InterviewQuestion:
        question = await self.delegate.generate_question(session, intent)
        return question.model_copy(update={"category": QuestionCategory.BEHAVIORAL})


class InvalidScoreProvider(CountingProvider):
    async def evaluate_answer(
        self, session: InterviewSession, question: InterviewQuestion, answer: str
    ) -> AnswerEvaluation:
        del session, question, answer
        self.evaluation_calls += 1
        return AnswerEvaluation.model_construct(
            score=101,
            classification="excellent",
            strengths=[],
            weaknesses=[],
            feedback="Invalid synthetic evaluation",
        )


class FailAfterFirstQuestionProvider(CountingProvider):
    async def generate_question(
        self, session: InterviewSession, intent: QuestionIntent
    ) -> InterviewQuestion:
        self.question_calls += 1
        if self.question_calls > 1:
            raise ProviderUnavailableError("synthetic next-question failure")
        return await self.delegate.generate_question(session, intent)


class EvaluationUnavailableProvider(CountingProvider):
    async def evaluate_answer(
        self, session: InterviewSession, question: InterviewQuestion, answer: str
    ) -> AnswerEvaluation:
        del session, question, answer
        self.evaluation_calls += 1
        raise ProviderUnavailableError("synthetic evaluation failure")
