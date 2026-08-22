"""Centralized section-specific prompts for semantic CV extraction."""

import json
from typing import Dict


SECTION_SCHEMAS: Dict[str, object] = {
    "SUMMARY": {"summary": None},
    "SKILLS": {"skills": [{"name": ""}]},
    "EXPERIENCES": {"experiences": [{"job_title": None, "company": None, "location": None, "start_date": None, "end_date": None, "description": None}]},
    "EDUCATION": {"education": [{"degree": None, "field_of_study": None, "institution": None, "location": None, "start_date": None, "end_date": None, "description": None}]},
    "LANGUAGES": {"languages": [{"language": "", "level": None, "original_level": None}]},
    "CERTIFICATIONS": {"certifications": [{"name": "", "issuer": None, "date": None, "credential_id": None}]},
}

SECTION_RULES: Dict[str, list[str]] = {
    "SUMMARY": ["Preserve the candidate-written meaning; do not rewrite creatively.", "Return null for empty or invalid content."],
    "SKILLS": ["Return only explicit short skills from this section.", "Preserve multi-word skills; omit headings, sentences, and duplicates."],
    "EXPERIENCES": ["Preserve every explicit experience without merging or unnecessary splitting.", "A city is not a job title and a task sentence is not a company.", "Support title-first, company-first, and date-first records."],
    "EDUCATION": ["Preserve every explicit education entry and full institution names.", "Do not infer degree level, field of study, or candidate residence."],
    "LANGUAGES": ["Preserve every explicit language.", "If proficiency is absent, return null; never infer it."],
    "CERTIFICATIONS": ["One logical certification is one record, including wrapped names.", "Do not invent issuer, date, or credential ID."],
}


def build_semantic_section_prompt(section_name: str, section_text: str) -> str:
    """Build a bounded JSON-only prompt containing one canonical section."""
    if section_name not in SECTION_SCHEMAS:
        raise ValueError(f"Unsupported semantic section: {section_name}")
    payload = {
        "task": f"Extract structured {section_name.lower()} data from one CV section",
        "rules": [
            "Use only facts explicitly present in section_text.",
            "Do not infer, invent, or use outside knowledge.",
            "Return null when a scalar value is unclear.",
            "Return JSON only, without Markdown or commentary.",
            *SECTION_RULES[section_name],
        ],
        "required_json_shape": SECTION_SCHEMAS[section_name],
        "section_name": section_name,
        "section_text": section_text,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)
