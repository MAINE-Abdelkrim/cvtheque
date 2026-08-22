"""Fictional field-level quality benchmark for deterministic and hybrid CV extraction."""

from pathlib import Path
import json
import sys
import time

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import Settings
from app.llm.client_factory import create_llm_client
from app.llm.cv_semantic_prompts import build_semantic_section_prompt
from app.models.cv_models import CVData
from app.services.cv_extraction_service import CVExtractionService
from app.services.semantic_extraction_service import SemanticExtractionService


CASES = [
    ("fr_experience", "EXPERIENCES", "STAGE D'INITIATION ATLAS SERVICES - OUJDA\nJuin 2024 - Juillet 2024\nObservation des activités et préparation de rapports.", "experiences", [{"job_title": "STAGE D'INITIATION", "company": "ATLAS SERVICES", "location": "OUJDA", "start_date": "Juin 2024", "end_date": "Juillet 2024", "description": "Observation des activités et préparation de rapports."}]),
    ("en_experience", "EXPERIENCES", "Data Analyst | Northstar Analytics | London, United Kingdom\nJan 2024 - Present\nBuilt reporting dashboards.", "experiences", [{"job_title": "Data Analyst", "company": "Northstar Analytics", "location": "London, United Kingdom", "start_date": "Jan 2024", "end_date": "Present", "description": "Built reporting dashboards."}]),
    ("company_first", "EXPERIENCES", "Fictional Harbor Group, Paris\nCloud Operations Specialist\n2022 - 2023\nMaintained deployment platforms.", "experiences", [{"job_title": "Cloud Operations Specialist", "company": "Fictional Harbor Group", "location": "Paris", "start_date": "2022", "end_date": "2023", "description": "Maintained deployment platforms."}]),
    ("education", "EDUCATION", "Master Data Science\nWestbridge University, Manchester\n2022 - 2024", "education", [{"degree": "Master", "field_of_study": "Data Science", "institution": "Westbridge University", "location": "Manchester", "start_date": "2022", "end_date": "2024"}]),
    ("skills", "SKILLS", "Python\nFastAPI\nDesign Systems\nPostgreSQL", "skills", [{"name": "Python"}, {"name": "FastAPI"}, {"name": "Design Systems"}, {"name": "PostgreSQL"}]),
    ("languages", "LANGUAGES", "French - Fluent\nEnglish\nArabic - Native", "languages", [{"language": "French", "level": "Fluent"}, {"language": "English", "level": None}, {"language": "Arabic", "level": "Native"}]),
    ("certification", "CERTIFICATIONS", "Cloud Architecture Certificate | Fictional Learning Institute | 2025", "certifications", [{"name": "Cloud Architecture Certificate", "issuer": "Fictional Learning Institute", "date": "2025", "credential_id": None}]),
    ("abbreviated_dates", "EXPERIENCES", "Product Designer | Blue Orchard Studio\nFeb 2023 - Sep 2024\nDesigned accessible interfaces.", "experiences", [{"job_title": "Product Designer", "company": "Blue Orchard Studio", "location": None, "start_date": "Feb 2023", "end_date": "Sep 2024", "description": "Designed accessible interfaces."}]),
    ("missing_company", "EXPERIENCES", "Service Coordinator\nMarch 2021 - June 2022\nCoordinated customer requests.", "experiences", [{"job_title": "Service Coordinator", "company": None, "location": None, "start_date": "March 2021", "end_date": "June 2022", "description": "Coordinated customer requests."}]),
    ("ambiguous_task", "EXPERIENCES", "Observation of daily operations and preparation of weekly reports.", "experiences", []),
]


def norm(value):
    if value is None:
        return None
    return " ".join(str(value).casefold().replace("’", "'").split())


def score(actual, expected):
    keys = sorted(set().union(*(item.keys() for item in expected))) if expected else []
    total = max(1, sum(len(item) for item in expected))
    correct = missing = incorrect = hallucinated = 0
    for index, expected_item in enumerate(expected):
        actual_item = actual[index] if index < len(actual) else {}
        for key, expected_value in expected_item.items():
            actual_value = actual_item.get(key)
            if norm(actual_value) == norm(expected_value): correct += 1
            elif actual_value is None: missing += 1
            else: incorrect += 1
    if len(actual) > len(expected):
        hallucinated += sum(sum(v is not None for v in item.values()) for item in actual[len(expected):])
    return {"correct": correct, "missing": missing, "incorrect": incorrect, "hallucinated": hallucinated, "total": total}


def main() -> int:
    settings = Settings(MODEL_ENABLED=True, MODEL_LOCAL_FILES_ONLY=True, MODEL_DEVICE="cpu", MODEL_MAX_NEW_TOKENS=128, _env_file=None)
    client = create_llm_client(settings)
    if client is None or not client.is_available(): return 2
    service = SemanticExtractionService(timeout_seconds=240)
    deterministic_service = CVExtractionService()
    client.load()
    # Explicit warm-up separates cold first-touch from quality timings.
    client.max_new_tokens = 64
    client.generate(build_semantic_section_prompt("SKILLS", "Python\nFastAPI\nPostgreSQL"))
    client.max_new_tokens = 128
    aggregate = {"deterministic": {k: 0 for k in ("correct", "missing", "incorrect", "hallucinated", "total")}, "hybrid": {k: 0 for k in ("correct", "missing", "incorrect", "hallucinated", "total")}}
    for name, section, text, field, expected in CASES:
        deterministic = deterministic_service.extract(text, {section: text})
        started = time.perf_counter()
        outcome = service.extract(deterministic, {section: text}, client)
        elapsed = time.perf_counter() - started
        det_actual = [item.model_dump() for item in getattr(deterministic, field)]
        hybrid_actual = [item.model_dump() for item in getattr(outcome.cv_data, field)]
        det_score, hybrid_score = score(det_actual, expected), score(hybrid_actual, expected)
        for mode, values in (("deterministic", det_score), ("hybrid", hybrid_score)):
            for key, value in values.items(): aggregate[mode][key] += value
        print(json.dumps({"case": name, "seconds": round(elapsed, 3), "deterministic": det_score, "hybrid": hybrid_score, "semantic_contributed": outcome.contributed, "fallback": any("fallback" in warning for warning in outcome.cv_data.warnings)}), flush=True)
    print("FINAL=" + json.dumps(aggregate), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
