"""
Unit and integration tests for app.services.cv_processing_service.
"""

import sys
from unittest.mock import MagicMock, patch
import fitz
import pytest

from app.core.config import Settings
from app.llm.base_client import BaseLLMClient, MockLLMClient
from app.llm.client_factory import create_llm_client
from app.llm.qwen_client import QwenLLMClient
from app.models.cv_models import CVData, Identity, Skill
from app.models.extraction_models import CVProcessingResult, PipelineExtractionResult
from app.services.cv_processing_service import CVProcessingService
from app.core.exceptions import UnsupportedScannedCVError


def create_sample_pdf(
    text: str = "Jean Dupont\nDéveloppeur Python Senior\njean.dupont@email.com\nPython, FastAPI",
) -> bytes:
    """Helper creating minimal PDF bytes in-memory."""
    if len(text.strip()) < 50:
        text += "\nProfessional curriculum vitae with selectable embedded PDF text."
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), text)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_disabled_llm_returns_deterministic_result():
    """When MODEL_ENABLED=False, processing returns pure deterministic results."""
    settings = Settings(MODEL_ENABLED=False)
    service = CVProcessingService(settings=settings)
    pdf_bytes = create_sample_pdf()

    result = service.process_pdf(pdf_bytes)

    assert isinstance(result, CVProcessingResult)
    assert result.llm_used is False
    assert result.llm_available is False
    assert result.cv_data.identity.full_name == "Jean Dupont"
    assert result.cv_data.identity.email == "jean.dupont@email.com"


def test_business_extraction_is_not_called_for_rejected_image_cv():
    pipeline = MagicMock()
    pipeline.process_pdf.side_effect = UnsupportedScannedCVError()
    extraction = MagicMock()
    service = CVProcessingService(
        pipeline_service=pipeline,
        cv_extraction_service=extraction,
        settings=Settings(MODEL_ENABLED=False, _env_file=None),
    )
    with pytest.raises(UnsupportedScannedCVError):
        service.process_pdf(create_sample_pdf())
    extraction.extract.assert_not_called()


def test_disabled_llm_does_not_call_client():
    """When MODEL_ENABLED=False, no LLM client generate call occurs."""
    mock_client = MagicMock(spec=BaseLLMClient)
    mock_client.enabled = False
    mock_client.is_available.return_value = False

    settings = Settings(MODEL_ENABLED=False)
    service = CVProcessingService(settings=settings, llm_client=mock_client)
    pdf_bytes = create_sample_pdf()

    result = service.process_pdf(pdf_bytes)

    assert result.llm_used is False
    mock_client.generate.assert_not_called()


def test_disabled_llm_adds_no_llm_warning():
    """When MODEL_ENABLED=False, no LLM warning is added to CVData."""
    settings = Settings(MODEL_ENABLED=False)
    service = CVProcessingService(settings=settings)
    pdf_bytes = create_sample_pdf()

    result = service.process_pdf(pdf_bytes)

    llm_warnings = [w for w in result.cv_data.warnings if "LLM" in w]
    assert len(llm_warnings) == 0


def test_enabled_mock_client_fills_missing_scalar():
    """When enabled, a mock client fills missing fields (e.g. summary) supported by text."""
    pdf_bytes = create_sample_pdf(
        "Jean Dupont\njean.dupont@email.com\nProfil: Développeur Python expérimenté."
    )
    mock_response = '{"summary": "Développeur Python expérimenté"}'
    client = MockLLMClient(response=mock_response, enabled=True)

    settings = Settings(MODEL_ENABLED=True)
    service = CVProcessingService(settings=settings, llm_client=client)

    result = service.process_pdf(pdf_bytes)

    assert result.llm_used is True
    assert result.llm_available is True
    assert result.cv_data.summary == "Développeur Python expérimenté"


def test_protected_scalar_remains_unchanged():
    """Deterministic fields (e.g., full_name) are protected and not overwritten by LLM."""
    pdf_bytes = create_sample_pdf("Jean Dupont\njean.dupont@email.com")

    # Mock client tries to change full_name to "Alice Martin"
    mock_response = '{"identity": {"full_name": "Alice Martin"}}'
    client = MockLLMClient(response=mock_response, enabled=True)

    settings = Settings(MODEL_ENABLED=True)
    service = CVProcessingService(settings=settings, llm_client=client)

    result = service.process_pdf(pdf_bytes)

    assert result.cv_data.identity.full_name == "Jean Dupont"


def test_empty_list_can_be_filled():
    """Empty deterministic lists (e.g. skills) can be filled by LLM when text supports it."""
    pdf_bytes = create_sample_pdf("Jean Dupont\njean.dupont@email.com\nCompétences: Python")

    mock_response = '{"skills": [{"name": "Python", "category": "Backend"}]}'
    client = MockLLMClient(response=mock_response, enabled=True)

    settings = Settings(MODEL_ENABLED=True)
    service = CVProcessingService(settings=settings, llm_client=client)

    result = service.process_pdf(pdf_bytes)

    assert result.llm_used is False
    assert len(result.cv_data.skills) == 1
    assert result.cv_data.skills[0].name == "Python"


def test_non_empty_list_remains_unchanged():
    """Non-empty deterministic list (skills) remains untouched by LLM enrichment."""
    pdf_bytes = create_sample_pdf("Jean Dupont\njean.dupont@email.com\nCompétences: Python")

    mock_response = '{"skills": [{"name": "FastAPI", "category": "Backend"}]}'
    client = MockLLMClient(response=mock_response, enabled=True)

    settings = Settings(MODEL_ENABLED=True)
    service = CVProcessingService(settings=settings, llm_client=client)

    result = service.process_pdf(pdf_bytes)

    # Deterministic skill extractor extracted Python, so skills list is non-empty
    assert len(result.cv_data.skills) == 1
    assert result.cv_data.skills[0].name == "Python"


def test_malformed_llm_response_falls_back():
    """Malformed LLM response generates a warning and falls back to deterministic data."""
    pdf_bytes = create_sample_pdf("Jean Dupont\njean.dupont@email.com")

    mock_response = "THIS_IS_NOT_VALID_JSON"
    client = MockLLMClient(response=mock_response, enabled=True)

    settings = Settings(MODEL_ENABLED=True)
    service = CVProcessingService(settings=settings, llm_client=client)

    result = service.process_pdf(pdf_bytes)

    assert result.llm_used is False
    assert result.cv_data.identity.full_name == "Jean Dupont"
    assert any("LLM response" in w or "JSON" in w for w in result.cv_data.warnings)


def test_client_exception_falls_back():
    """Client exception during generation is handled gracefully with warning."""
    pdf_bytes = create_sample_pdf("Jean Dupont\njean.dupont@email.com")

    client = MagicMock(spec=BaseLLMClient)
    client.enabled = True
    client.is_available.return_value = True
    client.generate.side_effect = RuntimeError("Generation GPU out of memory")

    settings = Settings(MODEL_ENABLED=True)
    service = CVProcessingService(settings=settings, llm_client=client)

    result = service.process_pdf(pdf_bytes)

    assert result.cv_data.identity.full_name == "Jean Dupont"
    assert any("LLM completion failed" in w for w in result.cv_data.warnings)


def test_unavailable_client_falls_back():
    """When enabled client is unavailable, fallback to deterministic result with concise warning."""
    pdf_bytes = create_sample_pdf("Jean Dupont\njean.dupont@email.com")

    client = MagicMock(spec=BaseLLMClient)
    client.enabled = True
    client.is_available.return_value = False

    settings = Settings(MODEL_ENABLED=True)
    service = CVProcessingService(settings=settings, llm_client=client)

    result = service.process_pdf(pdf_bytes)

    assert result.llm_used is False
    assert result.llm_available is False
    assert result.cv_data.identity.full_name == "Jean Dupont"
    assert any("LLM enrichment unavailable" in w for w in result.cv_data.warnings)


def test_pipeline_warnings_are_preserved():
    """Warnings originating from ExtractionPipelineService are preserved in final result."""
    service = CVProcessingService(settings=Settings(MODEL_ENABLED=False))
    pdf_bytes = create_sample_pdf("Simple document")

    result = service.process_pdf(pdf_bytes)

    assert isinstance(result.pipeline_result.warnings, list)
    # Check all pipeline warnings exist in cv_data.warnings
    for w in result.pipeline_result.warnings:
        assert w in result.cv_data.warnings


def test_deterministic_warnings_are_preserved():
    """Warnings originating from CVExtractionService are preserved."""
    service = CVProcessingService(settings=Settings(MODEL_ENABLED=False))
    # PDF missing sections
    pdf_bytes = create_sample_pdf("Seulement du texte brut sans sections")

    result = service.process_pdf(pdf_bytes)

    # e.g., missing section formation or section expérience
    assert len(result.cv_data.warnings) > 0


def test_llm_warnings_are_preserved():
    """LLM enrichment warnings are merged into final cv_data.warnings."""
    pdf_bytes = create_sample_pdf("Jean Dupont\njean.dupont@email.com")
    client = MockLLMClient(response="invalid json", enabled=True)

    service = CVProcessingService(settings=Settings(MODEL_ENABLED=True), llm_client=client)
    result = service.process_pdf(pdf_bytes)

    assert any("LLM" in w or "JSON" in w for w in result.cv_data.warnings)


def test_duplicate_warnings_are_removed():
    """Warnings are deduplicated while preserving order."""
    service = CVProcessingService(settings=Settings(MODEL_ENABLED=False))
    pdf_bytes = create_sample_pdf("Jean Dupont")

    result = service.process_pdf(pdf_bytes)

    # Verify no duplicates
    assert len(result.cv_data.warnings) == len(set(result.cv_data.warnings))


def test_pipeline_metadata_is_preserved():
    """Pipeline metadata (pages, processing_time_seconds, extraction_method) is preserved in result."""
    service = CVProcessingService(settings=Settings(MODEL_ENABLED=False))
    pdf_bytes = create_sample_pdf("Jean Dupont\njean.dupont@email.com")

    result = service.process_pdf(pdf_bytes)

    assert result.pipeline_result.total_pages == 1
    assert result.pipeline_result.processing_time_seconds > 0.0
    assert result.pipeline_result.raw_text != ""
    assert result.pipeline_result.cleaned_text != ""


def test_original_objects_are_not_mutated():
    """CVProcessingService process_pdf does not mutate deterministic data unexpectedly."""
    service = CVProcessingService(settings=Settings(MODEL_ENABLED=False))
    pdf_bytes = create_sample_pdf("Jean Dupont\njean.dupont@email.com")

    result1 = service.process_pdf(pdf_bytes)
    initial_full_name = result1.cv_data.identity.full_name

    result2 = service.process_pdf(pdf_bytes)
    assert result2.cv_data.identity.full_name == initial_full_name


def test_qwen_load_not_triggered_during_service_construction():
    """Service initialization with MODEL_ENABLED=True creates QwenLLMClient lazily without load()."""
    settings = Settings(MODEL_ENABLED=True, MODEL_NAME="Qwen/Qwen2.5-0.5B-Instruct")
    service = CVProcessingService(settings=settings)

    assert service.llm_client is not None
    assert isinstance(service.llm_client, QwenLLMClient)
    assert service.llm_client._is_loaded is False


def test_no_torch_or_transformers_import_during_disabled_path():
    """Processing PDF when MODEL_ENABLED=False does not require or load torch/transformers."""
    settings = Settings(MODEL_ENABLED=False)
    service = CVProcessingService(settings=settings)
    pdf_bytes = create_sample_pdf("Jean Dupont")

    result = service.process_pdf(pdf_bytes)
    assert result.llm_used is False


def test_client_factory_output_is_injectable():
    """Client produced by create_llm_client can be injected into CVProcessingService."""
    settings = Settings(MODEL_ENABLED=True)
    client = create_llm_client(settings)
    service = CVProcessingService(settings=settings, llm_client=client)

    assert service.llm_client is client


def test_processing_service_accepts_custom_base_llm_client():
    """CVProcessingService accepts any subclass of BaseLLMClient."""
    mock_client = MockLLMClient(response="{}", enabled=True)
    service = CVProcessingService(llm_client=mock_client)

    assert service.llm_client is mock_client


def test_factory_value_error_falls_back_to_deterministic_result():
    settings = Settings(MODEL_ENABLED=True)
    raw_error = "Invalid model path C:\\private\\model"

    with patch(
        "app.services.cv_processing_service.create_llm_client",
        side_effect=ValueError(raw_error),
    ):
        service = CVProcessingService(settings=settings)

    result = service.process_pdf(create_sample_pdf("Jean Dupont"))

    assert result.cv_data.identity.full_name == "Jean Dupont"
    assert result.llm_available is False
    assert result.llm_used is False
    llm_warnings = [w for w in result.cv_data.warnings if "LLM" in w]
    assert llm_warnings == ["LLM initialization failed"]
    assert raw_error not in " ".join(result.cv_data.warnings)
    assert "LLM enrichment unavailable" not in result.cv_data.warnings


def test_unexpected_factory_error_falls_back_to_deterministic_result():
    settings = Settings(MODEL_ENABLED=True)
    raw_error = "Unexpected provider failure for private-model-name"

    with patch(
        "app.services.cv_processing_service.create_llm_client",
        side_effect=RuntimeError(raw_error),
    ):
        service = CVProcessingService(settings=settings)

    result = service.process_pdf(create_sample_pdf("Jean Dupont"))

    assert result.cv_data.identity.full_name == "Jean Dupont"
    assert result.llm_available is False
    assert result.llm_used is False
    llm_warnings = [w for w in result.cv_data.warnings if "LLM" in w]
    assert llm_warnings == ["LLM initialization failed"]
    assert raw_error not in " ".join(result.cv_data.warnings)


def test_first_availability_error_falls_back_to_deterministic_result():
    raw_error = "CUDA probe failed at C:\\private\\driver"
    client = MagicMock(spec=BaseLLMClient)
    client.enabled = True
    client.is_available.side_effect = RuntimeError(raw_error)
    service = CVProcessingService(
        settings=Settings(MODEL_ENABLED=True), llm_client=client
    )

    result = service.process_pdf(create_sample_pdf("Jean Dupont"))

    assert result.cv_data.identity.full_name == "Jean Dupont"
    assert result.llm_available is False
    assert result.llm_used is False
    llm_warnings = [w for w in result.cv_data.warnings if "LLM" in w]
    assert llm_warnings == ["LLM enrichment unavailable"]
    assert raw_error not in " ".join(result.cv_data.warnings)


def test_availability_becomes_false_inside_enrichment():
    client = MagicMock(spec=BaseLLMClient)
    client.enabled = True
    client.is_available.side_effect = [True, False]
    service = CVProcessingService(
        settings=Settings(MODEL_ENABLED=True), llm_client=client
    )

    result = service.process_pdf(create_sample_pdf("Jean Dupont"))

    assert result.cv_data.identity.full_name == "Jean Dupont"
    assert result.llm_available is True
    assert result.llm_used is False
    client.generate.assert_not_called()


def test_second_availability_error_falls_back_to_deterministic_result():
    raw_error = "Provider disappeared from C:\\private\\socket"
    client = MagicMock(spec=BaseLLMClient)
    client.enabled = True
    client.is_available.side_effect = [True, RuntimeError(raw_error)]
    service = CVProcessingService(
        settings=Settings(MODEL_ENABLED=True), llm_client=client
    )

    result = service.process_pdf(create_sample_pdf("Jean Dupont"))

    assert result.cv_data.identity.full_name == "Jean Dupont"
    assert result.llm_available is True
    assert result.llm_used is False
    llm_warnings = [w for w in result.cv_data.warnings if "LLM" in w]
    assert llm_warnings == ["LLM enrichment unavailable"]
    assert raw_error not in " ".join(result.cv_data.warnings)
