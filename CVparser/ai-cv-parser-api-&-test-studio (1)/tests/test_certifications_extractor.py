"""
Unit tests for CertificationsExtractor.
"""

from app.extractors.certifications_extractor import CertificationsExtractor


def test_aws_certification():
    sections = {"CERTIFICATIONS": "AWS Certified Cloud Practitioner — 2024"}
    certs = CertificationsExtractor.extract(sections)
    assert len(certs) == 1
    assert "AWS" in certs[0].name or certs[0].issuer == "AWS"
    assert certs[0].date == "2024"


def test_azure_certification():
    sections = {"CERTIFICATIONS": "Microsoft Azure Fundamentals (2023)"}
    certs = CertificationsExtractor.extract(sections)
    assert len(certs) == 1
    assert certs[0].issuer in ("Microsoft", "Azure")
    assert certs[0].date == "2023"


def test_scrum_psm1():
    sections = {"CERTIFICATIONS": "Scrum Master PSM I"}
    certs = CertificationsExtractor.extract(sections)
    assert len(certs) == 1
    assert "PSM I" in certs[0].name or "Scrum" in certs[0].name


def test_toeic():
    sections = {"CERTIFICATIONS": "TOEIC 850 (2022)"}
    certs = CertificationsExtractor.extract(sections)
    assert len(certs) == 1
    assert "TOEIC" in certs[0].name
    assert certs[0].date == "2022"


def test_certification_sans_date():
    sections = {"CERTIFICATIONS": "Cisco CCNA"}
    certs = CertificationsExtractor.extract(sections)
    assert len(certs) == 1
    assert certs[0].name == "Cisco CCNA"
    assert certs[0].date is None


def test_plusieurs_certifications():
    sections = {"CERTIFICATIONS": "AWS Certified Developer — 2023\nOracle Certified Java Programmer — 2021"}
    certs = CertificationsExtractor.extract(sections)
    assert len(certs) == 2
    assert certs[0].date == "2023"
    assert certs[1].date == "2021"


def test_certification_name_has_no_trailing_separator():
    sections = {
        "CERTIFICATIONS": "AWS Certified Cloud Practitioner — 2024"
    }
    certs = CertificationsExtractor.extract(sections)
    assert len(certs) == 1
    assert certs[0].name == "AWS Certified Cloud Practitioner"
    assert certs[0].date == "2024"


def test_certification_with_pipe_separator():
    sections = {
        "CERTIFICATIONS": "Microsoft Azure Fundamentals | 2023"
    }
    cert = CertificationsExtractor.extract(sections)[0]
    assert cert.name == "Microsoft Azure Fundamentals"
    assert cert.date == "2023"


def test_internal_hyphen_is_preserved():
    sections = {
        "CERTIFICATIONS": "AWS Certified Machine-Learning Specialty — 2024"
    }
    cert = CertificationsExtractor.extract(sections)[0]
    assert cert.name == "AWS Certified Machine-Learning Specialty"


def test_certification_without_date_has_clean_name():
    sections = {
        "CERTIFICATIONS": "Cisco CCNA —"
    }
    cert = CertificationsExtractor.extract(sections)[0]
    assert cert.name == "Cisco CCNA"


def test_pipe_delimited_wrapped_certifications_keep_titles_and_issuers():
    text = """Machine Learning – Duke University
|
NoSQL
Databases – IBM
|
Python Web Data – University of Michigan"""
    certs = CertificationsExtractor.extract({"CERTIFICATIONS": text})
    assert [(cert.name, cert.issuer) for cert in certs] == [
        ("Machine Learning", "Duke University"),
        ("NoSQL Databases", "IBM"),
        ("Python Web Data", "University of Michigan"),
    ]


def test_internal_title_hyphen_date_and_credential_are_preserved():
    cert = CertificationsExtractor.extract(
        {"CERTIFICATIONS": "Machine-Learning Foundations — Example Institute — 2024 Credential ID: ABC-123"}
    )[0]
    assert cert.name.startswith("Machine-Learning Foundations")
    assert cert.date == "2024"
    assert cert.credential_id == "ABC-123"
    assert "Machine-Learning" in cert.name


def test_wrapped_certification_before_structured_issuer_line_is_one_record():
    certs = CertificationsExtractor.extract({
        "CERTIFICATIONS": "Operations Management\nCertificate | Open Learning Academy 2024"
    })
    assert len(certs) == 1
    assert certs[0].name == "Operations Management Certificate"
    assert certs[0].issuer == "Open Learning Academy"
    assert certs[0].date == "2024"


def test_lowercase_wrapped_certification_continuation_is_one_record():
    certs = CertificationsExtractor.extract({"CERTIFICATIONS": "Business foundations\nconsulting practice (Example Academy)"})
    assert len(certs) == 1
    assert certs[0].name == "Business foundations consulting practice (Example Academy)"


def test_wrapped_name_issuer_and_date_records_are_grouped():
    text = """Cloud Service
Architecture
Fictional Learning Institute 2024
Operational Leadership
Open Skills Academy
2023"""
    certs = CertificationsExtractor.extract({"CERTIFICATIONS": text})
    assert len(certs) == 2
    assert certs[0].name == "Cloud Service Architecture"
    assert certs[0].issuer == "Fictional Learning Institute"
    assert certs[0].date == "2024"
    assert certs[1].name == "Operational Leadership"
    assert certs[1].issuer == "Open Skills Academy"
    assert certs[1].date == "2023"


def test_certification_artifact_is_ignored_and_valid_partial_records_remain():
    text = """Secure Delivery | Example Institute | 2025
Independent Practice Certificate
<"""
    certs = CertificationsExtractor.extract({"CERTIFICATIONS": text})
    assert len(certs) == 2
    assert certs[0].name == "Secure Delivery"
    assert certs[1].name == "Independent Practice Certificate"
    assert certs[1].issuer is None
    assert certs[1].date is None
