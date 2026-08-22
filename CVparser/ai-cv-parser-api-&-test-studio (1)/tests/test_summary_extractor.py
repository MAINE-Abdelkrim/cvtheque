"""
Unit tests for SummaryExtractor.
"""

from app.extractors.summary_extractor import SummaryExtractor
from app.extractors.identity_extractor import IdentityExtractor


def test_summary_section():
    sections = {"SUMMARY": "Développeur passionné avec 5 ans d'expérience. Spécialisé en Python et Cloud."}
    summary = SummaryExtractor.extract("", sections)
    assert summary == "Développeur passionné avec 5 ans d'expérience. Spécialisé en Python et Cloud."


def test_profile_section():
    sections = {"PROFILE": "Ingénieur Data avec forte expertise SQL et Spark."}
    summary = SummaryExtractor.extract("", sections)
    assert summary == "Ingénieur Data avec forte expertise SQL et Spark."


def test_no_summary_section():
    sections = {"EXPERIENCES": "Développeur chez Tech"}
    summary = SummaryExtractor.extract("", sections)
    assert summary is None


def test_empty_summary_section():
    sections = {"SUMMARY": "   \n  "}
    summary = SummaryExtractor.extract("", sections)
    assert summary is None


def test_summary_filters_parallel_contact_block_but_identity_keeps_it():
    content = """Data engineer building useful systems for clients.
Marrakech, Maroc
alex@example.com
07 12 34 56 78
github.com/alex-example
linkedin.com/in/alex-example"""
    identity = IdentityExtractor.extract(content)
    summary = SummaryExtractor.extract("", {"SUMMARY": content}, identity=identity)
    assert summary == "Data engineer building useful systems for clients."
    assert identity.email == "alex@example.com"
    assert identity.phone == "07 12 34 56 78"
    assert identity.github == "https://github.com/alex-example"
    assert identity.linkedin == "https://linkedin.com/in/alex-example"
    assert identity.location == "Marrakech, Maroc"


def test_summary_preserves_professional_github_prose():
    content = "I publish reusable libraries on GitHub and collaborate with teams in Paris."
    assert SummaryExtractor.extract("", {"SUMMARY": content}) == content
