"""
Dependency providers for the CV Parser API.
"""

from fastapi import Depends
from app.core.config import Settings, get_settings
from app.services.cv_processing_service import CVProcessingService


def get_settings_dep() -> Settings:
    """Dependency to retrieve the current application Settings."""
    return get_settings()


def get_cv_processing_service(
    settings: Settings = Depends(get_settings_dep),
) -> CVProcessingService:
    """Dependency to retrieve the CVProcessingService singleton or new instance."""
    return CVProcessingService(settings=settings)
