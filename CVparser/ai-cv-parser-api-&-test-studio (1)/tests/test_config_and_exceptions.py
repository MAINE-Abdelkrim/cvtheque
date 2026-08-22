"""
Unit tests for configuration loading, custom exceptions, constants, and timing utilities.
"""

import time
import pytest
from pydantic import ValidationError
from app.core.config import get_settings, OCRLayoutMode, Settings
from app.core.exceptions import (
    InvalidPDFError,
    UnsupportedFileTypeError,
    OCRUnavailableError,
    JSONValidationError,
    NoJSONObjectFoundError,
    MalformedJSONError,
    LLMUnavailableError,
    PDFPageLimitError,
)
from app.core.constants import (
    PIPELINE_STEP_NAMES,
    ERROR_CODES,
    WARNING_CODES,
    QUALITY_THRESHOLDS,
    SUPPORTED_LAYOUT_TYPES,
    DEFAULT_OCR_LANGUAGE,
    DEFAULT_DPI,
    MAX_UPLOAD_SIZE_MB,
    SECTION_HEADER_ALIASES,
)
from app.utils.timing import Timer


def test_settings_defaults(monkeypatch):
    monkeypatch.delenv("MIN_NATIVE_TEXT_CHARS_PER_PAGE", raising=False)
    monkeypatch.delenv("MIN_NATIVE_TEXT_RATIO", raising=False)
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.APP_NAME == "AI CV Parser API"
    assert settings.MODEL_NAME == "Qwen/Qwen2.5-0.5B-Instruct"
    assert settings.MODEL_ENABLED is False
    assert settings.MODEL_LOCAL_FILES_ONLY is True
    assert settings.MODEL_DEVICE == "cpu"
    assert settings.MODEL_TORCH_DTYPE == "auto"
    assert settings.MODEL_MAX_NEW_TOKENS == 512
    assert settings.MODEL_DO_SAMPLE is False
    assert settings.MODEL_TEMPERATURE == 0.0
    assert settings.MODEL_TOP_P == 0.9
    assert settings.MODEL_REPETITION_PENALTY == 1.1
    assert settings.MODEL_TRUST_REMOTE_CODE is False
    assert settings.OCR_LAYOUT_MODE in [e.value for e in OCRLayoutMode]
    assert settings.MIN_NATIVE_TEXT_CHARS_PER_PAGE == 50
    assert settings.MIN_NATIVE_TEXT_RATIO == 0.6
    assert settings.MAX_PDF_PAGES == 20
    assert not hasattr(settings, "MODEL_EXECUTION_MODE")
    assert not hasattr(settings, "MODEL_LOAD_IN_4BIT")
    assert not hasattr(settings, "MODEL_ALLOW_CPU_FALLBACK")
    assert not hasattr(settings, "MODEL_LAZY_LOADING")


def test_enums_values():
    assert OCRLayoutMode.AUTO.value == "auto"
    assert OCRLayoutMode.SINGLE_COLUMN.value == "single_column"
    assert OCRLayoutMode.TWO_COLUMNS.value == "two_columns"


def test_custom_exceptions_inheritance():
    err1 = InvalidPDFError("PDF corrompu")
    assert err1.status_code == 400
    assert err1.code == "INVALID_PDF"

    err2 = UnsupportedFileTypeError("Document Word non supporté")
    assert err2.status_code == 415
    assert err2.code == "UNSUPPORTED_FILE_TYPE"

    err3 = LLMUnavailableError("VRAM insuffisante")
    assert err3.status_code == 503
    assert err3.code == "LLM_UNAVAILABLE"

    # Specialized JSON validation errors
    no_json_err = NoJSONObjectFoundError("Aucun JSON trouvé")
    assert isinstance(no_json_err, JSONValidationError)
    assert no_json_err.code == "NO_JSON_OBJECT_FOUND"
    assert no_json_err.status_code == 422

    malformed_err = MalformedJSONError("JSON tronqué")
    assert isinstance(malformed_err, JSONValidationError)
    assert malformed_err.code == "MALFORMED_JSON"
    assert malformed_err.status_code == 422


def test_pdf_page_limit_exception_contract():
    err = PDFPageLimitError("PDF exceeds the maximum allowed page count of 20.")
    assert err.status_code == 413
    assert err.code == "PDF_PAGE_LIMIT_EXCEEDED"


@pytest.mark.parametrize("value", [0, -1, "not-an-integer"])
def test_pdf_page_limit_must_be_positive_integer(value):
    with pytest.raises(ValidationError):
        Settings(MAX_PDF_PAGES=value, _env_file=None)


def test_constants_defined():
    assert len(PIPELINE_STEP_NAMES) == 8
    assert "pdf_validation" in PIPELINE_STEP_NAMES
    assert ERROR_CODES["INVALID_PDF"] == "INVALID_PDF"
    assert WARNING_CODES["LOW_NATIVE_TEXT"] == "LOW_NATIVE_TEXT"
    assert QUALITY_THRESHOLDS["HIGH"] == 0.85
    assert "single_column" in SUPPORTED_LAYOUT_TYPES
    assert DEFAULT_OCR_LANGUAGE == "fra+eng"
    assert DEFAULT_DPI == 300
    assert MAX_UPLOAD_SIZE_MB == 10
    assert "EXPERIENCES" in SECTION_HEADER_ALIASES


def test_timer_lap():
    with Timer() as t:
        time.sleep(0.01)
        lap1 = t.lap()
        assert lap1 > 0
        time.sleep(0.01)
        lap2 = t.lap()
        assert lap2 > lap1
    assert t.duration_ms >= lap2
