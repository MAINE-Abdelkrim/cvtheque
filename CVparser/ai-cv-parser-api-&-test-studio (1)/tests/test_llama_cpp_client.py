"""Unit tests for the llama.cpp provider; no real GGUF is loaded."""

import importlib.machinery
import sys
import threading
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import LLMClientDisabledError, LLMGenerationError, LLMModelLoadError
from app.llm.llama_cpp_client import LlamaCppLLMClient


def _mock_runtime(monkeypatch, tmp_path, response=None):
    model_path = tmp_path / "model.gguf"
    model_path.write_bytes(b"mock")
    model = MagicMock()
    model.create_chat_completion.return_value = response or {
        "choices": [{"message": {"content": '{"experiences":[]}'}}]
    }
    module = MagicMock()
    module.Llama.return_value = model
    monkeypatch.setitem(sys.modules, "llama_cpp", module)
    original = importlib.util.find_spec
    monkeypatch.setattr(
        importlib.util,
        "find_spec",
        lambda name: importlib.machinery.ModuleSpec(name, None)
        if name == "llama_cpp"
        else original(name),
    )
    return model_path, module, model


def test_disabled_client_is_unavailable_and_cannot_generate(tmp_path):
    client = LlamaCppLLMClient(str(tmp_path / "missing.gguf"))
    assert client.is_available() is False
    with pytest.raises(LLMClientDisabledError):
        client.generate("prompt")


def test_missing_gguf_is_safe_failure(tmp_path):
    client = LlamaCppLLMClient(str(tmp_path / "missing.gguf"), enabled=True)
    assert client.is_available() is False
    with pytest.raises(LLMModelLoadError, match="does not exist"):
        client.load()


def test_load_is_lazy_and_idempotent(monkeypatch, tmp_path):
    path, module, _ = _mock_runtime(monkeypatch, tmp_path)
    client = LlamaCppLLMClient(str(path), enabled=True)
    assert client.is_loaded is False
    client.generate("prompt")
    client.generate("prompt again")
    assert client.is_loaded is True
    module.Llama.assert_called_once_with(
        model_path=str(path.resolve()), n_ctx=1024, n_threads=4,
        n_threads_batch=4, n_gpu_layers=0, verbose=False,
    )


def test_concurrent_load_constructs_model_once(monkeypatch, tmp_path):
    path, module, _ = _mock_runtime(monkeypatch, tmp_path)
    client = LlamaCppLLMClient(str(path), enabled=True)
    threads = [threading.Thread(target=client.load) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    module.Llama.assert_called_once()


def test_generation_is_json_bounded_and_cpu_only(monkeypatch, tmp_path):
    path, _, model = _mock_runtime(monkeypatch, tmp_path)
    client = LlamaCppLLMClient(str(path), enabled=True, max_tokens=128)
    assert client.generate("prompt") == '{"experiences":[]}'
    kwargs = model.create_chat_completion.call_args.kwargs
    assert kwargs["temperature"] == 0.0
    assert kwargs["max_tokens"] == 128
    assert kwargs["response_format"] == {"type": "json_object"}


def test_malformed_runtime_response_is_controlled(monkeypatch, tmp_path):
    path, _, _ = _mock_runtime(monkeypatch, tmp_path, response={"choices": []})
    client = LlamaCppLLMClient(str(path), enabled=True)
    with pytest.raises(LLMGenerationError):
        client.generate("prompt")
