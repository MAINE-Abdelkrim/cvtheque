"""
Unit tests for ExperienceExtractor.
"""

from app.extractors.experience_extractor import ExperienceExtractor


def test_une_experience():
    text = """2022 - 2024
Développeur Backend
ABC Tech, Casablanca
- Développement d'API REST
- PostgreSQL et Docker"""
    sections = {"EXPERIENCES": text}
    exps = ExperienceExtractor.extract(sections)
    assert len(exps) == 1
    assert exps[0].job_title is not None
    assert "Développeur" in exps[0].job_title
    assert exps[0].start_date == "2022"
    assert exps[0].end_date == "2024"
    assert exps[0].description is not None
    assert "API REST" in exps[0].description


def test_plusieurs_experiences():
    text = """Développeur Python chez Tech Corp | 2021–Présent

03/2020 - 08/2022 : Data Analyst — Finance Group — Rabat"""
    sections = {"EXPERIENCES": text}
    exps = ExperienceExtractor.extract(sections)
    assert len(exps) == 2


def test_deux_experiences_distinctes_blocs():
    text = """2020–2022
Développeur Backend
ABC Tech
- Développement API REST

2022–Présent
Senior Backend Developer
XYZ Corp
- Architecture microservices"""
    sections = {"EXPERIENCES": text}
    exps = ExperienceExtractor.extract(sections)
    assert len(exps) == 2
    titles = [e.job_title for e in exps]
    assert any("Développeur" in t or "Backend" in t for t in titles if t)


def test_technologies_ne_deviennent_pas_entreprise():
    text = """2021 - 2023
Développeur Fullstack
Python, FastAPI, Docker
- Développement web"""
    sections = {"EXPERIENCES": text}
    exps = ExperienceExtractor.extract(sections)
    assert len(exps) == 1
    assert exps[0].company != "Python, FastAPI, Docker"


def test_dates_avec_annees():
    text = "Développeur Backend 2020 - 2023 chez TechCorp"
    sections = {"EXPERIENCES": text}
    exps = ExperienceExtractor.extract(sections)
    assert len(exps) == 1
    assert exps[0].start_date == "2020"
    assert exps[0].end_date == "2023"


def test_dates_mois_annee():
    text = "03/2020 - 08/2022 : Data Scientist chez AI Lab"
    sections = {"EXPERIENCES": text}
    exps = ExperienceExtractor.extract(sections)
    assert len(exps) == 1
    assert exps[0].start_date == "03/2020"
    assert exps[0].end_date == "08/2022"


def test_present_ou_present():
    text = "January 2021 - Present : Software Engineer at Google"
    sections = {"EXPERIENCES": text}
    exps = ExperienceExtractor.extract(sections)
    assert len(exps) == 1
    assert exps[0].end_date == "Présent"


def test_poste():
    text = "Consultant Senior en Stratégie, 2021-2023"
    sections = {"EXPERIENCES": text}
    exps = ExperienceExtractor.extract(sections)
    assert len(exps) == 1
    assert exps[0].job_title is not None


def test_entreprise():
    text = "Stagiaire Data chez Société XYZ | 2023"
    sections = {"EXPERIENCES": text}
    exps = ExperienceExtractor.extract(sections)
    assert len(exps) == 1
    assert exps[0].company == "Société XYZ"


def test_lieu():
    text = "2021-2022 : Chef de projet, Paris"
    sections = {"EXPERIENCES": text}
    exps = ExperienceExtractor.extract(sections)
    assert len(exps) == 1
    assert exps[0].location == "Paris"


def test_description_avec_puces():
    text = """Ingénieur DevOps chez CloudCorp (2022-2024)
- CI/CD Jenkins et GitLab
- Infrastructure Kubernetes sur AWS"""
    sections = {"EXPERIENCES": text}
    exps = ExperienceExtractor.extract(sections)
    assert len(exps) == 1
    assert exps[0].description is not None
    assert "Jenkins" in exps[0].description


def test_experience_partielle():
    text = "Stagiaire Développeur en 2023"
    sections = {"EXPERIENCES": text}
    exps = ExperienceExtractor.extract(sections)
    assert len(exps) == 1
    assert exps[0].start_date == "2023"


def test_aucune_experience():
    sections = {}
    exps = ExperienceExtractor.extract(sections)
    assert exps == []
def test_structural_job_titles_do_not_require_catalog_membership():
    for title in ("UX Designer", "Product Designer", "Cloud Engineer", "Data Governance Specialist"):
        results = ExperienceExtractor.extract({"EXPERIENCES": f"{title} | Fictional Labs, Paris\n2022 - 2024\n- Delivered professional work."})
        assert len(results) == 1
        assert results[0].job_title == title
        assert results[0].company == "Fictional Labs"


def test_structural_job_title_dash_company():
    result = ExperienceExtractor.extract({"EXPERIENCES": "Product Designer - Fictional Studio\n2022 - 2024"})[0]
    assert result.job_title == "Product Designer"
    assert result.company == "Fictional Studio"


def test_experience_date_precision_is_preserved():
    cases = [
        ("2025-02 - 2025-07", "2025-02", "2025-07"),
        ("Jan 2024 - Present", "Jan 2024", "Présent"),
        ("January 2024 - Present", "January 2024", "Présent"),
        ("Janv 2025 - Présent", "Janv 2025", "Présent"),
        ("Févr 2025 - Présent", "Févr 2025", "Présent"),
        ("02/2025 - Present", "02/2025", "Présent"),
        ("2024 - Present", "2024", "Présent"),
    ]
    for source, start, end in cases:
        result = ExperienceExtractor.extract({"EXPERIENCES": f"Cloud Specialist | Fictional Labs\n{source}"})[0]
        assert result.start_date == start
        assert result.end_date == end


def test_structural_title_before_single_date_and_curly_present_is_preserved():
    result = ExperienceExtractor.extract({
        "EXPERIENCES": "Operations Coordinator :\nFevrier 2026 - Aujourd’hui\nGestion administrative du service."
    })[0]
    assert result.job_title == "Operations Coordinator"
    assert result.start_date == "Fevrier 2026"
    assert result.end_date == "Présent"


def test_mixed_record_orders_and_long_wrapped_descriptions_stay_grouped():
    text = """Platform Coordinator
Fictional Harbor Labs
January 2021 to December 2021
Coordinated a long operational programme across several teams and documented every release milestone.
The programme included invoice review and asset management without creating another employment record.
Northwind Fabrication, Paris January 2022 to March 2023
Operations Specialist
Managed supplier planning and prepared monthly performance reports for leadership.
April 2023 to Present
Data Governance Specialist | Blue Orchard Group
Defined data controls and maintained the enterprise governance catalogue."""
    results = ExperienceExtractor.extract({"EXPERIENCES": text})
    assert len(results) == 3
    assert [item.job_title for item in results] == ["Platform Coordinator", "Operations Specialist", "Data Governance Specialist"]
    assert [item.company for item in results] == ["Fictional Harbor Labs", "Northwind Fabrication", "Blue Orchard Group"]
    assert "invoice review" in (results[0].description or "")


def test_missing_experience_fields_remain_null_instead_of_using_prose():
    missing_company = ExperienceExtractor.extract({
        "EXPERIENCES": "Service Designer\n2022 - 2024\nDesigned accessible workflows for a fictional public service."
    })[0]
    missing_title = ExperienceExtractor.extract({
        "EXPERIENCES": "2020 - 2022\nFictional Meridian Cooperative\nDelivered reliable operational support across regional teams."
    })[0]
    assert missing_company.job_title == "Service Designer"
    assert missing_company.company is None
    assert missing_title.job_title is None
    assert missing_title.company == "Fictional Meridian Cooperative"


def test_company_like_line_without_title_or_date_is_not_a_record():
    results = ExperienceExtractor.extract({"EXPERIENCES": "Fictional Meridian Cooperative"})
    assert results == []


def test_company_first_freeform_record_uses_next_short_line_as_title():
    result = ExperienceExtractor.extract({
        "EXPERIENCES": "Fictional North Services, London January 2022 - Present\nService Coordinator\nCoordinated service requests and prepared weekly operational reports."
    })[0]
    assert result.company == "Fictional North Services"
    assert result.job_title == "Service Coordinator"
    assert result.start_date == "January 2022"
    assert result.end_date == "Présent"
