"""
Unit tests for scripts/eval_harness.py.
"""

from pathlib import Path
import pytest

from app.llm.base_client import MockLLMClient
from app.services.cv_processing_service import CVProcessingService
from scripts.eval_harness import CVEvaluator, compute_metrics, main, parse_args


def test_parse_args():
    args = parse_args(["--input", "test.txt", "--use-mock-llm"])
    assert args.input == "test.txt"
    assert args.use_mock_llm is True


def test_evaluator_safety_audit():
    service = CVProcessingService()
    evaluator = CVEvaluator(service)

    mock_client = MockLLMClient(response='{"skills": [{"name": "Docker"}]}')

    cv_text = b"Jean Dupont\nPhone: +33612345678\nSkills: Python\nProfessional experience and education"
    report = evaluator.evaluate_cv(cv_text, "test.txt", client=mock_client)

    assert report["passed_safety_audit"] is True
    assert len(report["safety_violations"]) == 0


def test_compute_metrics_empty_results():
    metrics = compute_metrics([], "mock", 0.1)
    assert metrics["total_cases"] == 0
    assert metrics["valid_json_rate"] == 0.0
    assert metrics["failure_count"] == 0


def test_compute_metrics_populated():
    results = [
        {
            "filename": "cv1.txt",
            "enriched_duration_s": 0.5,
            "valid_json": True,
            "schema_valid": True,
            "allowed_field_compliance": True,
            "deterministic_preserved": True,
            "skills_added": 2,
            "experiences_added": 0,
            "education_added": 0,
            "hallucinated_fields": 0,
            "warnings_count": 0,
            "passed_safety_audit": True,
        }
    ]
    metrics = compute_metrics(results, "mock", 0.5)
    assert metrics["total_cases"] == 1
    assert metrics["valid_json_rate"] == 1.0
    assert metrics["correct_missing_field_completions"] == 2
    assert metrics["failure_count"] == 0


def test_main_with_mock_llm():
    fixture_path = str(Path(__file__).resolve().parent / "fixtures" / "synthetic_cv.txt")
    code = main(["--input", fixture_path, "--use-mock-llm"])
    assert code == 0
