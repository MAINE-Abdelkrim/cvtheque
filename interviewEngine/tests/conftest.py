from collections.abc import AsyncIterator, Iterator

import httpx
import pytest

from app.api.dependencies import get_interview_service
from app.api.fastapi_app import app
from app.config.settings import Settings, get_settings
from app.providers.factory import create_provider
from app.repositories.in_memory import InMemoryInterviewSessionRepository
from app.services.interview_service import InterviewService
from app.strategies.deterministic import DeterministicInterviewPlanner


@pytest.fixture
def cv_payload() -> dict[str, object]:
    return {
        "identity": {
            "full_name": "Candidate Name",
            "location": "Casablanca",
            "job_title": "Backend Developer",
        },
        "summary": "Backend developer with three years of experience.",
        "skills": [
            {"name": "Python", "category": "Programming", "source": "skills"},
            {"name": "FastAPI", "category": "Framework", "source": "skills"},
        ],
        "experiences": [
            {
                "job_title": "Backend Developer",
                "company": "ABC Tech",
                "description": "Developed REST APIs using FastAPI and PostgreSQL.",
            }
        ],
        "education": [
            {
                "degree": "Master",
                "field_of_study": "Computer Science",
                "institution": "University",
            }
        ],
    }


@pytest.fixture
def service() -> InterviewService:
    return InterviewService(
        InMemoryInterviewSessionRepository(),
        create_provider(Settings(interview_provider="mock")),
        DeterministicInterviewPlanner(),
    )


@pytest.fixture
def isolated_app(
    service: InterviewService,
) -> Iterator[object]:
    settings = Settings(_env_file=None, interview_provider="mock")
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_interview_service] = lambda: service
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def client(isolated_app: object) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=isolated_app)  # type: ignore[arg-type]
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as test_client:
        yield test_client
