"""
Unit tests for BaseLLMClient and MockLLMClient.
"""

import pytest

from app.llm.base_client import BaseLLMClient, MockLLMClient


def test_default_mock_response():
    client = MockLLMClient()
    assert client.is_available() is True
    res = client.generate("test prompt")
    assert res == "{}"
    assert client.last_prompt == "test prompt"


def test_configured_mock_response():
    client = MockLLMClient(response='{"summary": "Test Summary"}', available=True)
    res = client.generate("hello")
    assert res == '{"summary": "Test Summary"}'
    assert client.last_prompt == "hello"


def test_unavailable_mock_client():
    client = MockLLMClient(available=False)
    assert client.is_available() is False
    assert client.enabled is True


def test_disabled_mock_client():
    client = MockLLMClient(enabled=False)
    assert client.is_available() is False
    assert client.enabled is False


def test_disabled_and_available_mock_client():
    client = MockLLMClient(enabled=False, available=True)
    assert client.is_available() is False
    assert client.enabled is False


def test_configured_mock_exception():
    client = MockLLMClient(exception=RuntimeError("LLM offline"))
    with pytest.raises(RuntimeError, match="LLM offline"):
        client.generate("hello")
    assert client.last_prompt == "hello"


def test_no_torch_or_transformers_loaded(isolated_python):
    result = isolated_python(
        "import sys; import app.llm.base_client; "
        "assert 'torch' not in sys.modules; assert 'transformers' not in sys.modules; print('OK')"
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "OK"
