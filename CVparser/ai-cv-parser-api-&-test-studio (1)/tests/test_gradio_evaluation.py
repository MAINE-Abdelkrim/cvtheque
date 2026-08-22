"""Focused tests for the local manual CV evaluation workflow."""

import json
from pathlib import Path

from app.ui.gradio_app import (
    build_evaluation_comparison,
    export_evaluation_record,
    load_expected_json,
)
from app.ui.presenters import compare_cv_data


def parsed_result() -> dict:
    return {
        "cv_data": {
            "identity": {"full_name": "Jane Doe", "email": "jane@example.com"},
            "summary": None,
            "skills": [{"name": "Python", "category": "Language", "source": None}],
            "languages": [],
            "certifications": [],
            "education": [],
            "experiences": [],
            "warnings": [],
        },
        "llm_used": False,
        "llm_available": False,
    }


def diagnostics() -> dict:
    return {
        "extraction_method": "native_pdf",
        "page_count": 1,
        "raw_text": "SECRET-CV-CONTENT-MARKER",
        "cleaned_text": "secret-cv-content-marker",
        "detected_sections": ["SKILLS"],
        "processing_time_seconds": 0.1,
        "ocr_used": False,
        "llm_used": False,
        "llm_available": False,
        "pipeline_warnings": [],
    }


def test_expected_json_accepts_empty_pasted_and_uploaded_input(tmp_path):
    assert load_expected_json() is None
    expected_file = tmp_path / "expected.json"
    expected_file.write_text('{"cv_data": {"summary": null}}', encoding="utf-8")
    assert load_expected_json(uploaded_file=str(expected_file)) == {"summary": None}


def test_invalid_expected_json_has_clear_sanitized_result():
    result = build_evaluation_comparison(parsed_result(), "{invalid")
    assert result == {
        "status": "invalid_expected_json",
        "message": "Expected JSON is invalid.",
    }


def test_empty_expected_json_does_not_compare_or_influence_extraction():
    original = parsed_result()
    result = build_evaluation_comparison(original)
    assert result["status"] == "no_expected_json"
    assert original == parsed_result()


def test_comparison_excludes_warnings():
    actual = parsed_result()
    actual["cv_data"]["warnings"] = ["OCR processing failed"]
    expected = {**parsed_result()["cv_data"], "warnings": ["Different warning"]}
    result = build_evaluation_comparison(actual, json.dumps(expected))
    assert not any("warnings" in field for field in result["per_field_summary"])


def test_scalar_match_mismatch_missing_and_unexpected_detection():
    actual = {
        "identity": {"full_name": "Jane Doe", "email": None, "phone": "+123"},
        "summary": "Backend engineer",
    }
    expected = {
        "identity": {"full_name": "  jane   doe ", "email": "jane@example.com"},
        "summary": "Data engineer",
    }
    comparison = compare_cv_data(actual, expected)
    assert comparison["per_field_summary"]["identity.full_name"] == "exact"
    assert comparison["per_field_summary"]["identity.email"] == "missing"
    assert comparison["per_field_summary"]["identity.phone"] == "unexpected"
    assert comparison["per_field_summary"]["summary"] == "different"


def test_list_comparison_normalizes_case_and_repeated_whitespace():
    actual = {"skills": [{"name": "PYTHON API"}, {"name": "Go"}]}
    expected = {"skills": [{"name": " python   api "}, {"name": "go"}]}
    comparison = compare_cv_data(actual, expected)
    assert comparison["per_field_summary"]["skills"] == "exact"
    assert comparison["missing_expected_values"] == []
    assert comparison["unexpected_extracted_values"] == []


def test_list_item_differences_preserve_original_values():
    comparison = compare_cv_data(
        {"skills": [{"name": "Python"}, {"name": "Rust"}]},
        {"skills": [{"name": "Python"}, {"name": "Go"}]},
    )
    assert comparison["missing_expected_values"][0]["expected"] == {"name": "Go"}
    assert comparison["unexpected_extracted_values"][0]["extracted"] == {"name": "Rust"}


def test_explicit_export_contains_manual_record_without_pdf_bytes(tmp_path, monkeypatch):
    import app.ui.gradio_app as gradio_app

    monkeypatch.setattr(gradio_app, "JSON_DOWNLOAD_DIR", str(tmp_path))
    pdf_path = tmp_path / "candidate.pdf"
    pdf_path.write_bytes(b"PRIVATE-PDF-BYTES")
    expected = json.dumps({"cv_data": parsed_result()["cv_data"]})
    comparison = build_evaluation_comparison(parsed_result(), expected)

    export_path, status = export_evaluation_record(
        str(pdf_path),
        parsed_result(),
        diagnostics(),
        expected,
        None,
        comparison,
        "Mostly correct",
        "Missed company name",
    )
    record = json.loads(Path(export_path).read_text(encoding="utf-8"))

    assert "ready for download" in status
    assert record["source_filename"] == "candidate.pdf"
    assert record["manual_quality_label"] == "Mostly correct"
    assert record["evaluator_notes"] == "Missed company name"
    assert record["comparison"]["status"] == "compared"
    assert record["expected_cv_data"] == parsed_result()["cv_data"]
    serialized = json.dumps(record)
    assert "PRIVATE-PDF-BYTES" not in serialized
    assert "SECRET-CV-CONTENT-MARKER" not in serialized
    assert "raw_text" not in record["selected_diagnostics"]
    assert "cleaned_text" not in record["selected_diagnostics"]


def test_no_automatic_export_file_is_created_by_comparison(tmp_path, monkeypatch):
    import app.ui.gradio_app as gradio_app

    monkeypatch.setattr(gradio_app, "JSON_DOWNLOAD_DIR", str(tmp_path))
    build_evaluation_comparison(parsed_result(), json.dumps(parsed_result()["cv_data"]))
    assert list(tmp_path.iterdir()) == []
