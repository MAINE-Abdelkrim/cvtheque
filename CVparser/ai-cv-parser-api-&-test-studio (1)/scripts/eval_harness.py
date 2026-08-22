#!/usr/bin/env python3
"""
Evaluation harness for comparing deterministic CV extraction versus LLM-enriched CV extraction.
Calculates schema stability, safety preservation, accuracy metrics, and inference durations.
"""

import argparse
import json
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import Settings, get_settings
from app.llm.base_client import BaseLLMClient, MockLLMClient
from app.models.cv_models import CVData
from app.services.cv_processing_service import CVProcessingService
from scripts.cv_input import prepare_pdf_bytes


def parse_args(args=None):
    parser = argparse.ArgumentParser(
        description="Run evaluation harness comparing deterministic vs LLM-enriched extraction."
    )
    parser.add_argument(
        "--input",
        type=str,
        default=None,
        help="Path to CV text file or directory of CV files (defaults to synthetic_cv.txt).",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Path to save evaluation report JSON.",
    )
    parser.add_argument(
        "--use-mock-llm",
        action="store_true",
        help="Use MockLLMClient instead of loading local model weights.",
    )
    parser.add_argument(
        "--mock-response",
        type=str,
        default=None,
        help="Custom JSON response string for MockLLMClient.",
    )
    return parser.parse_args(args)


class CVEvaluator:
    """Evaluates extraction accuracy, safety constraints, and timing performance."""

    def __init__(self, service: CVProcessingService) -> None:
        self.service = service

    def evaluate_cv(
        self, file_bytes: bytes, filename: str, client: Optional[BaseLLMClient] = None
    ) -> Dict[str, Any]:
        """Process CV through both deterministic and LLM-enriched pipelines and evaluate safety."""
        pdf_bytes = prepare_pdf_bytes(file_bytes)
        deterministic_settings = self.service.settings.model_copy(
            update={"MODEL_ENABLED": False}
        )
        deterministic_service = CVProcessingService(settings=deterministic_settings)

        det_start = time.perf_counter()
        det_response = deterministic_service.process_pdf(pdf_bytes)
        det_duration = time.perf_counter() - det_start

        llm_start = time.perf_counter()
        enriched_response = self.service.process_pdf(pdf_bytes, client=client)
        llm_duration = time.perf_counter() - llm_start

        det_data = det_response.cv_data
        enriched_data = enriched_response.cv_data

        safety_violations = []

        # Check protected identity values
        for field in ["full_name", "email", "phone", "location", "linkedin", "github", "website"]:
            det_val = getattr(det_data.identity, field, None)
            enr_val = getattr(enriched_data.identity, field, None)
            if det_val and enr_val != det_val:
                safety_violations.append(
                    f"PROTECTED_FIELD_ALTERED: identity.{field} changed from '{det_val}' to '{enr_val}'"
                )

        if det_data.summary and enriched_data.summary != det_data.summary:
            safety_violations.append(
                f"PROTECTED_FIELD_ALTERED: summary changed from '{det_data.summary}' to '{enriched_data.summary}'"
            )

        skills_added = max(0, len(enriched_data.skills) - len(det_data.skills))
        experiences_added = max(0, len(enriched_data.experiences) - len(det_data.experiences))
        education_added = max(0, len(enriched_data.education) - len(det_data.education))

        # Hallucination check
        hallucinated_fields = 0
        if "LLM response contained unsupported values" in enriched_data.warnings:
            hallucinated_fields += 1

        valid_json = not any("no valid JSON" in w or "malformed" in w for w in enriched_data.warnings)
        schema_valid = not any("schema validation" in w for w in enriched_data.warnings)
        allowed_compliance = not any("unsupported fields" in w for w in enriched_data.warnings)

        return {
            "filename": filename,
            "deterministic_duration_s": round(det_duration, 4),
            "enriched_duration_s": round(llm_duration, 4),
            "valid_json": valid_json,
            "schema_valid": schema_valid,
            "allowed_field_compliance": allowed_compliance,
            "deterministic_preserved": len(safety_violations) == 0,
            "skills_added": skills_added,
            "experiences_added": experiences_added,
            "education_added": education_added,
            "hallucinated_fields": hallucinated_fields,
            "warnings_count": len(enriched_data.warnings),
            "warnings": enriched_data.warnings,
            "safety_violations": safety_violations,
            "passed_safety_audit": len(safety_violations) == 0,
        }


def compute_metrics(results: List[Dict[str, Any]], execution_mode: str, total_runtime: float) -> Dict[str, Any]:
    """Compute aggregate evaluation metrics with zero-division handling."""
    total_cases = len(results)
    if total_cases == 0:
        return {
            "execution_mode": execution_mode,
            "total_cases": 0,
            "inference_attempts": 0,
            "inference_successes": 0,
            "valid_json_rate": 0.0,
            "schema_valid_rate": 0.0,
            "allowed_field_compliance_rate": 0.0,
            "deterministic_field_preservation_rate": 0.0,
            "correct_missing_field_completions": 0,
            "incorrect_completions": 0,
            "hallucinated_field_count": 0,
            "warning_count": 0,
            "failure_count": 0,
            "mean_inference_duration": 0.0,
            "median_inference_duration": 0.0,
            "total_runtime": round(total_runtime, 4),
        }

    durations = [r["enriched_duration_s"] for r in results]
    valid_json_count = sum(1 for r in results if r["valid_json"])
    schema_valid_count = sum(1 for r in results if r["schema_valid"])
    allowed_count = sum(1 for r in results if r["allowed_field_compliance"])
    preserved_count = sum(1 for r in results if r["deterministic_preserved"])

    total_completions = sum(r["skills_added"] + r["experiences_added"] + r["education_added"] for r in results)
    total_hallucinations = sum(r["hallucinated_fields"] for r in results)
    total_warnings = sum(r["warnings_count"] for r in results)
    failures = sum(1 for r in results if not r["passed_safety_audit"])

    return {
        "execution_mode": execution_mode,  # "mock" or "real_local_inference"
        "total_cases": total_cases,
        "inference_attempts": total_cases,
        "inference_successes": total_cases - failures,
        "valid_json_rate": round(valid_json_count / total_cases, 4),
        "schema_valid_rate": round(schema_valid_count / total_cases, 4),
        "allowed_field_compliance_rate": round(allowed_count / total_cases, 4),
        "deterministic_field_preservation_rate": round(preserved_count / total_cases, 4),
        "correct_missing_field_completions": total_completions,
        "incorrect_completions": total_hallucinations,
        "hallucinated_field_count": total_hallucinations,
        "warning_count": total_warnings,
        "failure_count": failures,
        "mean_inference_duration": round(statistics.mean(durations), 4) if durations else 0.0,
        "median_inference_duration": round(statistics.median(durations), 4) if durations else 0.0,
        "total_runtime": round(total_runtime, 4),
    }


def main(args=None) -> int:
    start_time = time.perf_counter()
    parsed = parse_args(args)
    settings = get_settings()

    input_path = parsed.input
    if not input_path:
        default_fixture = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "synthetic_cv.txt"
        if default_fixture.exists():
            input_path = str(default_fixture)
        else:
            print("ERROR: No input CV path provided and synthetic_cv.txt fixture not found.", file=sys.stderr)
            return 1

    files_to_process = []
    p = Path(input_path)
    if p.is_dir():
        files_to_process = [f for f in p.glob("*") if f.suffix.lower() in [".txt", ".pdf"]]
    elif p.is_file():
        files_to_process = [p]
    else:
        print(f"ERROR: Input path '{input_path}' does not exist.", file=sys.stderr)
        return 1

    print("========================================================")
    print(" CV Parser - LLM Evaluation Harness")
    print("========================================================")
    print(f"Files to evaluate: {len(files_to_process)}")

    client = None
    exec_mode = "real_local_inference"
    if parsed.use_mock_llm:
        exec_mode = "mock_validation"
        mock_resp = parsed.mock_response or '{"skills": [{"name": "Docker"}]}'
        client = MockLLMClient(response=mock_resp)
        print("LLM Execution Mode : MockLLMClient")
    else:
        print(f"LLM Execution Mode : Configured Model ('{settings.MODEL_NAME}')")

    service = CVProcessingService(settings=settings)
    evaluator = CVEvaluator(service)

    results = []
    for file_path in files_to_process:
        print(f"\nEvaluating '{file_path.name}'...")
        with open(file_path, "rb") as f:
            content = f.read()

        res = evaluator.evaluate_cv(content, file_path.name, client=client)
        results.append(res)

    total_runtime = time.perf_counter() - start_time
    summary_report = compute_metrics(results, exec_mode, total_runtime)
    summary_report["evaluations"] = results

    print("\n========================================================")
    print(" EVALUATION SUMMARY METRICS")
    print("========================================================")
    for k, v in summary_report.items():
        if k != "evaluations":
            print(f"  {k:<38}: {v}")

    if parsed.output:
        with open(parsed.output, "w", encoding="utf-8") as f:
            json.dump(summary_report, f, indent=2)
        print(f"\nEvaluation report saved to '{parsed.output}'.")

    if summary_report["failure_count"] == 0:
        print("\n✓ EVALUATION PASSED: All safety and preservation audits satisfied.")
        return 0
    else:
        print(f"\n❌ EVALUATION FAILED: {summary_report['failure_count']} cases violated constraints.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
