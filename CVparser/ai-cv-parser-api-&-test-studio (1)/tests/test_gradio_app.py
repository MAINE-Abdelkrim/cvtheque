"""
Tests for the Gradio CV parser demonstration interface in app/ui/gradio_app.py.
"""

import os
import tempfile
import pytest
import fitz
import gradio as gr
from unittest.mock import MagicMock, patch

from app.core.config import Settings
from app.core.exceptions import (
    InvalidPDFError, UnsupportedFileTypeError, CVParserError,
    UnsupportedScannedCVError,
)
from app.models.cv_models import CVData, Identity, Skill
from app.models.extraction_models import CVProcessingResult, PipelineExtractionResult
from app.models.response_models import ExtractionMethod
from app.services.cv_processing_service import CVProcessingService
from app.ui.gradio_app import create_gradio_app


def create_minimal_pdf(text: str) -> str:
    """Helper to generate a real PDF in-memory and write it to a temporary file."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), text)
    temp_file = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_file.write(doc.tobytes())
    temp_file.close()
    doc.close()
    return temp_file.name


@pytest.fixture
def clean_pdf():
    path = create_minimal_pdf("John Doe\nSoftware Engineer\njohn@example.com\nSkills: Python")
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def mock_service() -> MagicMock:
    """Fixture to provide a mocked CVProcessingService."""
    service = MagicMock(spec=CVProcessingService)
    service.settings = Settings(MODEL_ENABLED=False)
    service.llm_client = None
    
    # Setup standard success return value
    cv_data = CVData(
        identity=Identity(full_name="John Doe", email="john@example.com", job_title="Software Engineer"),
        summary="Experienced engineer",
        skills=[Skill(name="Python", category="programming_language", source="skills_section")],
    )
    pipeline_result = PipelineExtractionResult(
        raw_text="John Doe Software Engineer",
        cleaned_text="john doe software engineer",
        extraction_method=ExtractionMethod.NATIVE_PDF,
        total_pages=1,
        processing_time_seconds=0.1,
    )
    processing_result = CVProcessingResult(
        pipeline_result=pipeline_result,
        cv_data=cv_data,
        llm_used=False,
        llm_available=False,
    )
    service.process_pdf.return_value = processing_result
    return service


def test_factory_returns_blocks_and_is_injectable(mock_service):
    """Confirm the factory returns a Gradio Blocks app without launching any server or loading models."""
    settings = Settings(MODEL_ENABLED=False)
    demo = create_gradio_app(settings=settings, processing_service=mock_service)
    
    assert isinstance(demo, gr.Blocks)
    assert demo.handle_parsing is not None
    assert demo.handle_reset is not None
    # No server is started
    assert getattr(demo, "server_port", None) is None


def test_gradio_scanned_cv_error_is_clear_and_not_a_candidate_success(clean_pdf, mock_service):
    mock_service.process_pdf.side_effect = UnsupportedScannedCVError()
    demo = create_gradio_app(processing_service=mock_service)
    overview, serialized, diagnostics, _, _, export, status = demo.handle_parsing(clean_pdf)
    assert overview == "Parsing failed."
    assert serialized == {} and diagnostics == {} and export is None
    assert "texte sélectionnable" in status
    assert "N/A" not in overview and "Candidate Overview" not in overview
    assert "traceback" not in status.lower() and "Tesseract" not in status


def test_app_construction_import_safety(isolated_python):
    """Verify Gradio application construction does not load LLM runtime dependencies."""
    code = """
import sys
from app.core.config import Settings
from app.ui.gradio_app import create_gradio_app
create_gradio_app(settings=Settings(MODEL_ENABLED=False, _env_file=None))
assert 'torch' not in sys.modules
assert 'transformers' not in sys.modules
print('OK')
"""
    result = isolated_python(code)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "OK"


def test_parsing_handler_no_file():
    """Verify handling when no file is selected."""
    demo = create_gradio_app()
    overview, json_out, diag, warnings, llm_status, download_file, status = demo.handle_parsing(None)
    
    assert "Error occurred" in overview or "failed" in overview.lower()
    assert json_out == {}
    assert diag == {}
    assert download_file is None
    assert "No file selected" in status


def test_parsing_handler_valid_pdf_no_llm(clean_pdf, mock_service):
    """Test standard valid PDF parsing with disabled/mocked LLM."""
    settings = Settings(MODEL_ENABLED=False)
    demo = create_gradio_app(settings=settings, processing_service=mock_service)
    
    overview, json_out, diag, warnings, llm_status, download_file, status = demo.handle_parsing(clean_pdf)
    
    # 1. Check overview includes candidate info
    assert "John Doe" in overview
    assert "Software Engineer" in overview
    
    # 2. Check JSON output matches schema
    assert json_out["cv_data"]["identity"]["full_name"] == "John Doe"
    assert json_out["llm_used"] is False
    
    # 3. Check diagnostics
    assert diag["page_count"] == 1
    assert diag["extraction_method"] == "native_pdf"
    assert diag["raw_text"] == "John Doe Software Engineer"
    assert diag["cleaned_text"] == "john doe software engineer"
    assert diag["llm_used"] is False
    assert diag["llm_available"] is False
    
    # 4. LLM status showing clearly disabled
    assert "MODEL_ENABLED=False" in llm_status
    assert "Disabled" in llm_status
    
    # 5. Parsing alone does not persist an export file
    assert download_file is None
    assert "Success" in status


def test_parsing_handler_valid_pdf_with_mocked_llm(clean_pdf, mock_service):
    """Test parser handler when LLM is mocked as enabled and used."""
    settings = Settings(MODEL_ENABLED=True)
    # Configure mock service to simulate successful LLM enrichment
    mock_service.settings = settings
    mock_service.llm_client = MagicMock()
    mock_service.llm_client.is_available.return_value = True
    mock_service.llm_client.model_name = "MockQwen"
    
    cv_data = CVData(
        identity=Identity(full_name="John Doe", email="john@example.com", job_title="Software Engineer"),
        summary="Enriched summary via LLM",
        skills=[Skill(name="Python", category="programming_language", source="skills_section")],
    )
    pipeline_result = PipelineExtractionResult(
        raw_text="John Doe Software Engineer",
        cleaned_text="john doe software engineer",
        extraction_method=ExtractionMethod.NATIVE_PDF,
        total_pages=1,
        processing_time_seconds=0.1,
    )
    processing_result = CVProcessingResult(
        pipeline_result=pipeline_result,
        cv_data=cv_data,
        llm_used=True,
        llm_available=True,
    )
    mock_service.process_pdf.return_value = processing_result
    
    demo = create_gradio_app(settings=settings, processing_service=mock_service)
    
    overview, json_out, diag, warnings, llm_status, download_file, status = demo.handle_parsing(clean_pdf)
    
    assert json_out["llm_used"] is True
    assert "MODEL_ENABLED=True" in llm_status
    assert "Available" in llm_status
    assert "Used for last document**: Yes" in llm_status


def test_parsing_handler_invalid_signature():
    """Verify clean message when PDF signature is missing."""
    temp_path = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_path.write(b"this_is_not_a_pdf_at_all_and_fails_signature_check")
    temp_path.close()
    
    try:
        demo = create_gradio_app()
        overview, json_out, diag, warnings, llm_status, download_file, status = demo.handle_parsing(temp_path.name)
        
        assert "not a valid PDF" in status
        assert download_file is None
    finally:
        os.unlink(temp_path.name)


def test_parsing_handler_malformed_pdf():
    """Verify clean message when PDF is corrupted or malformed."""
    temp_path = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    # Valid PDF signature but completely corrupted/malformed tail
    temp_path.write(b"%PDF-1.4\n%\\xe2\\xe3\\xcf\\xd3\nthis_is_corrupt_garbage_with_no_objects")
    temp_path.close()
    
    # We will mock the process_pdf or let PyMuPDF fail naturally (which raises InvalidPDFError in pdf_service)
    try:
        demo = create_gradio_app()
        overview, json_out, diag, warnings, llm_status, download_file, status = demo.handle_parsing(temp_path.name)
        
        # We mapped malformed PDF to the exact requested string
        assert "malformed or corrupted" in status
        assert download_file is None
    finally:
        os.unlink(temp_path.name)


def test_parsing_handler_oversized_pdf(clean_pdf, mock_service):
    """Verify clean message when PDF exceeds MAX_FILE_SIZE_MB."""
    settings = Settings(MAX_FILE_SIZE_MB=0)  # 0 MB limit makes any file oversized
    demo = create_gradio_app(settings=settings, processing_service=mock_service)
    
    overview, json_out, diag, warnings, llm_status, download_file, status = demo.handle_parsing(clean_pdf)
    
    assert "exceeds the maximum" in status
    assert "0 MB" in status or "exceeds" in status
    assert download_file is None


def test_parsing_handler_controlled_exception(clean_pdf, mock_service):
    """Test clean UI message for expected CVParserError."""
    mock_service.process_pdf.side_effect = InvalidPDFError("The uploaded PDF file is empty.")
    demo = create_gradio_app(processing_service=mock_service)
    
    overview, json_out, diag, warnings, llm_status, download_file, status = demo.handle_parsing(clean_pdf)
    
    assert "empty" in status
    assert download_file is None


def test_parsing_handler_unexpected_exception(clean_pdf, mock_service):
    """Test clean UI message for unexpected exceptions (e.g. RuntimeError)."""
    mock_service.process_pdf.side_effect = RuntimeError("database or model crash")
    demo = create_gradio_app(processing_service=mock_service)
    
    overview, json_out, diag, warnings, llm_status, download_file, status = demo.handle_parsing(clean_pdf)
    
    assert "unexpected processing error occurred" in status
    # Asserts no internal tracebacks or secrets leak
    assert "database or model crash" not in status
    assert "RuntimeError" not in status
    assert download_file is None


def test_parsing_handler_no_leak_of_tracebacks_and_paths(clean_pdf, mock_service):
    """Verify that exception details, stack traces, and local filesystem paths never leak into UI outputs."""
    # Raise exception with lots of internal path and traceback data
    mock_service.process_pdf.side_effect = ValueError("/home/user/app/core/secret_key.py: line 42 traceback details")
    demo = create_gradio_app(processing_service=mock_service)
    
    overview, json_out, diag, warnings, llm_status, download_file, status = demo.handle_parsing(clean_pdf)
    
    # The output status should be safe and sanitized
    assert "/home/user" not in status
    assert "traceback" not in status.lower()
    assert "secret_key" not in status
    assert "An unexpected processing error occurred" in status


def test_reset_behavior_clears_prior_states(clean_pdf, mock_service):
    """Ensure that the reset handler returns empty/default states for all output slots."""
    demo = create_gradio_app(processing_service=mock_service)
    
    # 1. Parse first
    overview, json_out, diag, warnings, llm_status, download_file, status = demo.handle_parsing(clean_pdf)
    assert "John Doe" in overview
    assert json_out != {}
    assert download_file is None
    
    # 2. Trigger Reset
    file_in, overview, json_out, diag, warnings, llm_status, download_file, status_msg = demo.handle_reset()
    
    # 3. Assert all states cleared
    assert file_in is None
    assert "Parse CV" in overview or "Upload" in overview
    assert json_out == {}
    assert diag == {}
    assert "No warnings" in warnings
    assert download_file is None
    assert status_msg == ""
