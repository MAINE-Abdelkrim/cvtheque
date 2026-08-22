"""
Unit tests for LanguagesExtractor.
"""

from app.extractors.languages_extractor import LanguagesExtractor


def test_francais_courant():
    sections = {"LANGUAGES": "Français : Courant"}
    langs = LanguagesExtractor.extract(sections)
    assert len(langs) == 1
    assert langs[0].language == "French"
    assert langs[0].level == "Fluent"
    assert langs[0].original_level == "Courant"


def test_english_c1():
    sections = {"LANGUAGES": "English C1"}
    langs = LanguagesExtractor.extract(sections)
    assert len(langs) == 1
    assert langs[0].language == "English"
    assert langs[0].level == "Fluent"
    assert langs[0].original_level == "C1"


def test_arabic_native():
    sections = {"LANGUAGES": "Arabic Native"}
    langs = LanguagesExtractor.extract(sections)
    assert len(langs) == 1
    assert langs[0].language == "Arabic"
    assert langs[0].level == "Native"


def test_langue_sans_niveau():
    sections = {"LANGUAGES": "Espagnol"}
    langs = LanguagesExtractor.extract(sections)
    assert len(langs) == 1
    assert langs[0].language == "Spanish"
    assert langs[0].level is None


def test_suppression_doublons():
    sections = {"LANGUAGES": "Français : Courant\nFrench - Native"}
    langs = LanguagesExtractor.extract(sections)
    assert len(langs) == 1
    assert langs[0].language == "French"


def test_normalisation_niveaux():
    sections = {"LANGUAGES": "Allemand : débutant / a1\nItalien - B2"}
    langs = LanguagesExtractor.extract(sections)
    lang_map = {l.language: l.level for l in langs}
    assert lang_map.get("German") == "Basic"
    assert lang_map.get("Italian") == "Professional"


def test_java_non_detecte_comme_langue():
    sections = {"LANGUAGES": "Java, Python"}
    langs = LanguagesExtractor.extract(sections)
    assert len(langs) == 0


def test_explicit_unknown_language_with_known_level_is_preserved():
    langs = LanguagesExtractor.extract({"LANGUAGES": "Tamazight : Courant"})
    assert len(langs) == 1
    assert langs[0].language == "Tamazight"
    assert langs[0].level == "Fluent"


def test_explicit_language_list_does_not_require_levels():
    langs = LanguagesExtractor.extract({"LANGUAGES": "English\nSpanish\nTamazight"})
    assert [(item.language, item.level) for item in langs] == [
        ("English", None), ("Spanish", None), ("Tamazight", None)
    ]
