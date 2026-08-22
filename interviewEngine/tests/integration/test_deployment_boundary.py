from collections.abc import AsyncIterator

import httpx
import pytest
from pydantic import ValidationError

from app.api.dependencies import get_interview_service
from app.api.fastapi_app import create_app
from app.config.settings import Settings, get_settings
from app.providers.mock_provider import MockLLMProvider
from app.repositories.in_memory import InMemoryInterviewSessionRepository
from app.services.interview_service import InterviewService
from app.strategies.deterministic import DeterministicInterviewPlanner


def deployment_app(
    *, allowed_hosts: str = "", max_request_bytes: int = 1_048_576
):
    settings = Settings(
        _env_file=None,
        interview_provider="mock",
        interview_allowed_hosts=allowed_hosts,
        interview_max_request_bytes=max_request_bytes,
    )
    application = create_app(settings)
    service = InterviewService(
        InMemoryInterviewSessionRepository(),
        MockLLMProvider(),
        DeterministicInterviewPlanner(),
    )
    application.dependency_overrides[get_settings] = lambda: settings
    application.dependency_overrides[get_interview_service] = lambda: service
    return application


async def test_cors_is_not_enabled() -> None:
    application = deployment_app()
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.options(
            "/api/v1/interviews",
            headers={
                "Origin": "https://browser.example",
                "Access-Control-Request-Method": "POST",
            },
        )
    assert response.status_code == 405
    assert "access-control-allow-origin" not in response.headers
    assert "access-control-allow-credentials" not in response.headers


async def test_configured_trusted_host_accepts_allowed_and_rejects_other_hosts() -> None:
    application = deployment_app(allowed_hosts="internal.example,*.private.example")
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://internal.example"
    ) as client:
        allowed = await client.get("/health")
        subdomain = await client.get(
            "/health", headers={"Host": "worker.private.example"}
        )
        denied = await client.get("/health", headers={"Host": "untrusted.example"})
    assert allowed.status_code == 200
    assert subdomain.status_code == 200
    assert denied.status_code == 400
    assert "internal.example" not in denied.text


async def test_unconfigured_trusted_hosts_preserve_local_behavior() -> None:
    application = deployment_app()
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://arbitrary.local"
    ) as client:
        response = await client.get("/health")
    assert response.status_code == 200


def test_unsafe_wildcard_trusted_host_is_rejected() -> None:
    with pytest.raises(ValidationError, match="allowed hosts configuration is invalid"):
        Settings(_env_file=None, interview_allowed_hosts="*")


async def test_health_is_minimal_and_contains_no_configuration_details() -> None:
    application = deployment_app()
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.json() == {"status": "ok", "service": "ai-interview-engine"}
    for forbidden in (
        "provider",
        "model",
        "project",
        "credential",
        "token",
        "owner",
        "traceback",
    ):
        assert forbidden not in response.text.lower()


async def test_declared_oversized_request_is_rejected_without_body_echo() -> None:
    application = deployment_app(max_request_bytes=64)
    transport = httpx.ASGITransport(app=application)
    fragment = "sensitive-body-fragment"
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/interviews", json={"cv": {}, "padding": fragment * 4}
        )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_TOO_LARGE"
    assert fragment not in response.text


async def test_streamed_oversized_request_without_content_length_is_rejected() -> None:
    application = deployment_app(max_request_bytes=64)
    transport = httpx.ASGITransport(app=application)

    async def chunks() -> AsyncIterator[bytes]:
        yield b'{"cv":{},"padding":"'
        yield b"x" * 80
        yield b'"}'

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/interviews",
            content=chunks(),
            headers={"Content-Type": "application/json"},
        )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_TOO_LARGE"


async def test_normal_request_still_works_through_middleware_stack() -> None:
    application = deployment_app(max_request_bytes=1_024)
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/interviews", json={"cv": {}})
    assert response.status_code == 201


async def test_unexpected_exception_response_contains_no_internal_detail() -> None:
    class ExplodingService:
        async def create_session(self, **kwargs: object) -> None:
            del kwargs
            raise RuntimeError("private traceback path and credential detail")

    application = deployment_app()
    application.dependency_overrides[get_interview_service] = lambda: ExplodingService()
    transport = httpx.ASGITransport(app=application, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/interviews", json={"cv": {}})
    assert response.status_code == 500
    assert "private traceback" not in response.text
    assert "credential detail" not in response.text
    assert "traceback" not in response.text.lower()
