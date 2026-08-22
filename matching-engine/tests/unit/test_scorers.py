import pytest

from app.config import DEFAULT_CONFIG
from app.normalizers.education_normalizer import EducationNormalizer
from app.normalizers.language_normalizer import LanguageNormalizer
from app.normalizers.skill_normalizer import SkillNormalizer
from app.schemas.cv_schema import CVProfile, EducationEntry, LanguageEntry
from app.schemas.job_schema import EducationRequirement, LanguageRequirement, SkillRequirement
from app.scorers.contract_scorer import score_contract
from app.scorers.education_scorer import score_education
from app.scorers.experience_scorer import score_experience
from app.scorers.languages_scorer import score_languages
from app.scorers.location_scorer import score_location
from app.scorers.skills_scorer import score_skills


@pytest.mark.parametrize(("candidate", "required", "score"), [
    (["Python", "SQL"], ["Python", "SQL"], 100), (["Python"], ["Python", "SQL"], 50), ([], ["Python"], 0),
])
def test_required_skill_scores(candidate: list[str], required: list[str], score: float) -> None:
    outcome = score_skills(candidate, [SkillRequirement(name=x) for x in required], SkillNormalizer(), DEFAULT_CONFIG)
    assert outcome.score == score


def test_alias_and_mandatory_skill() -> None:
    matched = score_skills(["Postgres"], [SkillRequirement(name="PostgreSQL")], SkillNormalizer(), DEFAULT_CONFIG)
    failed = score_skills([], [SkillRequirement(name="Python", mandatory=True)], SkillNormalizer(), DEFAULT_CONFIG)
    assert matched.score == 100
    assert failed.failures[0].code == "MANDATORY_SKILL_MISSING"


@pytest.mark.parametrize(("years", "required", "score"), [(3, 3, 100), (5, 3, 100), (2, 3, 200 / 3), (None, 3, 0), (None, 0, 100)])
def test_experience_scores(years: float | None, required: float, score: float) -> None:
    assert score_experience(CVProfile(total_experience_years=years), required).score == pytest.approx(score)


def test_experience_calculated_from_entries() -> None:
    cv = CVProfile(experiences=[{"start_date": "2022-01", "end_date": "2022-12"}])
    assert score_experience(cv, 1).score == 100


def test_education_levels_and_mandatory_failure() -> None:
    normalizer = EducationNormalizer()
    full = score_education([EducationEntry(degree="PhD")], EducationRequirement(minimum_level="Master"), normalizer, DEFAULT_CONFIG)
    fail = score_education([EducationEntry(degree="Bachelor")], EducationRequirement(minimum_level="Master", mandatory=True), normalizer, DEFAULT_CONFIG)
    assert full.score == 100
    assert fail.score == 60
    assert fail.failures
    assert not score_education([], None, normalizer, DEFAULT_CONFIG).active


def test_language_alias_level_and_failure() -> None:
    normalizer = LanguageNormalizer()
    full = score_languages([LanguageEntry(name="Français", level="C2")], [LanguageRequirement(name="French", minimum_level="fluent")], normalizer, DEFAULT_CONFIG)
    fail = score_languages([], [LanguageRequirement(name="English", minimum_level="B2", mandatory=True)], normalizer, DEFAULT_CONFIG)
    assert full.score == 100
    assert fail.failures


def test_location_policies() -> None:
    assert score_location("Casablanca", "hybrid", "Casablanca", "hybrid", False, DEFAULT_CONFIG).score == 100
    assert score_location("Rabat", "remote", "Casablanca", "onsite", True, DEFAULT_CONFIG).score == 100
    assert score_location(None, None, "Casablanca", "hybrid", False, DEFAULT_CONFIG).score == 50


def test_contract_policies() -> None:
    assert score_contract(["CDI"], "permanent", DEFAULT_CONFIG).score == 100
    assert score_contract(["stage"], "internship", DEFAULT_CONFIG).score == 100
    assert score_contract([], "CDI", DEFAULT_CONFIG).score == 50
