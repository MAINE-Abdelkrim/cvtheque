import asyncio
from dataclasses import dataclass
from typing import Any, Literal, cast

from app.config.settings import Settings
from app.providers.base import InterviewLLMProvider
from app.providers.errors import InterviewProviderError, ProviderFailureCause
from app.providers.gemini_provider import GeminiClient, GeminiInterviewProvider
from app.providers.mock_provider import MockLLMProvider
from app.providers.resilient import ResilientInterviewProvider
from app.repositories.in_memory import InMemoryInterviewSessionRepository
from app.schemas.cv_schema import CanonicalCV, CVEducation, CVExperience, CVIdentity, CVSkill
from app.schemas.job_schema import JobContext
from app.services.interview_service import InterviewService
from app.strategies.deterministic import DeterministicInterviewPlanner

ProviderChoice = Literal["mock", "gemini"]


def split_lines(value: str) -> list[str]:
    return [line.strip() for line in value.splitlines() if line.strip()]


def build_synthetic_cv(
    *, name: str, job_title: str, skills: str, experience_role: str,
    experience_company: str, experience_description: str, degree: str,
    field_of_study: str, institution: str,
) -> CanonicalCV:
    return CanonicalCV(
        identity=CVIdentity(full_name=name.strip() or None, job_title=job_title.strip() or None),
        skills=[CVSkill(name=item) for item in split_lines(skills)],
        experiences=[
            CVExperience(
                job_title=experience_role.strip() or None,
                company=experience_company.strip() or None,
                description=experience_description.strip() or None,
            )
        ],
        education=[
            CVEducation(
                degree=degree.strip() or None,
                field_of_study=field_of_study.strip() or None,
                institution=institution.strip() or None,
            )
        ],
    )


def build_synthetic_job(
    *, enabled: bool, title: str, required_skills: str, preferred_skills: str,
) -> JobContext | None:
    if not enabled:
        return None
    return JobContext(
        title=title.strip() or None,
        required_skills=split_lines(required_skills),
        preferred_skills=split_lines(preferred_skills),
    )


@dataclass
class LocalProviderDiagnostics:
    selected_provider: ProviderChoice
    operation: str | None = None
    primary_attempts: int = 0
    primary_succeeded: bool = False
    primary_failure_cause: ProviderFailureCause | None = None
    fallback_activated: bool = False
    fallback_succeeded: bool = False
    accepted_provider: str | None = None

    def begin_primary(self, operation: str) -> None:
        if self.accepted_provider is not None or self.operation != operation:
            self.operation = operation
            self.primary_attempts = 0
            self.primary_succeeded = False
            self.primary_failure_cause = None
            self.fallback_activated = False
            self.fallback_succeeded = False
            self.accepted_provider = None
        self.primary_attempts += 1


class DiagnosticProvider:
    def __init__(
        self, provider: InterviewLLMProvider, diagnostics: LocalProviderDiagnostics,
        *, label: str, fallback: bool,
    ) -> None:
        self._provider = provider
        self._diagnostics = diagnostics
        self._label = label
        self._fallback = fallback

    async def generate_question(self, session: Any, intent: Any) -> Any:
        return await self._call("generate_question", session, intent)

    async def evaluate_answer(self, session: Any, question: Any, answer: str) -> Any:
        return await self._call("evaluate_answer", session, question, answer)

    async def generate_final_report(self, session: Any) -> Any:
        return await self._call("generate_final_report", session)

    async def _call(self, operation: str, *args: Any) -> Any:
        if self._fallback:
            self._diagnostics.fallback_activated = True
        else:
            self._diagnostics.begin_primary(operation)
        try:
            result = await getattr(self._provider, operation)(*args)
        except InterviewProviderError as exc:
            if not self._fallback:
                cause = getattr(exc, "cause", None)
                if isinstance(cause, ProviderFailureCause):
                    self._diagnostics.primary_failure_cause = cause
            raise
        if self._fallback:
            self._diagnostics.fallback_succeeded = True
        else:
            self._diagnostics.primary_succeeded = True
        self._diagnostics.accepted_provider = self._label
        return result


def build_local_service(
    settings: Settings, provider_choice: ProviderChoice,
    *, gemini_client: GeminiClient | None = None,
) -> tuple[InterviewService, LocalProviderDiagnostics]:
    diagnostics = LocalProviderDiagnostics(selected_provider=provider_choice)
    if provider_choice == "mock":
        primary: InterviewLLMProvider = MockLLMProvider()
        primary_label = "Mock"
        fallback = None
    else:
        if (
            settings.gemini_api_key is None
            or not settings.gemini_api_key.get_secret_value().strip()
        ):
            from app.providers.errors import ProviderConfigurationError

            raise ProviderConfigurationError("GEMINI_API_KEY is required for Gemini provider")
        if gemini_client is None:
            from google import genai

            gemini_client = cast(
                GeminiClient, genai.Client(api_key=settings.gemini_api_key.get_secret_value())
            )
        primary = GeminiInterviewProvider(
            client=gemini_client,
            model=settings.gemini_model,
            temperature=settings.gemini_temperature,
            max_output_tokens=settings.gemini_max_output_tokens,
        )
        primary_label = "Gemini"
        fallback = MockLLMProvider() if settings.interview_provider_fallback_enabled else None

    resilient = ResilientInterviewProvider(
        primary=DiagnosticProvider(
            primary, diagnostics, label=primary_label, fallback=False
        ),
        primary_name=provider_choice,
        fallback=(
            DiagnosticProvider(fallback, diagnostics, label="Mock fallback", fallback=True)
            if fallback is not None
            else None
        ),
        fallback_name="mock" if fallback is not None else None,
        timeout_seconds=settings.interview_provider_timeout_seconds,
        max_retries=settings.interview_provider_max_retries,
        retry_delay_seconds=settings.interview_provider_retry_delay_seconds,
    )
    service = InterviewService(
        InMemoryInterviewSessionRepository(), resilient, DeterministicInterviewPlanner()
    )
    return service, diagnostics


class AsyncRunner:
    """Own one event loop for the lifetime of a Streamlit interview session."""

    def __init__(self) -> None:
        self._runner = asyncio.Runner()

    def run(self, awaitable: Any) -> Any:
        return self._runner.run(awaitable)

    def close(self) -> None:
        self._runner.close()
