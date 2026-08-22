"""
Unit tests for LLMResponseParser.
"""

import pytest

from app.core.exceptions import MalformedJSONError, NoJSONObjectFoundError
from app.llm.response_parser import LLMResponseParser


def test_valid_json_object():
    parser = LLMResponseParser()
    raw = '{"summary": "Data Scientist avec 5 ans d\'expérience"}'
    res = parser.parse_completion_response(raw)
    assert isinstance(res, dict)
    assert res["summary"] == "Data Scientist avec 5 ans d'expérience"


def test_markdown_code_fence():
    parser = LLMResponseParser()
    raw = "```json\n{\n  \"summary\": \"Développeur Python\"\n}\n```"
    res = parser.parse_completion_response(raw)
    assert isinstance(res, dict)
    assert res["summary"] == "Développeur Python"


def test_trailing_comma_repair():
    parser = LLMResponseParser()
    raw = '{"summary": "Data Engineer",}'
    res = parser.parse_completion_response(raw)
    assert isinstance(res, dict)
    assert res["summary"] == "Data Engineer"


def test_french_apostrophe_preserved():
    parser = LLMResponseParser()
    raw = '{"summary": "Ingénieur d\'études"}'
    res = parser.parse_completion_response(raw)
    assert res["summary"] == "Ingénieur d'études"


def test_empty_response_raises_no_json_error():
    parser = LLMResponseParser()
    with pytest.raises(NoJSONObjectFoundError):
        parser.parse_completion_response("")

    with pytest.raises(NoJSONObjectFoundError):
        parser.parse_completion_response("   ")


def test_text_without_json_raises_no_json_error():
    parser = LLMResponseParser()
    with pytest.raises(NoJSONObjectFoundError):
        parser.parse_completion_response("Hello, I am an assistant and here is no json.")


def test_malformed_json_raises_error():
    parser = LLMResponseParser()
    with pytest.raises(MalformedJSONError):
        parser.parse_completion_response('{"summary": "incomplete...')


def test_array_root_json_raises_malformed_error():
    parser = LLMResponseParser()
    with pytest.raises(MalformedJSONError):
        parser.parse_completion_response('[{"summary": "test"}]')
