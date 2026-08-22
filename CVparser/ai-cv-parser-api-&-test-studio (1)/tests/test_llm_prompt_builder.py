"""
Unit tests for LLMPromptBuilder.
Tests prompt structure, protected field survival, and section-aware input bounding.
"""

import json
from app.llm.prompt_builder import LLMPromptBuilder
from app.models.cv_models import Certification, CVData, Education, Experience, Identity, Language, Skill


def test_prompt_includes_cleaned_text_sections_and_deterministic_data():
    builder = LLMPromptBuilder()
    data = CVData(
        identity=Identity(full_name="Jean Dupont", phone="+33612345678"),
        skills=[Skill(name="Python")],
    )
    cleaned_text = "Jean Dupont\nPython Developer\n+33612345678"
    sections = {"skills": "Python"}

    prompt = builder.build_completion_prompt(cleaned_text, sections, data)

    assert "Jean Dupont" in prompt
    assert "+33612345678" in prompt
    assert "Python Developer" in prompt
    assert "cleaned_cv_text" in prompt
    assert "detected_sections" in prompt
    assert "deterministic_cv_data" in prompt


def test_protected_and_allowed_completion_fields():
    builder = LLMPromptBuilder()
    data = CVData(
        identity=Identity(full_name="Jean Dupont", email=None, phone="+33612345678"),
        summary=None,
        skills=[Skill(name="Python")],
        education=[],
    )

    missing, protected = builder.get_missing_and_protected_fields(data)

    assert "identity.full_name" in protected
    assert "identity.phone" in protected
    assert "skills" in protected

    assert "identity.email" in missing
    assert "identity.location" in missing
    assert "summary" in missing
    assert "education" in missing

    for p in protected:
        assert p not in missing


def test_prompt_rules_included():
    builder = LLMPromptBuilder()
    data = CVData()
    prompt = builder.build_completion_prompt("CV text", {}, data)

    assert "Extract ONLY facts explicitly present" in prompt
    assert "Return pure JSON ONLY" in prompt
    assert "allowed_completion_fields" in prompt
    assert "protected_fields" in prompt


def test_empty_missing_fields_when_all_populated():
    builder = LLMPromptBuilder()
    data = CVData(
        identity=Identity(
            full_name="Alice Smith",
            email="alice@example.com",
            phone="+123456789",
            location="Paris, France",
            linkedin="linkedin.com/in/alice",
            github="github.com/alice",
            website="alice.dev",
            job_title="Data Scientist",
        ),
        summary="Experienced Data Scientist.",
        skills=[Skill(name="Python")],
        languages=[Language(language="French")],
        certifications=[Certification(name="AWS Certified")],
        education=[Education(degree="MSc")],
        experiences=[Experience(job_title="Data Scientist")],
    )
    missing, protected = builder.get_missing_and_protected_fields(data)
    assert len(missing) == 0
    assert len(protected) == 14  # 8 identity + 1 summary + 5 lists


def test_one_missing_scalar_field():
    builder = LLMPromptBuilder()
    data = CVData(
        identity=Identity(
            full_name="Bob",
            email="bob@example.com",
            phone="+1234",
            location="Lyon",
            linkedin="in/bob",
            github="gh/bob",
            website="bob.io",
            job_title=None,
        )
    )
    missing, protected = builder.get_missing_and_protected_fields(data)
    assert "identity.job_title" in missing
    assert "identity.full_name" in protected


def test_cv_shorter_than_limit():
    builder = LLMPromptBuilder(max_text_length=1000)
    data = CVData(identity=Identity(full_name="Short CV"))
    text = "Short CV Content\nEmail: short@example.com"
    prompt = builder.build_completion_prompt(text, {}, data)
    parsed = json.loads(prompt)

    assert "Short CV Content" in parsed["cleaned_cv_text"]
    assert "text_omission_warning" not in parsed
    assert builder.last_text_was_bounded is False


def test_short_cv_preserves_distinctive_content_at_end():
    builder = LLMPromptBuilder(max_text_length=1000)
    data = CVData(identity=Identity(full_name="Short Candidate"))
    text = "Short Candidate\nPython Developer\nDISTINCTIVE-END-MARKER"
    sections = {"header": "Short Candidate", "skills": "Python Developer"}

    parsed = json.loads(builder.build_completion_prompt(text, sections, data))

    assert parsed["cleaned_cv_text"] == text
    assert parsed["cleaned_cv_text"].endswith("DISTINCTIVE-END-MARKER")
    assert parsed["detected_sections"] == sections
    assert builder.last_text_was_bounded is False


def test_long_two_page_cv_bounded_with_warning():
    builder = LLMPromptBuilder(max_text_length=500)
    data = CVData(identity=Identity(full_name="Long CV Owner"), skills=[])
    work_lines = [
        f"{2010 + index}: Delivered project {index + 1} with measurable engineering outcomes."
        for index in range(20)
    ]
    work_text = "\n".join(work_lines)
    long_text = f"Header section\n{work_text}\nSkills: Python, Docker, PyTest"
    sections = {
        "header": "Header section",
        "work": work_text,
        "skills": "Skills: Python, Docker, PyTest",
    }
    prompt = builder.build_completion_prompt(long_text, sections, data)
    parsed = json.loads(prompt)

    assert parsed["cleaned_cv_text"].endswith("[CV TEXT BOUNDED: Additional sections omitted to fit context limit]")
    assert "text_omission_warning" in parsed
    assert builder.last_text_was_bounded is True


def test_bounded_prompt_does_not_reinclude_omitted_section_content():
    builder = LLMPromptBuilder(max_text_length=300)
    data = CVData(skills=[])
    priority_text = "Skills:\n" + "\n".join(
        f"Technology-{index}: production experience" for index in range(80)
    )
    omitted_marker = "OMITTED-UNIQUE-MARKER-DO-NOT-INCLUDE"
    cleaned_text = priority_text + "\n" + "General history " * 80
    sections = {
        "skills": priority_text,
        "appendix": omitted_marker + (" private appendix" * 5000),
    }

    prompt = builder.build_completion_prompt(cleaned_text, sections, data)
    parsed = json.loads(prompt)

    assert builder.last_text_was_bounded is True
    assert "Technology-0" in parsed["cleaned_cv_text"]
    assert omitted_marker not in prompt
    assert parsed["detected_sections"] == {}
    assert "Extract ONLY facts explicitly present" in prompt
    assert "Return pure JSON ONLY" in prompt
    assert prompt == builder.build_completion_prompt(cleaned_text, sections, data)


def test_bounded_prompt_growth_is_independent_of_omitted_section_size():
    builder = LLMPromptBuilder(max_text_length=250)
    data = CVData(skills=[])
    priority_text = "Skills: " + ", ".join(f"Tool-{index}" for index in range(100))
    cleaned_text = priority_text + "\nAdditional history"

    small_prompt = builder.build_completion_prompt(
        cleaned_text, {"skills": priority_text, "appendix": "X" * 1000}, data
    )
    large_prompt = builder.build_completion_prompt(
        cleaned_text, {"skills": priority_text, "appendix": "X" * 100000}, data
    )

    assert len(large_prompt) == len(small_prompt)


def test_experience_near_end_of_document_prioritized():
    builder = LLMPromptBuilder(max_text_length=300)
    data = CVData(
        identity=Identity(
            full_name="John Doe",
            email="john@example.com",
            phone="+33123456789",
            location="Paris",
            linkedin="linkedin.com/in/johndoe",
            github="github.com/johndoe",
            website="johndoe.dev",
            job_title="Senior Developer",
        ),
        summary="Backend engineer focused on reliable distributed systems.",
        skills=[Skill(name="Python")],
        languages=[Language(language="English")],
        certifications=[Certification(name="AWS Certified Developer")],
        education=[Education(degree="MSc Computer Science")],
        experiences=[],
    )
    summary_text = "\n".join(
        f"Professional achievement {index + 1}: improved a production engineering process."
        for index in range(10)
    )
    experience_text = "Senior Developer at TechCorp (2020-2023). Built backend API services."
    cleaned_text = f"{summary_text}\n{experience_text}"
    sections = {
        "summary": summary_text,
        "experience": experience_text,
    }
    prompt = builder.build_completion_prompt(cleaned_text, sections, data)
    parsed = json.loads(prompt)

    # Experience section must be prioritized first because experiences field is missing
    assert "Senior Developer at TechCorp" in parsed["cleaned_cv_text"]


def test_skills_near_end_of_document_prioritized():
    builder = LLMPromptBuilder(max_text_length=300)
    data = CVData(
        identity=Identity(
            full_name="Jane Doe",
            email="jane@example.com",
            phone="+33123456780",
            location="Lyon",
            linkedin="linkedin.com/in/janedoe",
            github="github.com/janedoe",
            website="janedoe.dev",
            job_title="Software Engineer",
        ),
        summary="Software engineer experienced in production web platforms.",
        skills=[],
        languages=[Language(language="French")],
        certifications=[Certification(name="Professional Scrum Master")],
        education=[Education(degree="BSc Software Engineering")],
        experiences=[Experience(job_title="Software Engineer")],
    )
    summary_text = "\n".join(
        f"Platform achievement {index + 1}: delivered a reliable customer-facing capability."
        for index in range(10)
    )
    skills_text = "Key Skills: Python, FastAPI, React, PostgreSQL"
    cleaned_text = f"{summary_text}\n{skills_text}"
    sections = {
        "summary": summary_text,
        "skills": skills_text,
    }
    prompt = builder.build_completion_prompt(cleaned_text, sections, data)
    parsed = json.loads(prompt)

    assert "Key Skills: Python" in parsed["cleaned_cv_text"]


def test_multilingual_text_handling():
    builder = LLMPromptBuilder()
    data = CVData(identity=Identity(full_name="Jean-François D'Arras"))
    multilingual_text = "Jean-François D'Arras, Ingénieur Développeur. Spécialité: AI / ML <Python>."
    prompt = builder.build_completion_prompt(multilingual_text, {"header": "Jean-François"}, data)
    parsed = json.loads(prompt)

    assert "Jean-François D'Arras" in parsed["cleaned_cv_text"]


def test_duplicated_sections_deduplicated():
    builder = LLMPromptBuilder()
    data = CVData(identity=Identity(full_name="Duplicated Text"))
    repeated_line = "This is a repeated footer or header line that appears multiple times in text.\n"
    text = "Name: Test User\n" + (repeated_line * 5)
    prompt = builder.build_completion_prompt(text, {}, data)
    parsed = json.loads(prompt)

    # Repeated lines should be collapsed to single occurrence
    assert parsed["cleaned_cv_text"].count("This is a repeated footer") == 1


def test_missing_section_headers_fallback():
    builder = LLMPromptBuilder(max_text_length=200)
    data = CVData(identity=Identity(full_name="No Headers"))
    text = "Plain unsectioned document text without headers. " * 10
    prompt = builder.build_completion_prompt(text, {}, data)  # Empty sections dict
    parsed = json.loads(prompt)

    assert "Plain unsectioned document" in parsed["cleaned_cv_text"]


def test_protected_values_survive_prompt_preparation():
    builder = LLMPromptBuilder()
    data = CVData(
        identity=Identity(
            full_name="Protected Full Name",
            email="protected@example.com",
            phone="+33123456789",
        ),
        summary="Protected summary text.",
    )
    prompt = builder.build_completion_prompt("CV text", {}, data)
    parsed = json.loads(prompt)

    assert "identity.full_name" in parsed["protected_fields"]
    assert "identity.email" in parsed["protected_fields"]
    assert "identity.phone" in parsed["protected_fields"]
    assert "summary" in parsed["protected_fields"]
    assert parsed["deterministic_cv_data"]["identity"]["full_name"] == "Protected Full Name"


def test_input_cvdata_not_mutated():
    builder = LLMPromptBuilder()
    data = CVData(identity=Identity(full_name="Jean Dupont"))
    original_dump = data.model_dump()

    _ = builder.build_completion_prompt("Jean Dupont", {}, data)

    assert data.model_dump() == original_dump
