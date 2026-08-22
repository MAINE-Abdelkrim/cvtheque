"""
Unit tests for JSON extraction and syntax repair utilities.
"""

import pytest
from app.utils.json_utils import (
    extract_json_from_llm_output,
    repair_json_syntax,
    parse_and_clean_json,
)
from app.core.exceptions import (
    JSONValidationError,
    NoJSONObjectFoundError,
    MalformedJSONError,
)


def test_extract_json_from_markdown():
    llm_output = "Voici le résultat :\n```json\n{\n  \"full_name\": \"Jean Dupont\"\n}\n```\nEn espérant que cela aide."
    extracted = extract_json_from_llm_output(llm_output)
    assert extracted == '{\n  "full_name": "Jean Dupont"\n}'


def test_repair_json_trailing_commas():
    broken_json = '{\n  "skills": ["Python", "SQL",],\n  "identity": {"name": "Jean",},\n}'
    repaired = repair_json_syntax(broken_json)
    parsed = parse_and_clean_json(repaired)
    assert parsed["skills"] == ["Python", "SQL"]
    assert parsed["identity"]["name"] == "Jean"


def test_french_apostrophe_preserved():
    valid_json_with_apostrophe = '{\n  "description": "Développement d\'une application de recrutement"\n}'
    parsed = parse_and_clean_json(valid_json_with_apostrophe)
    assert parsed["description"] == "Développement d'une application de recrutement"


def test_parse_and_clean_json_valid():
    text = "```json\n{\"professional_summary\": \"Ingénieur IA expérimenté\"}\n```"
    data = parse_and_clean_json(text)
    assert data["professional_summary"] == "Ingénieur IA expérimenté"


def test_empty_output_raises_no_json_error():
    with pytest.raises(NoJSONObjectFoundError):
        parse_and_clean_json("")


def test_text_without_json_raises_no_json_error():
    with pytest.raises(NoJSONObjectFoundError):
        parse_and_clean_json("Bonjour, voici une description en texte brut sans objet JSON.")


def test_truncated_json_raises_malformed_json_error():
    truncated_json = '{\n  "identity": {\n    "full_name": "Ahmed"'
    with pytest.raises(MalformedJSONError):
        parse_and_clean_json(truncated_json)
