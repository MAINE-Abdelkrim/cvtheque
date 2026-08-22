from typing import cast

from app.config.settings import Settings
from app.providers.base import InterviewLLMProvider
from app.providers.errors import ProviderConfigurationError
from app.providers.gemini_provider import GeminiClient, GeminiInterviewProvider
from app.providers.mock_provider import MockLLMProvider
from app.providers.resilient import ResilientInterviewProvider


def create_provider(
    settings: Settings, *, gemini_client: GeminiClient | None = None
) -> InterviewLLMProvider:
    provider_name = settings.interview_provider.casefold()
    if provider_name == "mock":
        primary: InterviewLLMProvider = MockLLMProvider()
    elif provider_name == "gemini":
        if (
            settings.gemini_api_key is None
            or not settings.gemini_api_key.get_secret_value().strip()
        ):
            raise ProviderConfigurationError("GEMINI_API_KEY is required for Gemini provider")
        if gemini_client is None:
            from google import genai

            gemini_client = cast(
                GeminiClient,
                genai.Client(api_key=settings.gemini_api_key.get_secret_value()),
            )
        assert gemini_client is not None
        primary = GeminiInterviewProvider(
            client=gemini_client,
            model=settings.gemini_model,
            temperature=settings.gemini_temperature,
            max_output_tokens=settings.gemini_max_output_tokens,
        )
    else:
        raise ProviderConfigurationError("Configured interview provider is not supported")
    fallback = MockLLMProvider() if settings.interview_provider_fallback_enabled else None
    return ResilientInterviewProvider(
        primary=primary,
        primary_name=provider_name,
        fallback=fallback,
        fallback_name="mock" if fallback else None,
        timeout_seconds=settings.interview_provider_timeout_seconds,
        max_retries=settings.interview_provider_max_retries,
        retry_delay_seconds=settings.interview_provider_retry_delay_seconds,
    )
