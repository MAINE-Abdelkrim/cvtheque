from functools import lru_cache

from app.config.settings import get_settings
from app.providers.base import InterviewLLMProvider
from app.providers.factory import create_provider
from app.repositories.base import InterviewSessionRepository
from app.repositories.factory import create_repository
from app.services.interview_service import InterviewService
from app.strategies.deterministic import DeterministicInterviewPlanner


@lru_cache
def get_repository() -> InterviewSessionRepository:
    return create_repository(get_settings())


@lru_cache
def get_provider() -> InterviewLLMProvider:
    return create_provider(get_settings())


@lru_cache
def get_interview_service() -> InterviewService:
    return InterviewService(get_repository(), get_provider(), DeterministicInterviewPlanner())
