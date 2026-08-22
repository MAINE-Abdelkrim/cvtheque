"""
Unit tests for app.llm.client_factory.
"""

import sys
from unittest.mock import patch, MagicMock
import pytest

from app.core.config import Settings
from app.llm.client_factory import create_llm_client
from app.llm.llama_cpp_client import LlamaCppLLMClient
from app.llm.qwen_client import QwenLLMClient


def test_factory_returns_none_when_disabled():
    """Verify that factory returns None when MODEL_ENABLED=False."""
    settings = Settings(MODEL_ENABLED=False)
    client = create_llm_client(settings)
    assert client is None


def test_factory_returns_qwen_client_when_enabled():
    """Verify that factory returns a QwenLLMClient when MODEL_ENABLED=True."""
    settings = Settings(MODEL_ENABLED=True, MODEL_NAME="Qwen/Qwen2.5-0.5B-Instruct")
    client = create_llm_client(settings)
    assert isinstance(client, QwenLLMClient)
    assert client.enabled is True


def test_factory_selects_llama_cpp_without_loading_model(tmp_path):
    model_path = tmp_path / "qwen.gguf"
    settings = Settings(
        MODEL_ENABLED=True,
        MODEL_PROVIDER="llama_cpp",
        MODEL_GGUF_PATH=str(model_path),
        MODEL_N_THREADS=4,
        MODEL_CONTEXT_SIZE=1024,
        MODEL_MAX_NEW_TOKENS=256,
        _env_file=None,
    )
    client = create_llm_client(settings)
    assert isinstance(client, LlamaCppLLMClient)
    assert client.is_loaded is False
    assert client.n_threads == 4
    assert client.n_ctx == 1024
    assert client.max_tokens == 256


def test_factory_reuses_same_process_client_for_same_configuration(tmp_path):
    settings = Settings(
        MODEL_ENABLED=True,
        MODEL_PROVIDER="llama_cpp",
        MODEL_GGUF_PATH=str(tmp_path / "qwen.gguf"),
        _env_file=None,
    )
    assert create_llm_client(settings) is create_llm_client(settings)


def test_factory_rejects_unknown_provider():
    settings = Settings(MODEL_ENABLED=True, MODEL_PROVIDER="unknown", _env_file=None)
    with pytest.raises(ValueError, match="MODEL_PROVIDER"):
        create_llm_client(settings)


def test_factory_forwards_all_settings_correctly():
    """Verify that all relevant configuration settings are forwarded to QwenLLMClient."""
    settings = Settings(
        MODEL_ENABLED=True,
        MODEL_NAME="custom-org/custom-model",
        MODEL_LOCAL_FILES_ONLY=True,
        MODEL_DEVICE="cpu",
        MODEL_TORCH_DTYPE="float32",
        MODEL_MAX_NEW_TOKENS=512,
        MODEL_DO_SAMPLE=False,
        MODEL_TEMPERATURE=0.2,
        MODEL_TOP_P=0.85,
        MODEL_REPETITION_PENALTY=1.2,
        MODEL_TRUST_REMOTE_CODE=False,
    )
    client = create_llm_client(settings)
    assert isinstance(client, QwenLLMClient)
    assert client.model_name_or_path == "custom-org/custom-model"
    assert client.enabled is True
    assert client.local_files_only is True
    assert client.device == "cpu"
    assert client.torch_dtype == "float32"
    assert client.max_new_tokens == 512
    assert client.do_sample is False
    assert client.temperature == 0.2
    assert client.top_p == 0.85
    assert client.repetition_penalty == 1.2
    assert client.trust_remote_code is False


def test_factory_does_not_call_load_or_load_weights():
    """Verify that creating client via factory does not trigger load()."""
    settings = Settings(MODEL_ENABLED=True)
    client = create_llm_client(settings)
    assert isinstance(client, QwenLLMClient)
    assert client._is_loaded is False
    assert client._model is None
    assert client._tokenizer is None


def test_factory_does_not_import_torch_or_transformers():
    """Verify that calling factory when disabled does not import torch or transformers."""
    # Ensure client factory can run with disabled settings without requiring heavy imports
    settings = Settings(MODEL_ENABLED=False)
    client = create_llm_client(settings)
    assert client is None


def test_factory_performs_no_network_access():
    """Verify that client creation doesn't make external network or HF Hub calls."""
    settings = Settings(MODEL_ENABLED=True, MODEL_LOCAL_FILES_ONLY=True)
    with patch("urllib.request.urlopen") as mock_url:
        client = create_llm_client(settings)
        assert client is not None
        mock_url.assert_not_called()
