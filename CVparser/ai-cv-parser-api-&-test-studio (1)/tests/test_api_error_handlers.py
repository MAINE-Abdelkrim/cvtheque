"""
Tests for API exception handlers and error response schemas.
"""

import pytest
import fitz
from fastapi.testclient import TestClient
from app.main import app
from app.core.exceptions import CVParserError
from app.api.dependencies import get_cv_processing_service


@pytest.fixture
def valid_pdf_bytes() -> bytes:
    """Generate a tiny valid PDF in memory using PyMuPDF (fitz)."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), "John Doe\nSoftware Engineer")
    pdf_bytes = doc.write()
    doc.close()
    return pdf_bytes


def test_controlled_cv_parser_error_shape(valid_pdf_bytes):
    """Test that a custom CVParserError is correctly handled, formatted, and returns the expected status code and shape."""
    client = TestClient(app)

    # 1. Mock service to raise a custom CVParserError
    def mock_parser_error_service():
        class MockService:
            def process_pdf(self, *args, **kwargs):
                raise CVParserError(
                    message="Extraction step failed due to layout constraints.",
                    code="LAYOUT_PARSE_FAILED",
                    status_code=422,
                    extra_data={"page": 1}
                )
        return MockService()

    app.dependency_overrides[get_cv_processing_service] = mock_parser_error_service

    try:
        response = client.post(
            "/api/v1/cv/parse",
            files={"file": ("cv.pdf", valid_pdf_bytes, "application/pdf")}
        )
        assert response.status_code == 422
        data = response.json()
        
        # Verify schema keys
        assert data["error"] == "CVParserError"
        assert data["code"] == "LAYOUT_PARSE_FAILED"
        assert data["detail"] == "Extraction step failed due to layout constraints."
        assert data["extra_data"] == {"page": 1}
        assert "timestamp" in data
        
        # Ensure no traceback is included
        assert "traceback" not in data
    finally:
        app.dependency_overrides.clear()


def test_unexpected_runtime_exception_sanitization(valid_pdf_bytes):
    """Test that an unhandled RuntimeError is caught, logged, sanitized, and returns 500 without exposing stack traces."""
    client = TestClient(app, raise_server_exceptions=False)

    # 1. Mock service to raise standard unhandled RuntimeError
    def mock_failing_service():
        class MockService:
            def process_pdf(self, *args, **kwargs):
                raise RuntimeError("Internal critical core dump or database crash at /usr/local/bin")
        return MockService()

    app.dependency_overrides[get_cv_processing_service] = mock_failing_service

    try:
        response = client.post(
            "/api/v1/cv/parse",
            files={"file": ("cv.pdf", valid_pdf_bytes, "application/pdf")}
        )
        assert response.status_code == 500
        data = response.json()
        
        # Verify sanitized shape and values
        assert data["error"] == "InternalServerError"
        assert data["code"] == "INTERNAL_SERVER_ERROR"
        assert data["detail"] == "An unexpected internal server error occurred."
        assert data["extra_data"] is None
        assert "timestamp" in data
        
        # Ensure that no raw error details or local file systems are leaked
        assert "/usr/local/bin" not in data["detail"]
        assert "RuntimeError" not in data["detail"]
    finally:
        app.dependency_overrides.clear()
