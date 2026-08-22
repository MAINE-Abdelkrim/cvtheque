import asyncio
import logging
from collections.abc import Awaitable, Callable
from time import monotonic
from typing import TypeVar

from app.domain.interview_session import (
    AnswerEvaluation,
    FinalInterviewReport,
    InterviewQuestion,
    InterviewSession,
    QuestionIntent,
)
from app.providers.base import InterviewLLMProvider
from app.providers.errors import (
    InterviewProviderError,
    ProviderConfigurationError,
    ProviderInvalidResponseError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from app.providers.validation import (
    validate_evaluation,
    validate_question,
    validate_report,
)

ResultT = TypeVar("ResultT")
logger = logging.getLogger(__name__)


class ResilientInterviewProvider:
    """Applies deadlines, retries, fallback, validation, and safe telemetry."""

    def __init__(
        self,
        *,
        primary: InterviewLLMProvider,
        primary_name: str,
        fallback: InterviewLLMProvider | None,
        fallback_name: str | None,
        timeout_seconds: float,
        max_retries: int,
        retry_delay_seconds: float = 0.0,
    ) -> None:
        if timeout_seconds <= 0 or max_retries < 0 or retry_delay_seconds < 0:
            raise ProviderConfigurationError("Provider resilience configuration is invalid")
        self._primary = primary
        self._primary_name = primary_name
        self._fallback = fallback
        self._fallback_name = fallback_name
        self._timeout_seconds = timeout_seconds
        self._max_retries = max_retries
        self._retry_delay_seconds = retry_delay_seconds

    async def generate_question(
        self, session: InterviewSession, intent: QuestionIntent
    ) -> InterviewQuestion:
        fallback = self._fallback
        return await self._execute(
            operation="generate_question",
            session_id=session.session_id,
            primary_call=lambda: self._primary.generate_question(session, intent),
            fallback_call=(
                (lambda: fallback.generate_question(session, intent))
                if fallback
                else None
            ),
            validator=lambda result: validate_question(
                result,
                intent,
                [turn.question.question for turn in session.turns],
            ),
        )

    async def evaluate_answer(
        self, session: InterviewSession, question: InterviewQuestion, answer: str
    ) -> AnswerEvaluation:
        fallback = self._fallback
        return await self._execute(
            operation="evaluate_answer",
            session_id=session.session_id,
            primary_call=lambda: self._primary.evaluate_answer(session, question, answer),
            fallback_call=(
                (lambda: fallback.evaluate_answer(session, question, answer))
                if fallback
                else None
            ),
            validator=validate_evaluation,
        )

    async def generate_final_report(self, session: InterviewSession) -> FinalInterviewReport:
        fallback = self._fallback
        return await self._execute(
            operation="generate_final_report",
            session_id=session.session_id,
            primary_call=lambda: self._primary.generate_final_report(session),
            fallback_call=(
                (lambda: fallback.generate_final_report(session)) if fallback else None
            ),
            validator=lambda result: validate_report(result, session),
        )

    async def _execute(
        self,
        *,
        operation: str,
        session_id: str,
        primary_call: Callable[[], Awaitable[ResultT]],
        fallback_call: Callable[[], Awaitable[ResultT]] | None,
        validator: Callable[[ResultT], ResultT],
    ) -> ResultT:
        last_error: InterviewProviderError | None = None
        for attempt in range(self._max_retries + 1):
            try:
                return await self._attempt(
                    operation, session_id, self._primary_name, primary_call, validator
                )
            except (ProviderTimeoutError, ProviderUnavailableError) as exc:
                last_error = exc
                if attempt < self._max_retries and self._retry_delay_seconds:
                    await asyncio.sleep(self._retry_delay_seconds)
            except ProviderInvalidResponseError as exc:
                last_error = exc
                break
            except ProviderConfigurationError:
                raise

        if fallback_call is not None:
            logger.warning(
                "provider fallback activated operation=%s session_id=%s provider=%s",
                operation,
                session_id,
                self._fallback_name,
            )
            return await self._attempt(
                operation,
                session_id,
                self._fallback_name or "fallback",
                fallback_call,
                validator,
            )
        if last_error is not None:
            raise last_error
        raise ProviderUnavailableError("Interview provider is unavailable")

    async def _attempt(
        self,
        operation: str,
        session_id: str,
        provider_name: str,
        call: Callable[[], Awaitable[ResultT]],
        validator: Callable[[ResultT], ResultT],
    ) -> ResultT:
        started = monotonic()
        logger.info(
            "provider request started operation=%s session_id=%s provider=%s",
            operation,
            session_id,
            provider_name,
        )
        try:
            async with asyncio.timeout(self._timeout_seconds):
                result = await call()
            validated = validator(result)
        except TimeoutError as exc:
            logger.warning(
                "provider timeout operation=%s session_id=%s provider=%s",
                operation,
                session_id,
                provider_name,
            )
            raise ProviderTimeoutError("Interview provider request timed out") from exc
        except ProviderInvalidResponseError as exc:
            logger.warning(
                "provider validation failed operation=%s session_id=%s provider=%s "
                "validation_reason=%s",
                operation,
                session_id,
                provider_name,
                exc.reason.value,
            )
            raise
        except ProviderConfigurationError:
            raise
        except InterviewProviderError:
            raise
        except Exception as exc:
            logger.warning(
                "provider unavailable operation=%s session_id=%s provider=%s",
                operation,
                session_id,
                provider_name,
            )
            raise ProviderUnavailableError("Interview provider is unavailable") from exc
        logger.info(
            "provider request succeeded operation=%s session_id=%s provider=%s duration_ms=%d",
            operation,
            session_id,
            provider_name,
            round((monotonic() - started) * 1_000),
        )
        return validated
