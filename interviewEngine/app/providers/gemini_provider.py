from typing import Annotated, Any, Literal, Protocol, TypeVar
from uuid import uuid4

import httpx
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.domain.interview_session import (
    AnswerEvaluation,
    FinalInterviewReport,
    InterviewQuestion,
    InterviewSession,
    QuestionIntent,
)
from app.domain.scoring import aggregate_evaluated_turns, classification_for_score
from app.providers.errors import (
    InterviewProviderError,
    ProviderFailureCause,
    ProviderInvalidResponseError,
    ProviderUnavailableError,
)
from app.providers.gemini_prompts import (
    evaluation_prompt,
    final_report_prompt,
    question_prompt,
)

Classification = Literal["excellent", "good", "fair", "needs_improvement"]
ShortText = Annotated[str, Field(min_length=1, max_length=500)]
PayloadT = TypeVar("PayloadT", bound=BaseModel)


def classify_gemini_failure(exc: BaseException) -> ProviderFailureCause:
    """Map structured SDK/runtime failures without inspecting human-readable messages."""
    if isinstance(exc, httpx.TimeoutException):
        return ProviderFailureCause.TIMEOUT
    if isinstance(exc, httpx.TransportError):
        return ProviderFailureCause.TRANSPORT
    if isinstance(exc, genai_errors.APIError):
        code = exc.code
        if code == 429:
            return ProviderFailureCause.RATE_LIMIT
        if code == 401:
            return ProviderFailureCause.AUTHENTICATION
        if code == 403:
            return ProviderFailureCause.PERMISSION
        if code in {400, 404}:
            return ProviderFailureCause.MODEL_OR_REQUEST
        if 500 <= code <= 599:
            return ProviderFailureCause.SERVER
    return ProviderFailureCause.UNKNOWN


class GeneratedQuestionPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    question: str = Field(min_length=1, max_length=2_000)


class AnswerEvaluationPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    score: int = Field(ge=0, le=100)
    classification: Classification
    strengths: list[ShortText] = Field(default_factory=list, max_length=10)
    weaknesses: list[ShortText] = Field(default_factory=list, max_length=10)
    feedback: str = Field(min_length=1, max_length=2_000)


class FinalReportPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    classification: Classification
    strengths: list[ShortText] = Field(default_factory=list, max_length=10)
    areas_for_improvement: list[ShortText] = Field(default_factory=list, max_length=10)
    summary: str = Field(min_length=1, max_length=4_000)


class GeminiModels(Protocol):
    async def generate_content(self, *, model: str, contents: str, config: Any) -> Any: ...


class GeminiAsyncClient(Protocol):
    models: GeminiModels


class GeminiClient(Protocol):
    aio: GeminiAsyncClient


class GeminiInterviewProvider:
    """Single-attempt Gemini adapter; resilience is applied by the outer provider."""

    def __init__(
        self,
        *,
        client: GeminiClient,
        model: str,
        temperature: float = 0.2,
        max_output_tokens: int = 2_048,
    ) -> None:
        if not model.strip():
            raise ValueError("Gemini model must not be blank")
        self._client = client
        self._model = model
        self._temperature = temperature
        self._max_output_tokens = max_output_tokens

    async def generate_question(
        self, session: InterviewSession, intent: QuestionIntent
    ) -> InterviewQuestion:
        del session
        payload = await self._generate(question_prompt(intent), GeneratedQuestionPayload)
        return InterviewQuestion(
            question_id=str(uuid4()),
            category=intent.category,
            question=payload.question.strip(),
            based_on=list(intent.source_refs),
            difficulty=intent.difficulty,
        )

    async def evaluate_answer(
        self, session: InterviewSession, question: InterviewQuestion, answer: str
    ) -> AnswerEvaluation:
        del session
        payload = await self._generate(
            evaluation_prompt(question.question, answer), AnswerEvaluationPayload
        )
        return AnswerEvaluation.model_validate(payload.model_dump())

    async def generate_final_report(self, session: InterviewSession) -> FinalInterviewReport:
        payload = await self._generate(final_report_prompt(session), FinalReportPayload)
        overall, category_scores, evaluated_count = aggregate_evaluated_turns(session.turns)
        return FinalInterviewReport(
            session_id=session.session_id,
            overall_score=overall,
            classification=classification_for_score(overall),
            questions_answered=evaluated_count,
            category_scores=category_scores,
            strengths=payload.strengths,
            areas_for_improvement=payload.areas_for_improvement,
            summary=payload.summary.strip(),
        )

    async def _generate(self, prompt: str, schema: type[PayloadT]) -> PayloadT:
        config = types.GenerateContentConfig(
            temperature=self._temperature,
            max_output_tokens=self._max_output_tokens,
            response_mime_type="application/json",
            response_schema=_gemini_response_schema(schema),
        )
        try:
            response = await self._client.aio.models.generate_content(
                model=self._model,
                contents=prompt,
                config=config,
            )
        except InterviewProviderError:
            raise
        except Exception as exc:
            raise ProviderUnavailableError(
                "Gemini provider request failed",
                cause=classify_gemini_failure(exc),
            ) from exc
        try:
            parsed = response.parsed
            if isinstance(parsed, schema):
                return parsed
            return schema.model_validate(parsed)
        except (AttributeError, TypeError, ValueError, ValidationError) as exc:
            raise ProviderInvalidResponseError("Gemini returned an invalid response") from exc


def _gemini_response_schema(schema: type[BaseModel]) -> dict[str, Any]:
    """Remove JSON Schema keywords unsupported by Gemini without weakening local validation."""
    generated = schema.model_json_schema()

    def clean(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: clean(item)
                for key, item in value.items()
                if key != "additionalProperties"
            }
        if isinstance(value, list):
            return [clean(item) for item in value]
        return value

    cleaned = clean(generated)
    assert isinstance(cleaned, dict)
    return cleaned
