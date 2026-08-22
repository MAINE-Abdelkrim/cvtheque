"""Staged regression checks for deterministic, fictional CV fixtures."""

from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

import fitz
import pytest

from app.core.config import Settings
from app.services.cv_processing_service import CVProcessingService


FIXTURE_DIR = Path(__file__).parent / "fixtures" / "synthetic_cvs"
PDF_CASES = sorted(FIXTURE_DIR.glob("cv_*.pdf"))

KNOWN_BASELINE_FAILURES = {}

EXPECTED_SECTIONS = {
    "cv_01_single_column": {"SUMMARY", "SKILLS", "EXPERIENCES", "EDUCATION", "LANGUAGES", "CERTIFICATIONS"},
    "cv_02_two_columns": {"SUMMARY", "SKILLS", "EXPERIENCES", "EDUCATION", "LANGUAGES", "CERTIFICATIONS"},
    "cv_03_sidebar": {"SUMMARY", "SKILLS", "EXPERIENCES", "EDUCATION", "LANGUAGES", "CERTIFICATIONS"},
    "cv_04_dense_experience": {"SUMMARY", "SKILLS", "EXPERIENCES", "EDUCATION", "LANGUAGES"},
    "cv_05_english": {"SUMMARY", "SKILLS", "EXPERIENCES", "EDUCATION", "LANGUAGES", "CERTIFICATIONS"},
    "cv_06_mixed_layout": {"SUMMARY", "SKILLS", "EXPERIENCES", "EDUCATION", "LANGUAGES", "CERTIFICATIONS"},
    "cv_07_independent_columns": {"SUMMARY", "SKILLS", "EXPERIENCES", "EDUCATION", "LANGUAGES", "CERTIFICATIONS"},
    "cv_08_detached_date_rail": {"SUMMARY", "SKILLS", "EXPERIENCES", "EDUCATION", "LANGUAGES", "CONTACT"},
    "cv_09_unknown_heading_boundary": {"SKILLS", "EDUCATION", "LANGUAGES"},
    "cv_10_education_training_alias": {"SUMMARY", "EDUCATION", "SKILLS", "LANGUAGES"},
    "cv_11_title_without_name": {"SUMMARY", "SKILLS", "EXPERIENCES", "EDUCATION", "LANGUAGES"},
    "cv_12_freeform_experience": {"SUMMARY", "EXPERIENCES", "EDUCATION", "SKILLS", "LANGUAGES"},
}

VISIBLE_HEADINGS = {
    "cv_01_single_column": ["PROFIL", "COMPÉTENCES", "EXPÉRIENCES PROFESSIONNELLES", "FORMATION", "LANGUES", "CERTIFICATIONS"],
    "cv_02_two_columns": ["COMPÉTENCES", "LANGUES", "FORMATION", "PROFIL", "EXPÉRIENCES PROFESSIONNELLES", "CERTIFICATIONS"],
    "cv_03_sidebar": ["CONTACT", "COMPÉTENCES", "LANGUES", "PROFIL", "EXPÉRIENCES PROFESSIONNELLES", "FORMATION", "CERTIFICATIONS"],
    "cv_04_dense_experience": ["PROFIL", "EXPÉRIENCES PROFESSIONNELLES", "COMPÉTENCES", "FORMATION", "LANGUES"],
    "cv_05_english": ["PROFILE", "SKILLS", "EXPERIENCE", "EDUCATION", "LANGUAGES", "CERTIFICATIONS"],
    "cv_06_mixed_layout": ["PROFIL", "COMPÉTENCES", "EXPÉRIENCES PROFESSIONNELLES", "FORMATION", "LANGUES", "CERTIFICATIONS"],
    "cv_07_independent_columns": ["CONTACT", "FORMATION", "COMPÉTENCES", "LANGUES", "PROFIL", "EXPÉRIENCES", "PROFESSIONNELLES", "CERTIFICATS"],
    "cv_08_detached_date_rail": ["CONTACT", "COMPÉTENCES", "LANGUES", "PROFIL", "EXPÉRIENCES PROFESSIONNELLES", "FORMATION"],
    "cv_09_unknown_heading_boundary": ["SKILLS", "ACHIEVEMENTS", "EDUCATION", "LANGUAGES"],
    "cv_10_education_training_alias": ["PROFILE", "EDUCATION AND PROFESSIONAL TRAINING", "SKILLS", "LANGUAGES"],
    "cv_11_title_without_name": ["PROFILE", "SKILLS", "EXPERIENCE", "EDUCATION", "LANGUAGES"],
    "cv_12_freeform_experience": ["PROFESSIONAL SUMMARY", "WORK EXPERIENCE", "EDUCATION", "SKILLS", "LANGUAGES"],
}


def normalize(value: str | None) -> str:
    if not value:
        return ""
    ascii_value = "".join(
        character for character in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(character)
    )
    return re.sub(r"\s+", " ", ascii_value).strip().casefold()


def expected_for(pdf_path: Path) -> dict:
    return json.loads(pdf_path.with_name(f"{pdf_path.stem}_expected.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=12)
def parsed_case(path_text: str):
    service = CVProcessingService(settings=Settings(MODEL_ENABLED=False, _env_file=None))
    return service.process_pdf(Path(path_text).read_bytes())


@pytest.mark.parametrize("pdf_path", PDF_CASES, ids=lambda path: path.stem)
def test_fixture_is_one_page_text_native_and_complete(pdf_path: Path):
    expected = expected_for(pdf_path)
    with fitz.open(pdf_path) as document:
        assert document.page_count == 1
        page = document[0]
        native_text = page.get_text("text")
        assert len(native_text.strip()) > 100
        assert not page.get_images(full=True), "Synthetic phase-one fixtures must not need OCR"
        for heading in VISIBLE_HEADINGS[pdf_path.stem]:
            assert heading in native_text
        for value in (
            expected["identity"]["full_name"],
            expected["identity"]["email"],
            expected["identity"]["phone"],
        ):
            if value is not None:
                assert value in native_text
        for block in page.get_text("blocks"):
            assert block[0] >= -0.5 and block[1] >= -0.5
            assert block[2] <= page.rect.width + 0.5 and block[3] <= page.rect.height + 0.5


def section_parameter(pdf_path: Path):
    reason = KNOWN_BASELINE_FAILURES.get(("sections", pdf_path.stem))
    marks = pytest.mark.xfail(strict=True, reason=reason) if reason else ()
    return pytest.param(pdf_path, id=pdf_path.stem, marks=marks)


@pytest.mark.parametrize("pdf_path", [section_parameter(path) for path in PDF_CASES])
def test_pipeline_reconstructs_text_and_detects_sections(pdf_path: Path):
    result = parsed_case(str(pdf_path)).pipeline_result
    assert result.extraction_method.value == "native_pdf"
    assert result.raw_text.strip()
    assert result.cleaned_text.strip()
    assert result.pages[0].native_text_length > 100
    assert result.pages[0].final_text.strip()
    missing = EXPECTED_SECTIONS[pdf_path.stem] - set(result.detected_sections)
    assert not missing, (
        f"sectioning failure; layout={result.pages[0].layout_type.value}; "
        f"detected={result.detected_sections}; missing={sorted(missing)}"
    )


def assert_identity(actual, expected: dict) -> None:
    for field in ("full_name", "email", "phone", "location", "job_title"):
        assert normalize(getattr(actual, field)) == normalize(expected[field]), (
            f"identity.{field}: expected={expected[field]!r}, actual={getattr(actual, field)!r}"
        )


def assert_skills(actual, expected: list[dict]) -> None:
    actual_names = {normalize(item.name) for item in actual}
    expected_names = {normalize(item["name"]) for item in expected}
    missing = expected_names - actual_names
    unexpected = actual_names - expected_names
    assert not missing, f"missing skills={sorted(missing)}; unexpected skills={sorted(unexpected)}"


def assert_languages(actual, expected: list[dict]) -> None:
    actual_map = {normalize(item.language): normalize(item.level) for item in actual}
    expected_map = {normalize(item["language"]): normalize(item["level"]) for item in expected}
    assert actual_map.keys() == expected_map.keys(), f"expected languages={expected_map}; actual={actual_map}"
    for language, level in expected_map.items():
        assert actual_map[language] == level, f"language level mismatch for {language}: {actual_map[language]} != {level}"


def assert_experiences(actual, expected: list[dict]) -> None:
    assert len(actual) == len(expected), f"experience count: expected={len(expected)}, actual={len(actual)}"
    for index, (actual_item, expected_item) in enumerate(zip(actual, expected)):
        for field in ("job_title", "company", "start_date", "end_date"):
            assert normalize(getattr(actual_item, field)) == normalize(expected_item[field]), (
                f"experiences[{index}].{field}: expected={expected_item[field]!r}, actual={getattr(actual_item, field)!r}"
            )
        if expected_item.get("description"):
            assert normalize(expected_item["description"]) in normalize(actual_item.description)


def assert_education(actual, expected: list[dict]) -> None:
    assert len(actual) == len(expected), f"education count: expected={len(expected)}, actual={len(actual)}"
    for index, (actual_item, expected_item) in enumerate(zip(actual, expected)):
        for field in ("degree", "field_of_study", "institution", "start_date", "end_date"):
            assert normalize(getattr(actual_item, field)) == normalize(expected_item[field]), (
                f"education[{index}].{field}: expected={expected_item[field]!r}, actual={getattr(actual_item, field)!r}"
            )


def assert_certifications(actual, expected: list[dict]) -> None:
    assert len(actual) == len(expected), f"certification count: expected={len(expected)}, actual={len(actual)}"
    for index, (actual_item, expected_item) in enumerate(zip(actual, expected)):
        for field in ("name", "issuer", "date"):
            assert normalize(getattr(actual_item, field)) == normalize(expected_item[field]), (
                f"certifications[{index}].{field}: expected={expected_item[field]!r}, actual={getattr(actual_item, field)!r}"
            )


def field_parameters():
    for category in ("identity", "summary", "skills", "experiences", "education", "languages", "certifications"):
        for pdf_path in PDF_CASES:
            reason = KNOWN_BASELINE_FAILURES.get((category, pdf_path.stem))
            marks = pytest.mark.xfail(strict=True, reason=reason) if reason else ()
            yield pytest.param(category, pdf_path, id=f"{pdf_path.stem}-{category}", marks=marks)


@pytest.mark.parametrize("category,pdf_path", list(field_parameters()))
def test_structured_extraction_matches_visible_ground_truth(category: str, pdf_path: Path):
    expected = expected_for(pdf_path)
    result = parsed_case(str(pdf_path))
    actual = result.cv_data
    assertions = {
        "identity": lambda: assert_identity(actual.identity, expected["identity"]),
        "skills": lambda: assert_skills(actual.skills, expected["skills"]),
        "experiences": lambda: assert_experiences(actual.experiences, expected["experiences"]),
        "education": lambda: assert_education(actual.education, expected["education"]),
        "languages": lambda: assert_languages(actual.languages, expected["languages"]),
        "certifications": lambda: assert_certifications(actual.certifications, expected["certifications"]),
    }
    if category == "summary":
        assert normalize(expected["summary"]) in normalize(actual.summary), (
            f"summary mismatch: expected={expected['summary']!r}, actual={actual.summary!r}"
        )
    else:
        assertions[category]()


def test_fixture_inventory_is_exactly_twelve_pairs():
    assert len(PDF_CASES) == 12
    expected_files = sorted(FIXTURE_DIR.glob("cv_*_expected.json"))
    assert len(expected_files) == 12
    assert {path.stem.removesuffix("_expected") for path in expected_files} == {path.stem for path in PDF_CASES}


def test_two_column_section_ownership_is_not_cross_contaminated():
    sections = parsed_case(str(FIXTURE_DIR / "cv_02_two_columns.pdf")).pipeline_result.sections
    assert "Développeur backend orienté" in sections["SUMMARY"]
    assert "Python" not in sections["SUMMARY"]
    assert "Docker Certified Associate" in sections["CERTIFICATIONS"]
    assert "Développeur backend orienté" not in sections["CERTIFICATIONS"]
    assert "Docker Certified Associate" not in sections["EXPERIENCES"]


def test_sidebar_section_bodies_survive_reconstruction():
    sections = parsed_case(str(FIXTURE_DIR / "cv_03_sidebar.pdf")).pipeline_result.sections
    assert "Figma" in sections["SKILLS"]
    assert "UX Designer | Studio Pixelia" in sections["EXPERIENCES"]
    assert "2021 - 2024" in sections["EXPERIENCES"]
    assert "imane.benali@example.com" in sections["CONTACT"]


def test_dense_three_group_region_preserves_each_section_body():
    sections = parsed_case(str(FIXTURE_DIR / "cv_04_dense_experience.pdf")).pipeline_result.sections
    assert "Java" in sections["SKILLS"]
    assert "Engineering Degree" in sections["EDUCATION"]
    assert "Arabic" in sections["LANGUAGES"]


def test_english_experience_section_owns_its_body():
    sections = parsed_case(str(FIXTURE_DIR / "cv_05_english.pdf")).pipeline_result.sections
    assert "Machine Learning Engineer | Synthetic Vision Labs" in sections["EXPERIENCES"]
    assert "Machine Learning Engineer | Synthetic Vision Labs" not in sections["SKILLS"]


def test_unknown_visual_heading_stops_skills_ownership():
    sections = parsed_case(str(FIXTURE_DIR / "cv_09_unknown_heading_boundary.pdf")).pipeline_result.sections
    assert "Python" in sections["SKILLS"]
    assert "fictional community platform" not in sections["SKILLS"]


def test_detached_date_rail_stays_in_experience_flow():
    sections = parsed_case(str(FIXTURE_DIR / "cv_08_detached_date_rail.pdf")).pipeline_result.sections
    assert "2023" in sections["EXPERIENCES"]
    assert "Présent" in sections["EXPERIENCES"]
    assert "2023" not in sections["SKILLS"]
