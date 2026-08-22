import json
import time

from app.llm.base_client import BaseLLMClient, MockLLMClient
from app.models.cv_models import CVData, Experience, Skill
from app.services.semantic_extraction_service import SemanticExtractionService


class SequentialClient(BaseLLMClient):
    enabled = True
    def __init__(self, responses):
        self.responses = iter(responses)
        self.prompts = []
    def is_available(self): return True
    def generate(self, prompt):
        self.prompts.append(prompt)
        return next(self.responses)


def test_experience_semantics_can_replace_wrong_grounded_deterministic_roles():
    section = "INTERNSHIP NORTHSTAR SERVICES - RABAT\nMarch 2024 to June 2024\nPrepared reports and handled customer records."
    deterministic = CVData(experiences=[Experience(job_title="RABAT", company="Prepared reports")])
    response = json.dumps({"experiences": [{"job_title": "INTERNSHIP", "company": "NORTHSTAR SERVICES", "location": "RABAT", "start_date": "March 2024", "end_date": "June 2024", "description": "Prepared reports and handled customer records."}]})
    client = SequentialClient([response])

    outcome = SemanticExtractionService().extract(deterministic, {"EXPERIENCES": section}, client)

    assert outcome.contributed is True
    assert outcome.cv_data.experiences[0].job_title == "INTERNSHIP"
    assert outcome.cv_data.experiences[0].company == "NORTHSTAR SERVICES"
    assert outcome.cv_data.experiences[0].location == "RABAT"
    prompt = json.loads(client.prompts[0])
    assert prompt["section_name"] == "EXPERIENCES"
    assert prompt["section_text"] == section
    assert "cleaned_cv_text" not in prompt


def test_hallucinated_fields_are_nulled_but_grounded_siblings_survive():
    section = "Service Designer\n2022 - 2024\nDesigned accessible workflows."
    response = '{"experiences":[{"job_title":"Service Designer","company":"Invented Corp","start_date":"2022","end_date":"2024"}]}'
    outcome = SemanticExtractionService().extract(CVData(), {"EXPERIENCES": section}, MockLLMClient(response=response))
    item = outcome.cv_data.experiences[0]
    assert item.job_title == "Service Designer"
    assert item.company is None
    assert "unsupported values" in " ".join(outcome.cv_data.warnings)


def test_malformed_section_response_falls_back_without_losing_deterministic_data():
    deterministic = CVData(skills=[Skill(name="Python")])
    outcome = SemanticExtractionService().extract(deterministic, {"SKILLS": "Python"}, MockLLMClient(response="not json"))
    assert [skill.name for skill in outcome.cv_data.skills] == ["Python"]
    assert outcome.contributed is False
    assert "deterministic fallback" in " ".join(outcome.cv_data.warnings)


def test_unavailable_generation_exception_falls_back():
    deterministic = CVData(skills=[Skill(name="Python")])
    outcome = SemanticExtractionService().extract(deterministic, {"SKILLS": "Python"}, MockLLMClient(exception=RuntimeError("private failure")))
    assert outcome.cv_data.skills == deterministic.skills
    assert outcome.contributed is False


def test_only_nonempty_supported_sections_are_called():
    client = SequentialClient(['{"skills":[{"name":"Python"}]}'])
    outcome = SemanticExtractionService().extract(CVData(), {"SKILLS": "Python", "EDUCATION": "", "CONTACT": "private"}, client)
    assert outcome.contributed is True
    assert len(client.prompts) == 1
    assert json.loads(client.prompts[0])["section_name"] == "SKILLS"


def test_timeout_returns_deterministic_fallback():
    class SlowClient(BaseLLMClient):
        enabled = True
        def is_available(self): return True
        def generate(self, prompt):
            time.sleep(0.05)
            return '{"skills":[{"name":"Python"}]}'
    deterministic = CVData(skills=[Skill(name="Python")])
    outcome = SemanticExtractionService(timeout_seconds=0.001).extract(deterministic, {"SKILLS": "Python"}, SlowClient())
    assert outcome.contributed is False
    assert outcome.cv_data.skills == deterministic.skills


def test_unknown_schema_fields_trigger_section_fallback():
    deterministic = CVData(skills=[Skill(name="Python")])
    response = '{"skills":[{"name":"Python"}],"private_reasoning":"hidden"}'
    outcome = SemanticExtractionService().extract(deterministic, {"SKILLS": "Python"}, MockLLMClient(response=response))
    assert outcome.contributed is False
    assert outcome.cv_data.skills == deterministic.skills
    assert "deterministic fallback" in " ".join(outcome.cv_data.warnings)


def test_summary_and_each_list_schema_are_pydantic_validated_and_grounded():
    sections = {"SUMMARY": "Careful systems specialist.", "SKILLS": "Python\nDesign Systems", "LANGUAGES": "English", "CERTIFICATIONS": "Cloud Basics | Fictional Institute | 2025", "EDUCATION": "Master Data Science\nFictional University\n2022 - 2024"}
    responses = [
        '{"summary":"Careful systems specialist."}',
        '{"skills":[{"name":"Python"},{"name":"Design Systems"}]}',
        '{"education":[{"degree":"Master","field_of_study":"Data Science","institution":"Fictional University","start_date":"2022","end_date":"2024"}]}',
        '{"languages":[{"language":"English","level":null}]}',
        '{"certifications":[{"name":"Cloud Basics","issuer":"Fictional Institute","date":"2025","credential_id":null}]}',
    ]
    outcome = SemanticExtractionService().extract(CVData(), sections, SequentialClient(responses))
    assert set(outcome.successful_sections) == set(sections)
    assert outcome.cv_data.summary
    assert len(outcome.cv_data.skills) == 2
    assert len(outcome.cv_data.education) == len(outcome.cv_data.languages) == len(outcome.cv_data.certifications) == 1


def test_evidence_accepts_only_controlled_text_and_date_normalizations():
    service = SemanticExtractionService()
    assert service.classify_evidence("Stage d initiation", "STAGE D'INITIATION") == "NORMALIZED_SUPPORTED"
    assert service.classify_evidence("Fevrier 2024", "Février 2024") == "NORMALIZED_SUPPORTED"
    assert service.classify_evidence("Present", "Présent") == "NORMALIZED_SUPPORTED"
    assert service.classify_evidence("2024-03", "03/2024") == "NORMALIZED_SUPPORTED"
    assert service.classify_evidence("Invented Corporation", "Northstar Services") == "UNSUPPORTED"
