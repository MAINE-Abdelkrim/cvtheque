"""
Health check route for the CV Parser API.
"""

from fastapi import APIRouter, Depends
from app.core.config import Settings, get_settings
from app.api.dependencies import get_settings_dep
from app.models.response_models import HealthResponse


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def get_health(settings: Settings = Depends(get_settings_dep)) -> HealthResponse:
    """Return a simple, stable health status check.

    No PyTorch, HuggingFace, or GPU checks are run here to prevent eager imports of
    torch or transformers.
    """
    return HealthResponse(
        status="ok",
        ocr_available=False,
        tesseract_languages=[],
        model_execution_mode="disabled" if not settings.MODEL_ENABLED else "lazy",
        model_loaded=False,
        model_available=settings.MODEL_ENABLED,
        cuda_available=False,
        bitsandbytes_available=False,
        selected_device="disabled" if not settings.MODEL_ENABLED else settings.MODEL_DEVICE,
        gpu_name=None,
        vram_total_gb=None,
        vram_free_gb=None,
        cpu_fallback_allowed=False,
        model_status_message="Model is disabled" if not settings.MODEL_ENABLED else "Model is enabled and lazy loading is ready.",
    )
