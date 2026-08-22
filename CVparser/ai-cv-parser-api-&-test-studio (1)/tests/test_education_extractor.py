"""
Unit tests for EducationExtractor.
"""

from app.extractors.education_extractor import EducationExtractor


def test_une_formation():
    text = "2019 - 2021\nMaster en Informatique\nUniversité Hassan II, Casablanca"
    sections = {"EDUCATION": text}
    edu = EducationExtractor.extract(sections)
    assert len(edu) == 1
    assert edu[0].degree is not None
    assert "Master" in edu[0].degree
    assert edu[0].institution is not None
    assert "Hassan II" in edu[0].institution or "Université" in edu[0].institution
    assert edu[0].start_date == "2019"
    assert edu[0].end_date == "2021"


def test_plusieurs_formations():
    text = "Master Data Science — Université de Paris — 2020\n\n2017–2020 : Licence en Économie, Université Mohammed V"
    sections = {"EDUCATION": text}
    edu = EducationExtractor.extract(sections)
    assert len(edu) == 2


def test_deux_formations_distinctes_blocs():
    text = "2018–2020\nLicence Informatique\nUniversité A\n\n2020–2022\nMaster Data Science\nUniversité B"
    sections = {"EDUCATION": text}
    edu = EducationExtractor.extract(sections)
    assert len(edu) == 2
    assert "Licence" in edu[0].degree or "Licence" in edu[1].degree
    assert "Master" in edu[0].degree or "Master" in edu[1].degree


def test_plage_de_dates():
    text = "09/2019 - 06/2021 : Diplôme d'ingénieur en Informatique, EMI"
    sections = {"EDUCATION": text}
    edu = EducationExtractor.extract(sections)
    assert len(edu) == 1
    assert edu[0].start_date == "09/2019"
    assert edu[0].end_date == "06/2021"


def test_institution():
    text = "Baccalauréat Scientifique, Lycée Lyautey"
    sections = {"EDUCATION": text}
    edu = EducationExtractor.extract(sections)
    assert len(edu) == 1
    assert edu[0].degree is not None


def test_diplome_sans_institution():
    text = "2020: Bachelor en Design"
    sections = {"EDUCATION": text}
    edu = EducationExtractor.extract(sections)
    assert len(edu) == 1
    assert edu[0].degree is not None
    assert edu[0].start_date == "2020"


def test_institution_sans_date():
    text = "Master en Finance à l'Université Hassan II"
    sections = {"EDUCATION": text}
    edu = EducationExtractor.extract(sections)
    assert len(edu) == 1
    assert edu[0].institution is not None


def test_dates_preservees():
    text = "2018–2021 : Licence en Mathématiques"
    sections = {"EDUCATION": text}
    edu = EducationExtractor.extract(sections)
    assert edu[0].start_date == "2018"
    assert edu[0].end_date == "2021"


def test_aucune_formation():
    sections = {}
    edu = EducationExtractor.extract(sections)
    assert edu == []


def test_education_fields_do_not_include_institution():
    sections = {
        "EDUCATION": """
        2019 - 2021
        Master en Informatique
        Université Hassan II, Casablanca
        """
    }
    results = EducationExtractor.extract(sections)
    assert len(results) == 1
    edu = results[0]
    assert edu.degree == "Master"
    assert edu.field_of_study == "Informatique"
    assert edu.institution == "Université Hassan II"
    assert edu.location == "Casablanca"


def test_degree_does_not_duplicate_institution():
    sections = {
        "EDUCATION": """
        2017 - 2020
        Licence en Économie
        Université Mohammed V, Rabat
        """
    }
    edu = EducationExtractor.extract(sections)[0]
    assert "Université Mohammed V" not in (edu.degree or "")
    assert "Université Mohammed V" not in (edu.field_of_study or "")


def test_engineering_degree_and_field_are_separated():
    sections = {
        "EDUCATION": """
        2020 - 2023
        Diplôme d'ingénieur en Génie Informatique
        ENSA Marrakech
        """
    }
    edu = EducationExtractor.extract(sections)[0]
    assert edu.degree == "Diplôme d'ingénieur"
    assert edu.field_of_study == "Génie Informatique"
    assert edu.institution == "ENSA Marrakech"


def test_multiple_educations_remain_separate_and_clean():
    sections = {
        "EDUCATION": """
        2017 - 2020
        Licence en Informatique
        Université A, Rabat

        2020 - 2022
        Master en Data Science
        Université B, Casablanca
        """
    }
    results = EducationExtractor.extract(sections)
    assert len(results) == 2
    assert results[0].degree == "Licence"
    assert results[0].field_of_study == "Informatique"
    assert results[0].institution == "Université A"
    assert results[1].degree == "Master"
    assert results[1].field_of_study == "Data Science"
    assert results[1].institution == "Université B"


def test_compact_education_em_dash():
    sections = {
        "EDUCATION": "Master Data Science — Université de Paris — 2020"
    }
    edu = EducationExtractor.extract(sections)[0]

    assert edu.degree == "Master"
    assert edu.field_of_study == "Data Science"
    assert edu.institution == "Université de Paris"
    assert edu.start_date == "2020"
    assert edu.end_date == "2020"


def test_compact_education_with_colon_and_comma():
    sections = {
        "EDUCATION": "2017–2020 : Licence en Économie, Université Mohammed V"
    }
    edu = EducationExtractor.extract(sections)[0]

    assert edu.degree == "Licence"
    assert edu.field_of_study == "Économie"
    assert edu.institution == "Université Mohammed V"
    assert edu.start_date == "2017"
    assert edu.end_date == "2020"


def test_education_with_a_l_universite():
    sections = {
        "EDUCATION": "Master en Finance à l'Université Hassan II"
    }
    edu = EducationExtractor.extract(sections)[0]

    assert edu.degree == "Master"
    assert edu.field_of_study == "Finance"
    assert edu.institution == "Université Hassan II"


def test_compact_engineering_education():
    sections = {
        "EDUCATION": "Diplôme d'ingénieur en Génie Informatique | ENSA Marrakech | 2023"
    }
    edu = EducationExtractor.extract(sections)[0]

    assert edu.degree == "Diplôme d'ingénieur"
    assert edu.field_of_study == "Génie Informatique"
    assert edu.institution == "ENSA Marrakech"
    assert edu.start_date == "2023"
    assert edu.end_date == "2023"


def test_compact_english_education():
    sections = {
        "EDUCATION": "Bachelor of Science in Computer Science, University of London, 2021"
    }
    edu = EducationExtractor.extract(sections)[0]

    assert edu.degree == "Bachelor of Science"
    assert edu.field_of_study == "Computer Science"
    assert edu.institution == "University of London"
    assert edu.start_date == "2021"
    assert edu.end_date == "2021"


def test_degree_never_contains_institution_on_compact_line():
    sections = {
        "EDUCATION": "Master Data Science — Université de Paris — 2020"
    }
    edu = EducationExtractor.extract(sections)[0]

    assert "Université" not in (edu.degree or "")
    assert "Université" not in (edu.field_of_study or "")
def test_complete_institution_names_are_preserved_around_keywords():
    cases = (
        "Nova Engineering School",
        "Westbridge University",
        "Institut Supérieur des Technologies",
        "Université Hassan II",
    )
    for institution in cases:
        result = EducationExtractor.extract({"EDUCATION": f"Master en Informatique\n{institution}, Paris\n2020 - 2022"})[0]
        assert result.institution == institution


def test_compact_common_degree_records_are_segmented_independently():
    text = """National Diploma: Systems Auditing, 2018, Northbridge University, Paris
Matric: Standard 10, 2014, Cedar Valley School, Lyon
B.Com: Internal Auditing, Meridian University, 2019 - 2022"""
    results = EducationExtractor.extract({"EDUCATION": text})
    assert len(results) == 3
    assert [item.degree for item in results] == ["National Diploma", "Matric", "B.Com"]
    assert [item.institution for item in results] == ["Northbridge University", "Cedar Valley School", "Meridian University"]


def test_wrapped_and_partial_education_records_preserve_safe_fields():
    text = """Master of Science in Sustainable
Infrastructure
Fictional Coast Institute
2021 - 2023
Aurora Technical College
2019
Professional Diploma in Service
Operations
2024"""
    results = EducationExtractor.extract({"EDUCATION": text})
    assert len(results) == 3
    assert results[0].degree == "Master of Science"
    assert results[0].field_of_study == "Sustainable Infrastructure"
    assert results[0].institution == "Fictional Coast Institute"
    assert results[1].degree is None
    assert results[1].institution == "Aurora Technical College"
    assert results[2].degree == "Professional Diploma"
    assert results[2].institution is None
