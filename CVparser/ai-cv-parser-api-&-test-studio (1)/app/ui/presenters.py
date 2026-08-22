"""
Presentation helpers for the Gradio CV parser demonstration interface.
"""

import json
import re
from typing import List, Dict, Any, Union
from app.models.extraction_models import CVProcessingResult
from app.utils.list_utils import unique_preserve_order


def serialize_cv_processing_result(result: CVProcessingResult) -> Dict[str, Any]:
    """Serialize CVProcessingResult using validated model serialization without mutating it."""
    if hasattr(result, "model_dump"):
        return result.model_dump()
    return result.dict()


def build_candidate_overview(result: CVProcessingResult) -> str:
    """Format a clean Markdown summary of the candidate's key information."""
    cv_data = result.cv_data
    identity = cv_data.identity

    full_name = identity.full_name or "N/A"
    job_title = identity.job_title or "N/A"
    email = identity.email or "N/A"
    phone = identity.phone or "N/A"
    location = identity.location or "N/A"
    summary = cv_data.summary or "N/A"

    skills = cv_data.skills
    experiences = cv_data.experiences
    education = cv_data.education
    languages = cv_data.languages

    return f"""### Candidate Overview

- **Full Name**: {full_name}
- **Professional Title**: {job_title}
- **Email**: {email}
- **Phone**: {phone}
- **Location**: {location}

#### Professional Summary
{summary}

#### Extraction Counts
- **Skills**: {len(skills)}
- **Experiences**: {len(experiences)}
- **Education**: {len(education)}
- **Languages**: {len(languages)}
"""


def build_diagnostics(result: CVProcessingResult) -> Dict[str, Any]:
    """Compile diagnostic logs, processing metrics, and extraction methods."""
    pipeline = result.pipeline_result
    steps = []
    
    for step in pipeline.pipeline_steps:
        # Convert status enum to string if necessary
        status_val = step.status.value if hasattr(step.status, "value") else str(step.status)
        steps.append({
            "name": step.name,
            "status": status_val,
            "duration_ms": step.duration_ms,
            "message": step.message
        })

    ocr_used_on_any_page = any(getattr(page, "ocr_used", False) for page in pipeline.pages)
    ext_method = pipeline.extraction_method.value if hasattr(pipeline.extraction_method, "value") else str(pipeline.extraction_method)

    return {
        "extraction_method": ext_method,
        "page_count": pipeline.total_pages,
        "raw_text": pipeline.raw_text,
        "cleaned_text": pipeline.cleaned_text,
        "sections": dict(pipeline.sections),
        "detected_sections": list(pipeline.detected_sections),
        "pages": [page.model_dump(mode="json") for page in pipeline.pages],
        "pipeline_steps": steps,
        "processing_time_seconds": pipeline.processing_time_seconds,
        "processing_time": pipeline.processing_time_seconds,
        "ocr_used": ocr_used_on_any_page,
        "llm_used": result.llm_used,
        "llm_available": result.llm_available,
        "pipeline_warnings": list(pipeline.warnings),
    }


def format_warnings(result: CVProcessingResult) -> List[str]:
    """Format and deduplicate warnings from both pipeline and CV extraction phases, preserving order."""
    # Both pipeline and extraction warnings are merged into cv_data.warnings by the service
    return unique_preserve_order(result.cv_data.warnings)


def _normalized_value(value: Any) -> Any:
    """Normalize values for deterministic exact comparison without changing display values."""
    if isinstance(value, str):
        return re.sub(r"\s+", " ", value.strip()).casefold()
    if isinstance(value, dict):
        return {key: _normalized_value(item) for key, item in sorted(value.items())}
    if isinstance(value, list):
        return [_normalized_value(item) for item in value]
    return value


def _list_key(value: Any) -> str:
    return json.dumps(_normalized_value(value), ensure_ascii=False, sort_keys=True)


def compare_cv_data(extracted: Dict[str, Any], expected: Dict[str, Any]) -> Dict[str, Any]:
    """Compare structured CV data using normalized exact matching and original display values."""
    exact_matches: List[Dict[str, Any]] = []
    missing_expected: List[Dict[str, Any]] = []
    unexpected_extracted: List[Dict[str, Any]] = []
    different_values: List[Dict[str, Any]] = []
    field_summary: Dict[str, str] = {}

    def walk(actual: Any, wanted: Any, path: str) -> None:
        if isinstance(wanted, dict) and isinstance(actual, dict):
            for key in sorted(set(actual) | set(wanted)):
                field = f"{path}.{key}" if path else key
                if key not in actual:
                    missing_expected.append({"field": field, "expected": wanted[key]})
                    field_summary[field] = "missing"
                elif key not in wanted:
                    unexpected_extracted.append({"field": field, "extracted": actual[key]})
                    field_summary[field] = "unexpected"
                else:
                    walk(actual[key], wanted[key], field)
            return

        if isinstance(wanted, list) and isinstance(actual, list):
            actual_by_key = {_list_key(item): item for item in actual}
            expected_by_key = {_list_key(item): item for item in wanted}
            for key in sorted(set(expected_by_key) - set(actual_by_key)):
                missing_expected.append({"field": path, "expected": expected_by_key[key]})
            for key in sorted(set(actual_by_key) - set(expected_by_key)):
                unexpected_extracted.append({"field": path, "extracted": actual_by_key[key]})
            if set(actual_by_key) == set(expected_by_key):
                exact_matches.append({"field": path, "value": wanted})
                field_summary[path] = "exact"
            elif set(expected_by_key) - set(actual_by_key) and set(actual_by_key) - set(expected_by_key):
                field_summary[path] = "different"
            elif set(expected_by_key) - set(actual_by_key):
                field_summary[path] = "missing"
            else:
                field_summary[path] = "unexpected"
            return

        if _normalized_value(actual) == _normalized_value(wanted):
            exact_matches.append({"field": path, "value": wanted})
            field_summary[path] = "exact"
        elif actual in (None, "", []):
            missing_expected.append({"field": path, "expected": wanted})
            field_summary[path] = "missing"
        elif wanted in (None, "", []):
            unexpected_extracted.append({"field": path, "extracted": actual})
            field_summary[path] = "unexpected"
        else:
            different_values.append({"field": path, "expected": wanted, "extracted": actual})
            field_summary[path] = "different"

    walk(extracted or {}, expected or {}, "")
    return {
        "status": "compared",
        "summary": {
            "exact_matches": len(exact_matches),
            "missing_expected_values": len(missing_expected),
            "unexpected_extracted_values": len(unexpected_extracted),
            "different_scalar_values": len(different_values),
        },
        "exact_matches": exact_matches,
        "missing_expected_values": missing_expected,
        "unexpected_extracted_values": unexpected_extracted,
        "different_scalar_values": different_values,
        "per_field_summary": field_summary,
    }
