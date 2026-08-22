import pytest
from google.genai.errors import ClientError

from app.config.settings import Settings
from app.domain.interview_session import InterviewType, SessionStatus
from app.providers.errors import ProviderFailureCause
from tests.fake_gemini import FakeGeminiClient
from tools.interview_ui_support import (
    AsyncRunner,
    build_local_service,
    build_synthetic_cv,
    build_synthetic_job,
)


def test_synthetic_input_builders() -> None:
    cv = build_synthetic_cv(
        name="Fictional Candidate", job_title="Developer", skills="Python\n\nSQL ",
        experience_role="Intern", experience_company="Fictional Labs",
        experience_description="Built fictional APIs.", degree="Bachelor",
        field_of_study="Computer Science", institution="Fictional University",
    )
    job = build_synthetic_job(
        enabled=True, title="Developer", required_skills="Python\nSQL",
        preferred_skills="Testing",
    )
    assert [skill.name for skill in cv.skills] == ["Python", "SQL"]
    assert job is not None and job.required_skills == ["Python", "SQL"]
    assert build_synthetic_job(
        enabled=False, title="", required_skills="", preferred_skills=""
    ) is None


def test_mock_service_completes_offline() -> None:
    settings = Settings(_env_file=None)
    service, diagnostics = build_local_service(settings, "mock")
    cv = build_synthetic_cv(
        name="Fictional Candidate", job_title="Developer", skills="Python",
        experience_role="Intern", experience_company="Fictional Labs",
        experience_description="Built APIs.", degree="Bachelor",
        field_of_study="Computer Science", institution="Fictional University",
    )
    runner = AsyncRunner()
    try:
        session = runner.run(service.create_session(
            cv=cv, candidate_id=None, job=None,
            interview_type=InterviewType.TECHNICAL, max_questions=1,
        ))
        completed = runner.run(service.submit_answer(
            session.session_id, session.turns[-1].question.question_id,
            "I used Python because it kept the fictional API simple, for example with tests.",
        ))
    finally:
        runner.close()
    assert completed.status is SessionStatus.COMPLETED
    assert completed.final_report is not None
    assert diagnostics.accepted_provider == "Mock"


@pytest.mark.asyncio
async def test_gemini_rate_limit_diagnostic_uses_mock_fallback() -> None:
    client = FakeGeminiClient(
        [ClientError(429, {"error": {"message": "synthetic quota"}})] * 2
    )
    settings = Settings(
        _env_file=None, gemini_api_key="synthetic-test-key",
        interview_provider_max_retries=1, interview_provider_fallback_enabled=True,
    )
    service, diagnostics = build_local_service(settings, "gemini", gemini_client=client)
    cv = build_synthetic_cv(
        name="Fictional Candidate", job_title="Developer", skills="Python",
        experience_role="Intern", experience_company="Fictional Labs",
        experience_description="Built APIs.", degree="Bachelor",
        field_of_study="Computer Science", institution="Fictional University",
    )
    session = await service.create_session(
        cv=cv, candidate_id=None, job=None,
        interview_type=InterviewType.TECHNICAL, max_questions=1,
    )
    assert session.status is SessionStatus.IN_PROGRESS
    assert diagnostics.primary_attempts == 2
    assert diagnostics.primary_failure_cause is ProviderFailureCause.RATE_LIMIT
    assert diagnostics.fallback_activated is True
    assert diagnostics.fallback_succeeded is True
    assert diagnostics.accepted_provider == "Mock fallback"
