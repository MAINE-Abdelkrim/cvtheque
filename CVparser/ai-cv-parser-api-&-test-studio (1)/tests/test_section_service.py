"""
Unit tests for SectionService (Phase 2):
- Détection des sections en français et en anglais
- Conservation des dates et du contenu métier
"""

from app.services.section_service import SectionService


def test_detection_sections_francais():
    resume_text = """
    Alice Martin
    alice.martin@example.com
    
    PROFIL
    Ingénieure en Intelligence Artificielle expérimentée.
    
    EXPÉRIENCES PROFESSIONNELLES
    • 2021–2024 : Lead Data Scientist chez AI Solutions
      Développement de pipelines de NLP et vision par ordinateur.
    • 03/2020 : Stage Data Science chez TechCorp
    
    FORMATION
    • 2018–2021 : Diplôme d'Ingénieur en Informatique - ÉNS
    
    COMPÉTENCES TECHNIQUES
    • Python, PyTorch, FastAPI, Docker
    
    LANGUES
    • Français : Langue maternelle
    • Anglais : Courant (C1)
    """

    sections, canonicals = SectionService.detect_and_segment_sections(resume_text)

    assert "SUMMARY" in canonicals
    assert "EXPERIENCES" in canonicals
    assert "EDUCATION" in canonicals
    assert "SKILLS" in canonicals
    assert "LANGUAGES" in canonicals

    assert "Lead Data Scientist" in sections["EXPERIENCES"]
    assert "2021–2024" in sections["EXPERIENCES"]
    assert "Diplôme d'Ingénieur" in sections["EDUCATION"]
    assert "PyTorch" in sections["SKILLS"]


def test_detection_sections_anglais():
    english_resume = """
    John Doe
    john.doe@email.com
    
    WORK EXPERIENCE
    • 2022 - Present: Senior Software Engineer at Global Tech
      Architected microservices using Python and Docker.
    
    EDUCATION
    • 2017 - 2021: Bachelor of Science in Computer Science - Tech University
    
    TECHNICAL SKILLS
    • Python, FastAPI, PostgreSQL, Kubernetes
    
    LANGUAGES
    • English: Native
    • French: Professional
    """

    sections, canonicals = SectionService.detect_and_segment_sections(english_resume)

    assert "EXPERIENCES" in canonicals
    assert "EDUCATION" in canonicals
    assert "SKILLS" in canonicals
    assert "LANGUAGES" in canonicals

    assert "Senior Software Engineer" in sections["EXPERIENCES"]
    assert "2022 - Present" in sections["EXPERIENCES"]
    assert "Bachelor of Science" in sections["EDUCATION"]
    assert "PostgreSQL" in sections["SKILLS"]


def test_singular_english_experience_is_controlled_alias():
    sections, detected = SectionService.detect_and_segment_sections(
        "SKILLS\nPython\nEXPERIENCE\nSoftware Engineer | Fictional Labs\n2022 - Present\nCERTIFICATIONS\nCloud Certificate | Example 2024"
    )
    assert detected == ["SKILLS", "EXPERIENCES", "CERTIFICATIONS"]
    assert "Software Engineer" in sections["EXPERIENCES"]
    assert "Cloud Certificate" not in sections["EXPERIENCES"]


def test_contact_section_bounds_sidebar_content():
    sections, detected = SectionService.detect_and_segment_sections(
        "Imane Example\nUX Designer\nPROFESSIONAL SUMMARY\nDesigns accessible products\nCONTACT\nexample@example.com\nSKILLS\nFigma"
    )
    assert "CONTACT" in detected
    assert sections["SUMMARY"] == "Designs accessible products"
    assert sections["CONTACT"] == "example@example.com"


def test_conservation_dates_et_contenu_metier():
    cv_content = """
    EXPÉRIENCES
    • 15/03/2020 - 30/08/2022 : Développeur Fullstack chez WebAgency Paris
      - Mise en place d'une architecture microservices
      - Optimisation de requêtes SQL réduisant la latence de 40%
    • 2023–Présent : Lead Developer chez InnovApp
      - Encadrement d'une équipe de 5 développeurs
    """

    sections, canonicals = SectionService.detect_and_segment_sections(cv_content)

    exp_text = sections["EXPERIENCES"]
    assert "15/03/2020 - 30/08/2022" in exp_text
    assert "2023–Présent" in exp_text
    assert "WebAgency Paris" in exp_text
    assert "réduisant la latence de 40%" in exp_text
    assert "Encadrement d'une équipe de 5 développeurs" in exp_text


def test_accented_french_headings_and_section_termination():
    text = """Alex Martin
Profil
Data engineer
Formation Académique
Cycle Ingénieur - Intelligence Artificielle
Expérience Professionnelle
Stagiaire Backend chez Example Corp
Projets IA & Data Science
Projet de recommandation
Compétences Techniques
Python, FastAPI
Certifications
Cloud Fundamentals
Langues
Français : Courant
Anglais : Courant"""
    sections, detected = SectionService.detect_and_segment_sections(text)

    assert detected == ["SUMMARY", "EDUCATION", "EXPERIENCES", "PROJECTS", "SKILLS", "CERTIFICATIONS", "LANGUAGES"]
    assert "Cycle Ingénieur" in sections["EDUCATION"]
    assert "Stagiaire Backend" in sections["EXPERIENCES"]
    assert "Projet de recommandation" in sections["PROJECTS"]
    assert "Cloud Fundamentals" not in sections["SKILLS"]
    assert sections["LANGUAGES"] == "Français : Courant\nAnglais : Courant"


def test_multiline_canonical_heading_does_not_leak_into_section_body():
    sections, detected = SectionService.detect_and_segment_sections(
        "EXPÉRIENCES\nPROFESSIONNELLES\nOperations Specialist | Example Company\n2024 - Présent"
    )
    assert detected == ["EXPERIENCES"]
    assert sections["EXPERIENCES"].startswith("Operations Specialist")
    assert "PROFESSIONNELLES" not in sections["EXPERIENCES"]


def test_common_education_and_training_heading_is_controlled_alias():
    sections, detected = SectionService.detect_and_segment_sections(
        "EDUCATION AND PROFESSIONAL TRAINING\nBachelor in Analytics\nExample College"
    )
    assert detected == ["EDUCATION"]
    assert "Bachelor in Analytics" in sections["EDUCATION"]
