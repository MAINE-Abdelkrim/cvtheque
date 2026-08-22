"""
Tests for Gradio presenter helper functions in app/ui/presenters.py.
"""

import pytest
from app.models.cv_models import CVData, Identity, Skill, Language
from app.models.extraction_models import CVProcessingResult, PipelineExtractionResult, PageExtractionResult
from app.models.response_models import ExtractionMethod, LayoutType, PipelineStep, PipelineStatus
from app.ui.presenters import (
    serialize_cv_processing_result,
    build_candidate_overview,
    build_diagnostics,
    format_warnings,
)


@pytest.fixture
def sample_result() -> CVProcessingResult:
    """Fixture creating a robust CVProcessingResult mock-like Pydantic object."""
    identity = Identity(
        full_name="Alice Smith",
        job_title="Software Architect",
        email="alice@example.com",
        phone="+123456789",
        location="Paris, France",
    )
    cv_data = CVData(
        identity=identity,
        summary="Experienced software architect specializing in Python.",
        skills=[
            Skill(name="Python", category="programming_language", source="skills_section"),
            Skill(name="FastAPI", category="framework", source="skills_section"),
        ],
        languages=[
            Language(language="English", level="Fluent"),
            Language(language="French", level="Native"),
        ],
        warnings=["Missing education end date", "Duplicate skill skipped"],
    )
    
    page = PageExtractionResult(
        page_number=1,
        native_text="Alice Smith Software Architect",
        native_text_length=30,
        native_text_ratio=1.0,
        extraction_method=ExtractionMethod.NATIVE_PDF,
        layout_type=LayoutType.SINGLE_COLUMN,
    )
    
    pipeline_result = PipelineExtractionResult(
        raw_text="Alice Smith Software Architect",
        cleaned_text="alice smith software architect",
        sections={"identity": "Alice Smith Software Architect"},
        detected_sections=["identity", "skills"],
        pages=[page],
        extraction_method=ExtractionMethod.NATIVE_PDF,
        warnings=["Pipeline warning 1", "Missing education end date"],
        pipeline_steps=[
            PipelineStep(name="Text Extraction", status=PipelineStatus.SUCCESS, duration_ms=120.0),
            PipelineStep(name="Layout Parsing", status=PipelineStatus.SUCCESS, duration_ms=50.0),
        ],
        total_pages=1,
        processing_time_seconds=0.17,
    )
    
    return CVProcessingResult(
        pipeline_result=pipeline_result,
        cv_data=cv_data,
        llm_used=False,
        llm_available=False,
    )


def test_processing_result_serializes_correctly(sample_result):
    """Test that serialize_cv_processing_result converts Pydantic objects to dict successfully."""
    serialized = serialize_cv_processing_result(sample_result)
    assert isinstance(serialized, dict)
    assert serialized["llm_used"] is False
    assert serialized["cv_data"]["identity"]["full_name"] == "Alice Smith"
    assert serialized["pipeline_result"]["total_pages"] == 1


def test_candidate_overview_populated(sample_result):
    """Test build_candidate_overview with fully populated data."""
    overview = build_candidate_overview(sample_result)
    assert "Alice Smith" in overview
    assert "Software Architect" in overview
    assert "alice@example.com" in overview
    assert "**Skills**: 2" in overview
    assert "**Languages**: 2" in overview
    assert "Experienced software architect" in overview


def test_candidate_overview_missing_fields():
    """Test build_candidate_overview with empty / missing optional fields."""
    empty_cv_data = CVData()
    empty_pipeline = PipelineExtractionResult(
        extraction_method=ExtractionMethod.NONE,
        total_pages=1,
        processing_time_seconds=0.0,
    )
    result = CVProcessingResult(
        pipeline_result=empty_pipeline,
        cv_data=empty_cv_data,
        llm_used=False,
        llm_available=False,
    )
    overview = build_candidate_overview(result)
    assert "N/A" in overview
    assert "**Skills**: 0" in overview


def test_diagnostics_preserves_metadata(sample_result):
    """Test build_diagnostics preserves pipeline diagnostics correctly."""
    diagnostics = build_diagnostics(sample_result)
    assert diagnostics["extraction_method"] == "native_pdf"
    assert diagnostics["page_count"] == 1
    assert "identity" in diagnostics["detected_sections"]
    assert len(diagnostics["pipeline_steps"]) == 2
    assert diagnostics["pipeline_steps"][0]["name"] == "Text Extraction"
    assert diagnostics["pipeline_steps"][0]["status"] == "success"
    assert diagnostics["processing_time"] == 0.17


def test_warnings_preserves_order_and_uniqueness(sample_result):
    """Test that format_warnings returns a unique ordered list of warnings."""
    # Ensure warnings has order: "Missing education end date", "Duplicate skill skipped"
    warnings = format_warnings(sample_result)
    assert isinstance(warnings, list)
    assert len(warnings) == 2
    assert warnings[0] == "Missing education end date"
    assert warnings[1] == "Duplicate skill skipped"


def test_serialization_no_prompts(sample_result):
    """Confirm that serialization does not expose prompts, secrets, or raw model completions."""
    serialized = serialize_cv_processing_result(sample_result)
    
    # Assert standard keys are there, but forbidden terms are not in the dictionary structure
    forbidden_keys = ["prompt", "raw_llm", "secret", "tokenizer", "model_object"]
    
    def check_forbidden(d):
        if isinstance(d, dict):
            for k, v in d.items():
                assert k not in forbidden_keys
                check_forbidden(v)
        elif isinstance(d, list):
            for item in d:
                check_forbidden(item)

    check_forbidden(serialized)


def test_original_result_not_mutated(sample_result):
    """Verify that formatting helpers do not mutate the input CVProcessingResult."""
    original_warnings = list(sample_result.cv_data.warnings)
    original_name = sample_result.cv_data.identity.full_name

    _ = serialize_cv_processing_result(sample_result)
    _ = build_candidate_overview(sample_result)
    _ = build_diagnostics(sample_result)
    _ = format_warnings(sample_result)

    assert sample_result.cv_data.warnings == original_warnings
    assert sample_result.cv_data.identity.full_name == original_name
