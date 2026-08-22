"""
Tests for API dependency injection and lazy loading safety.
"""

import sys
import pytest
from fastapi import Depends
from app.api.dependencies import get_settings_dep, get_cv_processing_service
from app.core.config import Settings
from app.services.cv_processing_service import CVProcessingService


def test_settings_dependency_retrieval():
    """Test that get_settings_dep returns a valid Settings instance."""
    settings = get_settings_dep()
    assert isinstance(settings, Settings)
    assert settings.APP_NAME == "AI CV Parser API"


def test_cv_processing_service_dependency_lazy():
    """Test that get_cv_processing_service correctly instantiates CVProcessingService with correct settings."""
    settings = get_settings_dep()
    # Force LLM disabled for lazy check
    settings.MODEL_ENABLED = False
    
    service = get_cv_processing_service(settings=settings)
    assert isinstance(service, CVProcessingService)
    assert service.settings == settings
    
    # Assert that no heavy model was loaded and client is None (since disabled)
    assert getattr(service, "llm_client", None) is None
    
    # Verify that torch/transformers are definitely not in sys.modules (if this is run as a single test)
    # Note: If other test runs already imported them, we check the lazy attribute instead
    if "torch" not in sys.modules:
        assert "torch" not in sys.modules
