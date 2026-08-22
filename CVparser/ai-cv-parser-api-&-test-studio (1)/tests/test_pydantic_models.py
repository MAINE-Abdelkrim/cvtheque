"""
Unit tests for CV and Response Pydantic models to verify:
- None for missing simple fields
- Empty list [] for missing lists
- Renamed enums (ExtractionMethod, LayoutType, ValidationAction, etc.)
- Numeric constraints (scores between 0 and 1, page_number >= 1, etc.)
"""

import pytest
from pydantic import ValidationError
from app.models.cv_models import CVData, Identity, Experience, Skill
from app.models.response_models import (
    ExtractionMethod,
    LayoutType,
    PipelineStatus,
    QualityLevel,
    ValidationAction,
    PageDiagnostic,
    PipelineStep,
    QualityMetric,
    QualityReport,
    ValidationAnomaly,
    ExtractionMetadata,
)


def test_cv_data_defaults():
    cv = CVData()
    assert cv.identity.full_name is None
    assert cv.identity.email is None
    assert cv.identity.other_links == []
    assert cv.professional_summary is None
    assert cv.skills == []
    assert cv.experiences == []
    assert cv.education == []
    assert cv.languages == []
    assert cv.certifications == []


def test_cv_data_dump_json_matches_schema():
    cv = CVData(
        identity=Identity(full_name="Alice Martin", email="alice@example.com"),
        skills=[Skill(name="Python"), Skill(name="FastAPI")],
        experiences=[
            Experience(job_title="Data Scientist", company="Tech Corp", start_date="2022")
        ]
    )
    data = cv.model_dump()
    assert data["identity"]["full_name"] == "Alice Martin"
    assert data["identity"]["email"] == "alice@example.com"
    assert data["identity"]["phone"] is None
    assert len(data["skills"]) == 2
    assert data["skills"][0]["name"] == "Python"
    assert len(data["experiences"]) == 1
    assert data["experiences"][0]["company"] == "Tech Corp"
    assert data["experiences"][0]["end_date"] is None


def test_extraction_method_enum_values():
    assert ExtractionMethod.NATIVE_PDF == "native_pdf"
    assert ExtractionMethod.OCR_TESSERACT == "ocr_tesseract"
    assert ExtractionMethod.HYBRID == "hybrid"
    assert ExtractionMethod.NONE == "none"


def test_layout_type_enum_values():
    assert LayoutType.SINGLE_COLUMN == "single_column"
    assert LayoutType.TWO_COLUMNS == "two_columns"
    assert LayoutType.MIXED == "mixed"
    assert LayoutType.UNKNOWN == "unknown"


def test_validation_action_enum_values():
    assert ValidationAction.KEPT == "kept"
    assert ValidationAction.KEPT_WITH_WARNING == "kept_with_warning"
    assert ValidationAction.NORMALIZED == "normalized"
    assert ValidationAction.REMOVED == "removed"
    assert ValidationAction.REPLACED_WITH_NULL == "replaced_with_null"


def test_pydantic_numeric_constraints():
    # Valid PageDiagnostic
    diag = PageDiagnostic(
        page_number=1,
        extraction_method=ExtractionMethod.NATIVE_PDF,
        layout_detected=LayoutType.SINGLE_COLUMN,
        native_text_length=150,
        ocr_used=False,
    )
    assert diag.page_number == 1

    # Invalid page_number = 0
    with pytest.raises(ValidationError):
        PageDiagnostic(
            page_number=0,
            extraction_method=ExtractionMethod.NATIVE_PDF,
            layout_detected=LayoutType.SINGLE_COLUMN,
            native_text_length=150,
            ocr_used=False,
        )

    # Invalid QualityMetric score > 1.0
    with pytest.raises(ValidationError):
        QualityMetric(
            name="completeness",
            score=1.5,
            weight=0.5,
            explanation="Score trop élevé",
        )

    # Invalid QualityMetric score < 0.0
    with pytest.raises(ValidationError):
        QualityMetric(
            name="completeness",
            score=-0.1,
            weight=0.5,
            explanation="Score négatif",
        )

    # Invalid duration_ms negative in PipelineStep
    with pytest.raises(ValidationError):
        PipelineStep(
            name="pdf_validation",
            status=PipelineStatus.SUCCESS,
            duration_ms=-10.0,
        )

    # Invalid ExtractionMetadata file_size_bytes negative
    with pytest.raises(ValidationError):
        ExtractionMetadata(
            filename="cv.pdf",
            file_size_bytes=-100,
            total_pages=1,
            extraction_method=ExtractionMethod.NATIVE_PDF,
            model_execution_mode="auto",
        )
