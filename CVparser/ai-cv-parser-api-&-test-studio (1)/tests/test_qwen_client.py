"""
Unit tests for QwenLLMClient adapter.
All tests run completely offline without torch, transformers, or real model weights.
"""

import importlib.util
import sys
import threading
from typing import Any
from unittest.mock import MagicMock, call

import pytest

from app.core.config import Settings
from app.core.exceptions import (
    LLMClientDisabledError,
    LLMDependencyError,
    LLMGenerationError,
    LLMModelLoadError,
)
from app.llm import BaseLLMClient, QwenLLMClient
from app.models.cv_models import CVData, Skill
from app.services.llm_extraction_service import LLMExtractionService


def _create_mock_spec(name: str) -> Any:
    """Helper to return a fake ModuleSpec."""
    return importlib.machinery.ModuleSpec(name, None)


def _setup_mock_dependencies(
    monkeypatch: pytest.MonkeyPatch,
    cuda_available: bool = False,
    mps_available: bool = False,
    bf16_supported: bool = False,
    chat_template: Any = "{prompt}",
    pad_token_id: Any = None,
    eos_token_id: Any = 151643,
    generated_text: str = '{"summary": "test response"}',
    tokenizer_load_exc: Any = None,
    model_load_exc: Any = None,
    generation_exc: Any = None,
    decoding_exc: Any = None,
):
    """Setup mock torch and transformers modules in sys.modules."""
    # Mock Torch
    mock_torch = MagicMock()
    mock_torch.float32 = "torch.float32"
    mock_torch.float16 = "torch.float16"
    mock_torch.bfloat16 = "torch.bfloat16"
    mock_torch.cuda.is_available.return_value = cuda_available
    mock_torch.cuda.device_count.return_value = 1 if cuda_available else 0
    mock_torch.cuda.current_device.return_value = 0
    mock_torch.cuda.is_bf16_supported.return_value = bf16_supported

    mock_mps_backend = MagicMock()
    mock_mps_backend.is_available.return_value = mps_available
    mock_torch.backends.mps = mock_mps_backend

    # Mock Tokenizer
    mock_tokenizer = MagicMock()
    mock_tokenizer.pad_token_id = pad_token_id
    mock_tokenizer.eos_token_id = eos_token_id
    mock_tokenizer.chat_template = chat_template

    if chat_template is not None:
        mock_tokenizer.apply_chat_template.return_value = "<formatted_prompt>"

    mock_tokens = MagicMock()
    mock_tokens.to.return_value = mock_tokens
    mock_tokens.__getitem__.return_value = mock_tokens
    mock_tokens.shape = (1, 10)  # Input length 10
    mock_tokenizer.return_value = {"input_ids": mock_tokens}

    if decoding_exc:
        mock_tokenizer.decode.side_effect = decoding_exc
    else:
        mock_tokenizer.decode.return_value = generated_text

    # Mock Model
    mock_model = MagicMock()
    mock_model.to.return_value = mock_model
    mock_model.eval.return_value = None

    mock_output_tokens = MagicMock()
    # Mock slice [0][input_length:]
    mock_generated_slice = MagicMock()
    mock_output_tokens.__getitem__.return_value = MagicMock(
        __getitem__=MagicMock(return_value=mock_generated_slice)
    )

    if generation_exc:
        mock_model.generate.side_effect = generation_exc
    else:
        mock_model.generate.return_value = mock_output_tokens

    # Mock Transformers
    mock_transformers = MagicMock()
    if tokenizer_load_exc:
        mock_transformers.AutoTokenizer.from_pretrained.side_effect = tokenizer_load_exc
    else:
        mock_transformers.AutoTokenizer.from_pretrained.return_value = mock_tokenizer

    if model_load_exc:
        mock_transformers.AutoModelForCausalLM.from_pretrained.side_effect = model_load_exc
    else:
        mock_transformers.AutoModelForCausalLM.from_pretrained.return_value = mock_model

    monkeypatch.setitem(sys.modules, "torch", mock_torch)
    monkeypatch.setitem(sys.modules, "transformers", mock_transformers)

    # Mock importlib find_spec
    orig_find_spec = importlib.util.find_spec

    def custom_find_spec(name, *args, **kwargs):
        if name in ("torch", "transformers"):
            return _create_mock_spec(name)
        return orig_find_spec(name, *args, **kwargs)

    monkeypatch.setattr(importlib.util, "find_spec", custom_find_spec)

    return {
        "torch": mock_torch,
        "transformers": mock_transformers,
        "tokenizer": mock_tokenizer,
        "model": mock_model,
    }


# ==========================================
# Constructor and Validation Tests
# ==========================================


def test_qwen_client_defaults_to_disabled():
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct")
    assert client.enabled is False
    assert client.is_available() is False


def test_qwen_client_rejects_empty_model_name():
    with pytest.raises(ValueError, match="model_name_or_path must be a non-empty string"):
        QwenLLMClient("")

    with pytest.raises(ValueError, match="model_name_or_path must be a non-empty string"):
        QwenLLMClient("   ")


def test_qwen_client_rejects_invalid_device():
    with pytest.raises(ValueError, match="Invalid device 'invalid_dev'"):
        QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", device="invalid_dev")


def test_qwen_client_rejects_invalid_dtype():
    with pytest.raises(ValueError, match="Invalid torch_dtype 'invalid_dtype'"):
        QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", torch_dtype="invalid_dtype")


def test_qwen_client_rejects_non_positive_max_new_tokens():
    with pytest.raises(ValueError, match="max_new_tokens must be an integer greater than 0"):
        QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", max_new_tokens=0)

    with pytest.raises(ValueError, match="max_new_tokens must be an integer greater than 0"):
        QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", max_new_tokens=-10)

    with pytest.raises(ValueError, match="max_new_tokens must be an integer greater than 0"):
        QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", max_new_tokens=True)  # type: ignore


def test_qwen_client_rejects_negative_temperature():
    with pytest.raises(ValueError, match="temperature must be a non-negative number"):
        QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", temperature=-0.1)

    with pytest.raises(ValueError, match="temperature must be a non-negative number"):
        QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", temperature=True)  # type: ignore


def test_qwen_client_rejects_non_positive_repetition_penalty():
    with pytest.raises(ValueError, match="repetition_penalty must be a positive number"):
        QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", repetition_penalty=0.0)

    with pytest.raises(ValueError, match="repetition_penalty must be a positive number"):
        QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", repetition_penalty=-1.1)


# ==========================================
# Disabled Behavior Tests
# ==========================================


def test_disabled_client_is_unavailable():
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=False)
    assert client.is_available() is False


def test_disabled_client_generate_raises_controlled_error():
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=False)
    with pytest.raises(LLMClientDisabledError, match="LLM client is disabled"):
        client.generate("hello prompt")


def test_disabled_client_does_not_import_dependencies(isolated_python):
    code = """
import sys
from app.llm.qwen_client import QwenLLMClient
client = QwenLLMClient('Qwen/Qwen2.5-0.5B-Instruct', enabled=False)
assert client.is_available() is False
assert 'torch' not in sys.modules
assert 'transformers' not in sys.modules
print('OK')
"""
    result = isolated_python(code)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "OK"


# ==========================================
# Dependency Behavior Tests
# ==========================================


def test_module_import_succeeds_without_torch_or_transformers(isolated_python):
    result = isolated_python(
        "import sys; import app.llm.qwen_client; "
        "assert 'torch' not in sys.modules; assert 'transformers' not in sys.modules; print('OK')"
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "OK"


def test_missing_torch_raises_dependency_error(monkeypatch):
    orig_find_spec = importlib.util.find_spec

    def custom_find_spec(name, *args, **kwargs):
        if name == "torch":
            return None
        return orig_find_spec(name, *args, **kwargs)

    monkeypatch.setattr(importlib.util, "find_spec", custom_find_spec)
    monkeypatch.setitem(sys.modules, "torch", None)

    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)
    with pytest.raises(LLMDependencyError, match="Required LLM dependency 'torch' is missing"):
        client.load()


def test_missing_transformers_raises_dependency_error(monkeypatch):
    mock_torch = MagicMock()
    monkeypatch.setitem(sys.modules, "torch", mock_torch)

    orig_find_spec = importlib.util.find_spec

    def custom_find_spec(name, *args, **kwargs):
        if name == "transformers":
            return None
        if name == "torch":
            return _create_mock_spec("torch")
        return orig_find_spec(name, *args, **kwargs)

    monkeypatch.setattr(importlib.util, "find_spec", custom_find_spec)
    monkeypatch.setitem(sys.modules, "transformers", None)

    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)
    with pytest.raises(LLMDependencyError, match="Required LLM dependency 'transformers' is missing"):
        client.load()


def test_is_available_does_not_load_model(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    avail = client.is_available()
    assert avail is True
    assert client.is_loaded is False
    mocks["transformers"].AutoModelForCausalLM.from_pretrained.assert_not_called()


# ==========================================
# Lazy Loading Tests
# ==========================================


def test_constructor_does_not_load_dependencies():
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)
    assert client.is_loaded is False
    assert client._model is None
    assert client._tokenizer is None


def test_generate_triggers_lazy_load(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)
    assert client.is_loaded is False

    res = client.generate("test prompt")
    assert res == '{"summary": "test response"}'
    assert client.is_loaded is True
    mocks["transformers"].AutoTokenizer.from_pretrained.assert_called_once()
    mocks["transformers"].AutoModelForCausalLM.from_pretrained.assert_called_once()


def test_load_is_idempotent(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    client.load()
    assert client.is_loaded is True
    client.load()  # Second call
    assert mocks["transformers"].AutoTokenizer.from_pretrained.call_count == 1
    assert mocks["transformers"].AutoModelForCausalLM.from_pretrained.call_count == 1


def test_concurrent_load_does_not_load_twice(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    def target():
        client.load()

    threads = [threading.Thread(target=target) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert mocks["transformers"].AutoTokenizer.from_pretrained.call_count == 1
    assert mocks["transformers"].AutoModelForCausalLM.from_pretrained.call_count == 1


# ==========================================
# Local-Only Behavior Tests
# ==========================================


def test_local_files_only_defaults_true():
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct")
    assert client.local_files_only is True


def test_local_files_only_forwarded_to_tokenizer(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True, local_files_only=True)
    client.load()

    mocks["transformers"].AutoTokenizer.from_pretrained.assert_called_once_with(
        "Qwen/Qwen2.5-0.5B-Instruct",
        local_files_only=True,
        trust_remote_code=False,
    )


def test_local_files_only_forwarded_to_model(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True, local_files_only=True)
    client.load()

    mocks["transformers"].AutoModelForCausalLM.from_pretrained.assert_called_once_with(
        "Qwen/Qwen2.5-0.5B-Instruct",
        torch_dtype="torch.float32",
        local_files_only=True,
        trust_remote_code=False,
    )


def test_no_download_helpers_are_called(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True, local_files_only=True)
    client.load()

    # Ensure no network download helper calls were made
    assert mocks["transformers"].snapshot_download.call_count == 0


# ==========================================
# Device Behavior Tests
# ==========================================


def test_auto_selects_cuda_when_available(monkeypatch):
    _setup_mock_dependencies(monkeypatch, cuda_available=True)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True, device="auto")
    client.load()
    assert client.resolved_device == "cuda"


def test_auto_falls_back_when_cuda_probe_is_unusable(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch, cuda_available=True)
    mocks["torch"].cuda.current_device.side_effect = RuntimeError("CUDA probe failed")
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True, device="auto")
    client.load()
    assert client.resolved_device == "cpu"


def test_auto_selects_mps_when_cuda_unavailable(monkeypatch):
    _setup_mock_dependencies(monkeypatch, cuda_available=False, mps_available=True)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True, device="auto")
    client.load()
    assert client.resolved_device == "mps"


def test_auto_selects_cpu_as_fallback(monkeypatch):
    _setup_mock_dependencies(monkeypatch, cuda_available=False, mps_available=False)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True, device="auto")
    client.load()
    assert client.resolved_device == "cpu"


def test_explicit_unavailable_cuda_raises(monkeypatch):
    _setup_mock_dependencies(monkeypatch, cuda_available=False)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True, device="cuda")
    with pytest.raises(LLMModelLoadError, match="CUDA device explicitly requested but CUDA is not available"):
        client.load()


def test_explicit_unavailable_mps_raises(monkeypatch):
    _setup_mock_dependencies(monkeypatch, mps_available=False)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True, device="mps")
    with pytest.raises(LLMModelLoadError, match="MPS device explicitly requested but MPS is not available"):
        client.load()


# ==========================================
# Dtype Behavior Tests
# ==========================================


def test_auto_cpu_uses_float32(monkeypatch):
    _setup_mock_dependencies(monkeypatch, cuda_available=False)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True, device="cpu", torch_dtype="auto")
    client.load()
    assert client.resolved_dtype == "float32"


def test_explicit_float16_is_forwarded(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True, device="cpu", torch_dtype="float16")
    client.load()
    assert client.resolved_dtype == "float16"
    assert mocks["transformers"].AutoModelForCausalLM.from_pretrained.call_args[1]["torch_dtype"] == "torch.float16"


def test_explicit_bfloat16_is_forwarded(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True, device="cpu", torch_dtype="bfloat16")
    client.load()
    assert client.resolved_dtype == "bfloat16"
    assert mocks["transformers"].AutoModelForCausalLM.from_pretrained.call_args[1]["torch_dtype"] == "torch.bfloat16"


# ==========================================
# Generation Behavior Tests
# ==========================================


def test_generate_rejects_blank_prompt():
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)
    with pytest.raises(ValueError, match="prompt must be a non-empty string"):
        client.generate("")

    with pytest.raises(ValueError, match="prompt must be a non-empty string"):
        client.generate("   \n ")


def test_generate_uses_chat_template(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch, chat_template="<custom_template>")
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    client.generate("hello prompt")
    mocks["tokenizer"].apply_chat_template.assert_called_once_with(
        [{"role": "user", "content": "hello prompt"}],
        tokenize=False,
        add_generation_prompt=True,
    )


def test_generate_falls_back_to_raw_prompt_without_template(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch, chat_template=None)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    client.generate("raw user prompt")
    mocks["tokenizer"].assert_called_once_with("raw user prompt", return_tensors="pt")


def test_generate_forwards_deterministic_parameters(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient(
        "Qwen/Qwen2.5-0.5B-Instruct",
        enabled=True,
        max_new_tokens=512,
        do_sample=False,
        repetition_penalty=1.2,
    )

    client.generate("test prompt")
    gen_call_kwargs = mocks["model"].generate.call_args[1]
    assert gen_call_kwargs["max_new_tokens"] == 512
    assert gen_call_kwargs["do_sample"] is False
    assert gen_call_kwargs["repetition_penalty"] == 1.2
    assert "temperature" not in gen_call_kwargs
    mocks["torch"].inference_mode.assert_called_once_with()


def test_temperature_only_forwarded_when_sampling(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient(
        "Qwen/Qwen2.5-0.5B-Instruct",
        enabled=True,
        do_sample=True,
        temperature=0.7,
    )

    client.generate("test prompt")
    gen_call_kwargs = mocks["model"].generate.call_args[1]
    assert gen_call_kwargs["do_sample"] is True
    assert gen_call_kwargs["temperature"] == 0.7


def test_generate_uses_eos_as_pad_when_pad_missing(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch, pad_token_id=None, eos_token_id=999)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    client.generate("test prompt")
    gen_call_kwargs = mocks["model"].generate.call_args[1]
    assert gen_call_kwargs["pad_token_id"] == 999
    assert gen_call_kwargs["eos_token_id"] == 999


def test_generate_decodes_only_new_tokens(monkeypatch):
    mocks = _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    client.generate("test prompt")
    # Verify decode was called on the sliced output
    mocks["tokenizer"].decode.assert_called_once()


def test_generate_returns_stripped_response(monkeypatch):
    _setup_mock_dependencies(monkeypatch, generated_text="  \n  hello response   \n")
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    res = client.generate("test prompt")
    assert res == "hello response"


def test_last_prompt_is_recorded(monkeypatch):
    _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    client.generate("recorded prompt string")
    assert client.last_prompt == "recorded prompt string"


# ==========================================
# Error Behavior Tests
# ==========================================


def test_tokenizer_load_error_is_wrapped(monkeypatch):
    _setup_mock_dependencies(monkeypatch, tokenizer_load_exc=RuntimeError("tokenizer corrupt"))
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    with pytest.raises(LLMModelLoadError, match="Failed to load model 'Qwen/Qwen2.5-0.5B-Instruct'"):
        client.load()


def test_model_load_error_is_wrapped(monkeypatch):
    _setup_mock_dependencies(monkeypatch, model_load_exc=RuntimeError("weights missing"))
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    with pytest.raises(LLMModelLoadError, match="Failed to load model 'Qwen/Qwen2.5-0.5B-Instruct'"):
        client.load()


def test_generation_error_is_wrapped(monkeypatch):
    _setup_mock_dependencies(monkeypatch, generation_exc=RuntimeError("CUDA OOM"))
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    with pytest.raises(LLMGenerationError, match="Error during model generation"):
        client.generate("test prompt")


def test_decoding_error_is_wrapped(monkeypatch):
    _setup_mock_dependencies(monkeypatch, decoding_exc=UnicodeDecodeError("utf-8", b"", 0, 1, "bad"))
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    with pytest.raises(LLMGenerationError, match="Error decoding generated output"):
        client.generate("test prompt")


def test_partial_load_state_is_cleared_after_failure(monkeypatch):
    _setup_mock_dependencies(monkeypatch, model_load_exc=RuntimeError("model load fail"))
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)

    with pytest.raises(LLMModelLoadError):
        client.load()

    assert client.is_loaded is False
    assert client._tokenizer is None
    assert client._model is None
    assert client.load_error is not None


# ==========================================
# Cleanup Tests
# ==========================================


def test_cleanup_before_loading_is_safe():
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=False)
    client.cleanup()
    assert client.is_loaded is False


def test_cleanup_clears_loaded_state(monkeypatch):
    _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)
    client.load()
    assert client.is_loaded is True

    client.cleanup()
    assert client.is_loaded is False
    assert client._tokenizer is None
    assert client._model is None


def test_cleanup_is_idempotent(monkeypatch):
    _setup_mock_dependencies(monkeypatch)
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)
    client.load()

    client.cleanup()
    client.cleanup()
    assert client.is_loaded is False


def test_cleanup_does_not_import_torch_when_never_loaded():
    assert "torch" not in sys.modules
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=False)
    client.cleanup()
    assert "torch" not in sys.modules


# ==========================================
# Compatibility Tests
# ==========================================


def test_qwen_client_is_base_llm_client():
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct")
    assert isinstance(client, BaseLLMClient)


def test_qwen_client_can_be_passed_to_llm_extraction_service_with_mocked_generation(monkeypatch):
    _setup_mock_dependencies(
        monkeypatch,
        generated_text='{"summary": "Développeur Python senior."}',
    )
    client = QwenLLMClient("Qwen/Qwen2.5-0.5B-Instruct", enabled=True)
    service = LLMExtractionService()

    raw_cv = CVData(summary="", skills=[Skill(name="Python", category="Backend")])
    enriched_cv = service.enrich(
        raw_cv,
        "Développeur Python senior",
        {"summary": "Développeur Python senior"},
        client=client,
    )

    assert enriched_cv.summary == "Développeur Python senior."


def test_importing_app_llm_does_not_load_torch_or_transformers(isolated_python):
    result = isolated_python(
        "import sys; import app.llm; assert hasattr(app.llm, 'QwenLLMClient'); "
        "assert 'torch' not in sys.modules; assert 'transformers' not in sys.modules; print('OK')"
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "OK"


# ==========================================
# Configuration Tests
# ==========================================


def test_model_enabled_defaults_false():
    settings = Settings(_env_file=None)
    assert settings.MODEL_ENABLED is False
    assert settings.MODEL_PROVIDER == "pytorch"


def test_model_local_files_only_defaults_true():
    settings = Settings(_env_file=None)
    assert settings.MODEL_LOCAL_FILES_ONLY is True


def test_model_name_default_preserved():
    settings = Settings(_env_file=None)
    assert settings.MODEL_NAME == "Qwen/Qwen2.5-0.5B-Instruct"


def test_model_device_default():
    settings = Settings(_env_file=None)
    assert settings.MODEL_DEVICE == "auto"


def test_declared_defaults_ignore_local_dotenv(tmp_path, monkeypatch):
    (tmp_path / ".env").write_text('MODEL_DEVICE="cpu"\n', encoding="utf-8")
    monkeypatch.chdir(tmp_path)

    settings = Settings(_env_file=None)

    assert settings.MODEL_DEVICE == "auto"


def test_model_generation_defaults():
    settings = Settings(_env_file=None)
    assert settings.MODEL_TORCH_DTYPE == "auto"
    assert settings.MODEL_MAX_NEW_TOKENS == 512
    assert settings.MODEL_DO_SAMPLE is False
    assert settings.MODEL_TEMPERATURE == 0.0
    assert settings.MODEL_TOP_P == 0.9
    assert settings.MODEL_REPETITION_PENALTY == 1.1
    assert settings.MODEL_TRUST_REMOTE_CODE is False
