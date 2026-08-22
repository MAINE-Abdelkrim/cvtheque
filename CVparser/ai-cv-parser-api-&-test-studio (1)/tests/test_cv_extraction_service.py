"""
Unit tests for CVExtractionService.
"""

from unittest.mock import patch
from app.services.cv_extraction_service import CVExtractionService
from app.models.cv_models import CVData


def test_cv_complet():
    cleaned_text = """
Jean Dupont
jean.dupont@email.com | +212 6 12 34 56 78
Casablanca, Maroc | LinkedIn: https://www.linkedin.com/in/jeandupont

Développeur Python expérimenté spécialisé en Backend et Cloud.

Compétences:
Python, FastAPI, Docker, PostgreSQL, AWS

Expériences:
2022 - 2024
Développeur Backend chez ABC Tech, Casablanca
- Développement d'API REST FastAPI
- PostgreSQL et Docker

Formations:
2019 - 2021
Master en Informatique
Université Hassan II, Casablanca

Langues:
Français : Courant
Anglais : C1

Certifications:
AWS Certified Cloud Practitioner — 2024
"""

    sections = {
        "HEADER": "Jean Dupont\njean.dupont@email.com | +212 6 12 34 56 78\nCasablanca, Maroc",
        "SUMMARY": "Développeur Python expérimenté spécialisé en Backend et Cloud.",
        "SKILLS": "Python, FastAPI, Docker, PostgreSQL, AWS",
        "EXPERIENCES": "2022 - 2024\nDéveloppeur Backend chez ABC Tech, Casablanca\n- Développement d'API REST FastAPI\n- PostgreSQL et Docker",
        "EDUCATION": "2019 - 2021\nMaster en Informatique\nUniversité Hassan II, Casablanca",
        "LANGUAGES": "Français : Courant\nAnglais : C1",
        "CERTIFICATIONS": "AWS Certified Cloud Practitioner — 2024",
    }

    cv_data = CVExtractionService.extract(cleaned_text, sections)

    assert isinstance(cv_data, CVData)
    assert cv_data.identity.full_name == "Jean Dupont"
    assert cv_data.identity.email == "jean.dupont@email.com"
    assert cv_data.identity.phone is not None
    assert cv_data.summary == "Développeur Python expérimenté spécialisé en Backend et Cloud."
    assert len(cv_data.skills) >= 4
    assert len(cv_data.experiences) == 1
    assert len(cv_data.education) == 1
    assert len(cv_data.languages) == 2
    assert len(cv_data.certifications) == 1


def test_cv_partiel():
    cleaned_text = "Karim Benali\nkarim@example.com\nPython, Docker"
    sections = {
        "HEADER": "Karim Benali\nkarim@example.com",
        "SKILLS": "Python, Docker",
    }
    cv_data = CVExtractionService.extract(cleaned_text, sections)

    assert cv_data.identity.full_name == "Karim Benali"
    assert cv_data.identity.email == "karim@example.com"
    assert len(cv_data.skills) == 2
    assert cv_data.experiences == []
    assert "section expérience absente" in cv_data.warnings


def test_cv_vide():
    cv_data = CVExtractionService.extract("", {})
    assert isinstance(cv_data, CVData)
    assert cv_data.identity.full_name is None
    assert cv_data.skills == []
    assert len(cv_data.warnings) > 0


def test_extracteur_echoue_et_service_continue():
    sections = {"SKILLS": "Python"}
    sensitive = r"candidate@example.com in C:\Users\Private\resume.pdf"
    with patch("app.extractors.skills_extractor.SkillsExtractor.extract", side_effect=ValueError(sensitive)):
        cv_data = CVExtractionService.extract("Python", sections)
        assert isinstance(cv_data, CVData)
        assert "Deterministic skills extraction failed" in cv_data.warnings
        serialized = cv_data.model_dump_json()
        assert "candidate@example.com" not in serialized
        assert "Users\\Private" not in serialized


def test_warnings_sans_doublons():
    cv_data = CVExtractionService.extract("", {})
    assert len(cv_data.warnings) == len(set(cv_data.warnings))


def test_resultat_conforme_cvdata_et_aucune_hallucination():
    cleaned_text = "Alice Martin\nalice@example.com\nCompétences: Python"
    sections = {"HEADER": "Alice Martin\nalice@example.com", "SKILLS": "Python"}
    cv_data = CVExtractionService.extract(cleaned_text, sections)

    # Check no hallucinated fields
    assert cv_data.identity.linkedin is None
    assert cv_data.identity.github is None
    assert cv_data.certifications == []
    assert cv_data.languages == []


class DummyPipelineResult:
    def __init__(self, cleaned_text, sections):
        self.cleaned_text = cleaned_text
        self.sections = sections


def test_extraction_depuis_pipeline_result():
    dummy = DummyPipelineResult(
        cleaned_text="Youssef\nyoussef@example.com\nPython",
        sections={"SKILLS": "Python"}
    )
    cv_data = CVExtractionService.extract_from_pipeline_result(dummy)
    assert cv_data.identity.full_name == "Youssef"
    assert len(cv_data.skills) == 1
    assert cv_data.skills[0].name == "Python"


def test_cv_minimal():
    cv_data = CVExtractionService.extract("John Doe\njohn@example.com", {})
    assert cv_data.identity.full_name == "John Doe"
    assert cv_data.identity.email == "john@example.com"


def test_champ_inconnu_ne_casse_pas_extraction():
    sections = {"UNKNOWN_SECTION": "Random content"}
    cv_data = CVExtractionService.extract("John Doe\njohn@example.com", sections)
    assert cv_data.identity.full_name == "John Doe"
