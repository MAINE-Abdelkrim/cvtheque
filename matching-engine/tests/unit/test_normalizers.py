from datetime import date

import pytest

from app.normalizers.contract_normalizer import normalize_contract
from app.normalizers.education_normalizer import EducationNormalizer
from app.normalizers.experience_normalizer import calculate_experience_years
from app.normalizers.language_normalizer import LanguageNormalizer
from app.normalizers.skill_normalizer import SkillNormalizer
from app.normalizers.text_normalizer import normalize_text
from app.schemas.cv_schema import ExperienceEntry


@pytest.mark.parametrize(("raw", "expected"), [
    ("  PYTHON  ", "python"), ("REST/API", "rest api"), ("diplôme d’ingénieur", "diplome d ingenieur"),
])
def test_text_normalization(raw: str, expected: str) -> None:
    assert normalize_text(raw) == expected


@pytest.mark.parametrize(("raw", "canonical", "alias"), [
    (" Postgres ", "postgresql", True), ("PostgreSQL", "postgresql", False),
    ("JS", "javascript", True), ("Amazon Web Services", "aws", True),
])
def test_skill_aliases(raw: str, canonical: str, alias: bool) -> None:
    result = SkillNormalizer().normalize(raw)
    assert (result.canonical, result.used_alias) == (canonical, alias)


@pytest.mark.parametrize(("left", "right"), [("Java", "JavaScript"), ("C", "C++"), ("SQL", "NoSQL"), ("React", "React Native")])
def test_skill_false_positives_do_not_match(left: str, right: str) -> None:
    normalizer = SkillNormalizer()
    assert normalizer.normalize(left).canonical != normalizer.normalize(right).canonical


def test_education_equivalences() -> None:
    normalizer = EducationNormalizer()
    assert normalizer.level("Master") == normalizer.level("Bac+5") == normalizer.level("engineering degree") == 4


def test_language_names_and_cefr() -> None:
    normalizer = LanguageNormalizer()
    assert normalizer.name("Français") == "french"
    assert normalizer.name("Anglais") == "english"
    assert normalizer.level("B2") == normalizer.level("intermediate")


def test_overlapping_experience_is_not_double_counted() -> None:
    entries = [
        ExperienceEntry(start_date="2022-01", end_date="2022-12"),
        ExperienceEntry(start_date="2022-07", end_date="2023-06"),
    ]
    years, warnings = calculate_experience_years(entries, date(2025, 1, 1))
    assert years == 1.5
    assert warnings == []


def test_contract_aliases() -> None:
    assert normalize_contract("CDI") == "permanent"
    assert normalize_contract("stage") == "internship"
