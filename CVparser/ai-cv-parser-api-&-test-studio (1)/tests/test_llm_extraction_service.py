"""
Unit tests for LLMExtractionService.
"""

import sys
from app.llm.base_client import MockLLMClient
from app.core.exceptions import (
    LLMClientDisabledError,
    LLMDependencyError,
    LLMGenerationError,
    LLMModelLoadError,
)
from app.models.cv_models import (
    Certification,
    CVData,
    Education,
    Experience,
    Identity,
    Language,
    Skill,
)
from app.services.llm_extraction_service import LLMExtractionService


def test_client_none_returns_separate_cvdata():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    res = service.enrich(det, "Jean Dupont", {})
    assert res == det
    assert res is not det
    assert len(res.warnings) == 0


def test_unavailable_client_returns_unchanged():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    client = MockLLMClient(available=False)
    res = service.enrich(det, "Jean Dupont", {}, client=client)
    assert res.identity.full_name == "Jean Dupont"
    assert client.last_prompt is None
    assert len(res.warnings) == 0


def test_no_missing_fields_avoids_client_call():
    service = LLMExtractionService()
    det = CVData(
        identity=Identity(
            full_name="Jean Dupont",
            email="jean@example.com",
            phone="+33612345678",
            location="Paris",
            linkedin="linkedin.com/in/jean",
            github="github.com/jean",
            website="jean.com",
            job_title="Engineer",
        ),
        summary="Senior Engineer",
        skills=[Skill(name="Python")],
        languages=[Language(language="French")],
        certifications=[Certification(name="AWS")],
        education=[Education(degree="Master")],
        experiences=[Experience(job_title="Developer")],
    )

    client = MockLLMClient(response='{"summary": "Overwritten"}')
    res = service.enrich(det, "Jean Dupont", {}, client=client)

    assert client.last_prompt is None
    assert res.summary == "Senior Engineer"


def test_successful_missing_scalar_completion():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    cleaned_text = "Jean Dupont\nPhone: +33612345678\nParis, France"
    response_json = '{"identity": {"phone": "+33612345678", "location": "Paris, France"}}'

    client = MockLLMClient(response=response_json)
    res = service.enrich(det, cleaned_text, {}, client=client)

    assert res.identity.full_name == "Jean Dupont"
    assert res.identity.phone == "+33612345678"
    assert res.identity.location == "Paris, France"


def test_protected_scalar_cannot_be_overwritten():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont", phone="+33612345678"))
    cleaned_text = "Jean Dupont\nPhone: +33612345678\nFake Phone: +1999999999"
    response_json = '{"identity": {"full_name": "Jean Overwrite", "phone": "+1999999999"}}'

    client = MockLLMClient(response=response_json)
    res = service.enrich(det, cleaned_text, {}, client=client)

    assert res.identity.full_name == "Jean Dupont"
    assert res.identity.phone == "+33612345678"


def test_empty_list_can_be_filled():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"), skills=[])
    cleaned_text = "Jean Dupont\nCompétences: Python, FastAPI, Docker"
    response_json = '{"skills": [{"name": "Python"}, {"name": "FastAPI"}]}'

    client = MockLLMClient(response=response_json)
    res = service.enrich(det, cleaned_text, {}, client=client)

    assert len(res.skills) == 2
    assert res.skills[0].name == "Python"
    assert res.skills[1].name == "FastAPI"


def test_non_empty_list_cannot_be_replaced_or_appended():
    service = LLMExtractionService()
    det = CVData(
        identity=Identity(full_name="Jean Dupont"),
        skills=[Skill(name="Python")],
    )
    cleaned_text = "Jean Dupont\nSkills: Python, Java, Go"
    response_json = '{"skills": [{"name": "Java"}, {"name": "Go"}]}'

    client = MockLLMClient(response=response_json)
    res = service.enrich(det, cleaned_text, {}, client=client)

    assert len(res.skills) == 1
    assert res.skills[0].name == "Python"


def test_unknown_top_level_and_nested_fields_rejected():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    cleaned_text = "Jean Dupont\nPhone: +33612345678"
    response_json = '{"identity": {"phone": "+33612345678", "unknown_id_field": 123}, "unknown_top_field": "test"}'

    client = MockLLMClient(response=response_json)
    res = service.enrich(det, cleaned_text, {}, client=client)

    assert res.identity.phone == "+33612345678"
    assert any("unsupported fields" in w for w in res.warnings)


def test_unsupported_scalar_value_rejected():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    cleaned_text = "Jean Dupont\nSoftware Engineer"
    # Location "Tokyo" is nowhere in cleaned_text
    response_json = '{"identity": {"location": "Tokyo"}}'

    client = MockLLMClient(response=response_json)
    res = service.enrich(det, cleaned_text, {}, client=client)

    assert res.identity.location is None
    assert any("unsupported values" in w for w in res.warnings)


def test_unsupported_skill_rejected_supported_skill_accepted():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    cleaned_text = "Jean Dupont\nSkills: Python"
    response_json = '{"skills": [{"name": "Python"}, {"name": "QuantumComputing"}]}'

    client = MockLLMClient(response=response_json)
    res = service.enrich(det, cleaned_text, {}, client=client)

    assert len(res.skills) == 1
    assert res.skills[0].name == "Python"
    assert any("unsupported values" in w for w in res.warnings)


def test_partially_grounded_experience_filters_unsupported_siblings():
    service = LLMExtractionService()
    det = CVData(experiences=[])
    cleaned_text = "Backend Developer\nBuilt APIs for payment processing"
    response_json = """{
        "experiences": [{
            "job_title": "Backend Developer",
            "company": "Invented Corp",
            "start_date": "2021",
            "end_date": "2024",
            "description": "Built APIs for payment processing"
        }]
    }"""

    res = service.enrich(det, cleaned_text, {}, MockLLMClient(response=response_json))

    assert len(res.experiences) == 1
    experience = res.experiences[0]
    assert experience.job_title == "Backend Developer"
    assert experience.description == "Built APIs for payment processing"
    assert experience.company is None
    assert experience.start_date is None
    assert experience.end_date is None
    assert res.warnings == ["LLM response contained unsupported values"]


def test_partially_grounded_education_filters_unsupported_siblings():
    service = LLMExtractionService()
    det = CVData(education=[])
    cleaned_text = "Master in Computer Science"
    response_json = """{
        "education": [{
            "degree": "Master in Computer Science",
            "institution": "Invented University",
            "field_of_study": "Artificial Intelligence",
            "end_date": "2023"
        }]
    }"""

    res = service.enrich(det, cleaned_text, {}, MockLLMClient(response=response_json))

    assert len(res.education) == 1
    education = res.education[0]
    assert education.degree == "Master in Computer Science"
    assert education.institution is None
    assert education.field_of_study is None
    assert education.end_date is None
    assert res.warnings == ["LLM response contained unsupported values"]


def test_blank_and_punctuation_only_items_are_rejected():
    service = LLMExtractionService()
    det = CVData(skills=[])
    response_json = '{"skills": [{"name": ""}, {"name": "   "}, {"name": "..."}]}'

    res = service.enrich(det, "Skills section", {}, MockLLMClient(response=response_json))

    assert res.skills == []
    assert res.warnings == ["LLM response contained unsupported values"]


def test_grounded_short_skill_names_remain_valid():
    service = LLMExtractionService()
    det = CVData(skills=[])
    cleaned_text = "Skills: C, R, Go, C++, C#, AI, BI"
    response_json = """{
        "skills": [
            {"name": "C"}, {"name": "R"}, {"name": "Go"},
            {"name": "C++"}, {"name": "C#"}, {"name": "AI"}, {"name": "BI"}
        ]
    }"""

    res = service.enrich(det, cleaned_text, {}, MockLLMClient(response=response_json))

    assert [skill.name for skill in res.skills] == ["C", "R", "Go", "C++", "C#", "AI", "BI"]


def test_filtered_duplicate_items_preserve_first_seen_order():
    service = LLMExtractionService()
    det = CVData(experiences=[])
    cleaned_text = "Backend Developer"
    response_json = """{
        "experiences": [
            {"job_title": "Backend Developer", "company": "Invented One"},
            {"job_title": "Backend Developer", "company": "Invented Two"}
        ]
    }"""

    res = service.enrich(det, cleaned_text, {}, MockLLMClient(response=response_json))

    assert len(res.experiences) == 1
    assert res.experiences[0].job_title == "Backend Developer"
    assert res.experiences[0].company is None
    assert res.warnings == ["LLM response contained unsupported values"]


def test_invalid_nested_object_schema():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    cleaned_text = "Jean Dupont\nSkills: Python"
    response_json = '{"skills": "not a list"}'

    client = MockLLMClient(response=response_json)
    res = service.enrich(det, cleaned_text, {}, client=client)

    assert len(res.skills) == 0
    assert any("failed schema validation" in w for w in res.warnings)


def test_malformed_json_adds_warning_and_preserves_data():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    cleaned_text = "Jean Dupont"
    response_json = '{"identity": {"phone": "+336123...'

    client = MockLLMClient(response=response_json)
    res = service.enrich(det, cleaned_text, {}, client=client)

    assert res.identity.full_name == "Jean Dupont"
    assert any("malformed" in w for w in res.warnings)


def test_empty_response_adds_warning_and_preserves_data():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    client = MockLLMClient(response="")
    res = service.enrich(det, "Jean Dupont", {}, client=client)

    assert res.identity.full_name == "Jean Dupont"
    assert any("no valid JSON" in w for w in res.warnings)


def test_client_exception_adds_warning_and_preserves_data():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    client = MockLLMClient(exception=RuntimeError("Connection timeout"))
    res = service.enrich(det, "Jean Dupont", {}, client=client)

    assert res.identity.full_name == "Jean Dupont"
    assert any("LLM completion failed" in w for w in res.warnings)


def test_dependency_failure_adds_sanitized_initialization_warning():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    client = MockLLMClient(
        exception=LLMDependencyError("Missing dependency at C:\\private\\torch")
    )

    res = service.enrich(det, "Jean Dupont", {}, client=client)

    assert res.identity.full_name == "Jean Dupont"
    assert res.warnings == ["LLM initialization failed"]


def test_model_load_failure_adds_sanitized_initialization_warning():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    client = MockLLMClient(
        exception=LLMModelLoadError("CUDA failed for private/model-name")
    )

    res = service.enrich(det, "Jean Dupont", {}, client=client)

    assert res.identity.full_name == "Jean Dupont"
    assert res.warnings == ["LLM initialization failed"]


def test_generation_failure_adds_sanitized_completion_warning():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    client = MockLLMClient(
        exception=LLMGenerationError("Provider timeout in /private/model/path")
    )

    res = service.enrich(det, "Jean Dupont", {}, client=client)

    assert res.identity.full_name == "Jean Dupont"
    assert res.warnings == ["LLM completion failed"]


def test_disabled_client_error_adds_unavailable_warning():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    client = MockLLMClient(
        exception=LLMClientDisabledError("Disabled private provider")
    )

    res = service.enrich(det, "Jean Dupont", {}, client=client)

    assert res.identity.full_name == "Jean Dupont"
    assert res.warnings == ["LLM enrichment unavailable"]


def test_unexpected_failure_adds_sanitized_completion_warning():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    client = MockLLMClient(
        exception=RuntimeError("Stack trace from C:\\private\\provider internals")
    )

    res = service.enrich(det, "Jean Dupont", {}, client=client)

    assert res.identity.full_name == "Jean Dupont"
    assert res.warnings == ["LLM completion failed"]


def test_original_deterministic_data_not_mutated():
    service = LLMExtractionService()
    det = CVData(identity=Identity(full_name="Jean Dupont"))
    orig_dump = det.model_dump()
    cleaned_text = "Jean Dupont\nParis"
    response_json = '{"identity": {"location": "Paris"}}'

    client = MockLLMClient(response=response_json)
    res = service.enrich(det, cleaned_text, {}, client=client)

    assert res.identity.location == "Paris"
    assert det.model_dump() == orig_dump


def test_no_torch_or_transformers_during_mock_execution(isolated_python):
    code = """
import sys
from app.llm.base_client import MockLLMClient
from app.models.cv_models import CVData
from app.services.llm_extraction_service import LLMExtractionService
service = LLMExtractionService()
service.enrich(CVData(), 'Paris', {}, MockLLMClient(response='{}'))
assert 'torch' not in sys.modules
assert 'transformers' not in sys.modules
print('OK')
"""
    result = isolated_python(code)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "OK"
