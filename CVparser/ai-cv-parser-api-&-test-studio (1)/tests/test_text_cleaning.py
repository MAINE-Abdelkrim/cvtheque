"""
Unit tests for text cleaning and section title normalization utilities.
"""

from app.utils.text_cleaning import (
    clean_whitespace,
    normalize_line_breaks,
    strip_bullet_points_and_symbols,
    remove_accents_and_lowercase,
    normalize_header_title,
    clean_raw_resume_text,
    dehyphenate_pdf_line_wraps,
)


def test_clean_whitespace():
    raw = "  Jean  Dupont   \n\xa0 Developpeur\t\tPython  \n"
    cleaned = clean_whitespace(raw)
    assert "Jean Dupont" in cleaned
    assert "Developpeur Python" in cleaned


def test_normalize_line_breaks():
    text = "Section 1\n\n\n\n\nSection 2"
    result = normalize_line_breaks(text)
    assert result == "Section 1\n\nSection 2"


def test_strip_bullet_points_and_symbols():
    header = "► 1. COMPÉTENCES TECHNIQUES :"
    stripped = strip_bullet_points_and_symbols(header)
    assert "COMPÉTENCES TECHNIQUES" in stripped
    assert "►" not in stripped


def test_remove_accents_and_lowercase():
    assert remove_accents_and_lowercase("Éducation") == "education"
    assert remove_accents_and_lowercase("Expériences") == "experiences"


def test_normalize_header_title_variations():
    assert normalize_header_title("• EXPÉRIENCES") == "EXPERIENCES"
    assert normalize_header_title("1. EXPÉRIENCES") == "EXPERIENCES"
    assert normalize_header_title("★ 2. Expériences Professionnelles :") == "EXPERIENCES PROFESSIONNELLES"


def test_clean_raw_resume_text_preserves_dates_and_content():
    raw_resume = """
    2022 - Développeur Backend
    2021–2024 ABC Tech
    03/2020 : Stage Data Science
    • Conception d'une API REST FastAPI
    • Optimisation de requêtes SQL
    """
    orig, cleaned = clean_raw_resume_text(raw_resume)
    assert orig == raw_resume
    assert "2022 - Développeur Backend" in cleaned
    assert "2021–2024 ABC Tech" in cleaned
    assert "03/2020 : Stage Data Science" in cleaned
    assert "FastAPI" in cleaned
    assert "SQL" in cleaned


def test_dehyphenates_pdf_wrapped_lowercase_words():
    text = "Sci- ences\nintel-\nligentes\nrecom-\nmandation\ndévelop-\npement"
    repaired = dehyphenate_pdf_line_wraps(text)
    assert repaired == "Sciences\nintelligentes\nrecommandation\ndéveloppement"


def test_dehyphenation_preserves_compounds_dates_and_bullets():
    text = "Back-end\nFull-stack\nMachine-learning\nclient-server\ne-mail\nJuil. – Août 2025\n• API REST"
    assert dehyphenate_pdf_line_wraps(text) == text
