"""
Unit tests for IdentityExtractor.
"""

from app.extractors.identity_extractor import IdentityExtractor


def test_email_simple():
    text = "Jean Dupont\nEmail: jean.dupont@email.com.\nTel: 0612345678"
    identity = IdentityExtractor.extract(text)
    assert identity.email == "jean.dupont@email.com"


def test_email_ponctuation_finale():
    for text in ["john.doe@email.com,", "john.doe@email.com.", "john.doe@email.com;"]:
        identity = IdentityExtractor.extract(text)
        assert identity.email == "john.doe@email.com"


def test_telephone_marocain_formats():
    formats = [
        "+212612345678",
        "+212 6 12 34 56 78",
        "06 12 34 56 78",
        "06.12.34.56.78",
        "06-12-34-56-78",
        "(06)12345678",
    ]
    for fmt in formats:
        identity = IdentityExtractor.extract(f"Contact: {fmt}")
        assert identity.phone is not None, f"Failed on format: {fmt}"


def test_linkedin_ponctuation_finale():
    text = "LinkedIn: https://www.linkedin.com/in/john-doe,"
    identity = IdentityExtractor.extract(text)
    assert identity.linkedin == "https://www.linkedin.com/in/john-doe"


def test_github_ponctuation_finale():
    text = "GitHub: https://github.com/johndoe."
    identity = IdentityExtractor.extract(text)
    assert identity.github == "https://github.com/johndoe"


def test_aucun_nom_fiable():
    text = "Senior Data Engineer\npython@email.com"
    identity = IdentityExtractor.extract(text)
    assert identity.full_name is None
    assert identity.email == "python@email.com"


def test_telephone_marocain():
    text = "Contact: +212 6 12 34 56 78"
    identity = IdentityExtractor.extract(text)
    assert identity.phone is not None
    assert "212" in identity.phone and "6" in identity.phone


def test_telephone_international():
    text = "Phone: +33 6 12 34 56 78"
    identity = IdentityExtractor.extract(text)
    assert identity.phone is not None
    assert "+33" in identity.phone


def test_linkedin():
    text = "LinkedIn: https://www.linkedin.com/in/jeandupont/"
    identity = IdentityExtractor.extract(text)
    assert identity.linkedin == "https://www.linkedin.com/in/jeandupont"


def test_github():
    text = "GitHub: github.com/jeandupont"
    identity = IdentityExtractor.extract(text)
    assert identity.github == "https://github.com/jeandupont"


def test_site_personnel():
    text = "Portfolio: https://jeandupont.dev"
    identity = IdentityExtractor.extract(text)
    assert identity.website == "https://jeandupont.dev"


def test_nom_dans_header():
    sections = {"HEADER": "Jean Dupont\nDéveloppeur Backend\njean@example.com"}
    identity = IdentityExtractor.extract("", sections)
    assert identity.full_name == "Jean Dupont"


def test_rejet_job_title_comme_nom():
    text = "Développeur Python\njean@example.com\n0612345678"
    identity = IdentityExtractor.extract(text)
    assert identity.full_name is None
    assert identity.job_title is not None


def test_identite_partielle():
    text = "Karim Benali\nkarim@example.com"
    identity = IdentityExtractor.extract(text)
    assert identity.full_name == "Karim Benali"
    assert identity.email == "karim@example.com"
    assert identity.phone is None


def test_absence_totale_identite():
    text = "Texte quelconque sans aucun contact ni nom évident."
    identity = IdentityExtractor.extract(text)
    assert identity.full_name is None
    assert identity.email is None
    assert identity.phone is None
    assert identity.linkedin is None


def test_summary_sentence_not_used_as_job_title():
    text = "Développeur Python expérimenté spécialisé en Backend et Cloud."
    identity = IdentityExtractor.extract(text)
    assert identity.job_title is None


def test_short_job_title_is_detected():
    text = "Jean Dupont\nDéveloppeur Backend\njean@example.com"
    identity = IdentityExtractor.extract(text)
    assert identity.job_title == "Développeur Backend"


def test_senior_data_engineer_is_valid_job_title():
    text = "Senior Data Engineer\npython@email.com"
    identity = IdentityExtractor.extract(text)
    assert identity.job_title == "Senior Data Engineer"


def test_descriptive_sentence_with_experience_is_rejected():
    text = "Ingénieur logiciel avec 5 années d'expérience en développement cloud."
    identity = IdentityExtractor.extract(text)
    assert identity.job_title is None


def test_section_headings_are_not_accepted_as_names():
    for heading in [
        "Formation Académique",
        "Expérience Professionnelle",
        "Compétences Techniques",
        "Certifications",
        "Langues",
        "Profil",
    ]:
        assert IdentityExtractor.extract(heading).full_name is None


def test_technology_names_are_not_websites_but_real_links_are_preserved():
    for technology in ["Next.js", "Node.js", "Vue.js"]:
        assert IdentityExtractor.extract(f"Technologies: {technology}").website is None

    assert IdentityExtractor.extract("Portfolio: example.com").website == "https://example.com"
    assert IdentityExtractor.extract("Portfolio: https://portfolio.dev").website == "https://portfolio.dev"
    assert IdentityExtractor.extract("GitHub: github.com/example-user").github == "https://github.com/example-user"
    assert IdentityExtractor.extract("LinkedIn: linkedin.com/in/example-user").linkedin == "https://linkedin.com/in/example-user"


def test_wrapped_feminine_engineering_title_and_contact_location():
    text = """Alice Martin
Future Ingénieure en Intelligence Artificielle et Sciences des
Données
Profil
Résumé professionnel.
+ Marrakech, Maroc
alice@example.com"""
    identity = IdentityExtractor.extract(text, {"HEADER": "Alice Martin\nFuture Ingénieure en Intelligence Artificielle et Sciences des\nDonnées"})
    assert identity.full_name == "Alice Martin"
    assert identity.job_title == "Future Ingénieure en Intelligence Artificielle et Sciences des Données"
    assert identity.location == "Marrakech, Maroc"
def test_location_preserves_city_and_multiword_country():
    for value in ("Marrakech, Maroc", "London, United Kingdom", "Casablanca, Morocco", "Paris, France"):
        identity = IdentityExtractor.extract(f"Fictional Person\nCloud Engineer\nexample@example.com | +212 600 000 999 | {value}")
        assert identity.location == value


def test_contact_separators_do_not_contaminate_location():
    identity = IdentityExtractor.extract(
        "Fictional Person\nEngineer\nexample@example.com | +212 600 000 999 | London, United Kingdom"
    )
    assert identity.location == "London, United Kingdom"


def test_explicit_contact_without_location_does_not_infer_education_city():
    sections = {
        "HEADER": "Fictional Person\nOperations Specialist",
        "CONTACT": "fictional@example.com\n+212 600 000 999",
        "EDUCATION": "Example Institute, Rabat",
    }
    text = "\n".join(sections.values())
    assert IdentityExtractor.extract(text, sections).location is None


def test_name_split_as_spaced_capitals_is_reconstructed_before_title_fallback():
    identity = IdentityExtractor.extract("N A D I A\nK A R I M\nCONTACT\nfictional@example.com")
    assert identity.full_name == "Nadia Karim"
    assert identity.job_title is None


def test_title_only_header_prefers_null_name_when_experience_confirms_title():
    sections = {
        "HEADER": "Finance Assistant",
        "EXPERIENCES": "Finance Assistant | Fictional Ledger Group\n2022 - 2024",
    }
    identity = IdentityExtractor.extract("Finance Assistant\nEXPERIENCE\n" + sections["EXPERIENCES"], sections)
    assert identity.full_name is None
    assert identity.job_title == "Finance Assistant"


def test_header_summary_prose_is_not_promoted_to_name():
    sections = {"HEADER": "Experienced professional delivering reliable operational improvements."}
    assert IdentityExtractor.extract(sections["HEADER"], sections).full_name is None
