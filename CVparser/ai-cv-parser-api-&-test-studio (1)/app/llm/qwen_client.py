"""
Local Qwen LLM adapter implementing BaseLLMClient interface.
Supports lazy loading, disabled-by-default execution, dependency-safe imports,
portable device resolution, and thread-safe initialization.
"""

import gc
from contextlib import nullcontext
import importlib.util
import os
import sys
import threading
from typing import Any, Dict, Optional

from app.core.exceptions import (
    LLMClientDisabledError,
    LLMDependencyError,
    LLMGenerationError,
    LLMModelLoadError,
)
from app.llm.base_client import BaseLLMClient


class QwenLLMClient(BaseLLMClient):
    """Local Qwen LLM adapter implementing BaseLLMClient."""

    ALLOWED_DEVICES = {"auto", "cpu", "cuda", "mps"}
    ALLOWED_DTYPES = {"auto", "float32", "float16", "bfloat16"}

    def __init__(
        self,
        model_name_or_path: str,
        *,
        enabled: bool = False,
        local_files_only: bool = True,
        device: str = "auto",
        torch_dtype: str = "auto",
        max_new_tokens: int = 512,
        do_sample: bool = False,
        temperature: float = 0.0,
        top_p: float = 0.9,
        repetition_penalty: float = 1.1,
        trust_remote_code: bool = False,
    ) -> None:
        """Initialize Qwen client configuration and validate inputs."""
        if not isinstance(model_name_or_path, str) or not model_name_or_path.strip():
            raise ValueError("model_name_or_path must be a non-empty string.")

        if device not in self.ALLOWED_DEVICES:
            raise ValueError(
                f"Invalid device '{device}'. Must be one of {sorted(self.ALLOWED_DEVICES)}."
            )

        if torch_dtype not in self.ALLOWED_DTYPES:
            raise ValueError(
                f"Invalid torch_dtype '{torch_dtype}'. Must be one of {sorted(self.ALLOWED_DTYPES)}."
            )

        if isinstance(max_new_tokens, bool) or not isinstance(max_new_tokens, int) or max_new_tokens <= 0:
            raise ValueError("max_new_tokens must be an integer greater than 0.")

        if isinstance(temperature, bool) or not isinstance(temperature, (int, float)) or temperature < 0:
            raise ValueError("temperature must be a non-negative number.")

        if isinstance(top_p, bool) or not isinstance(top_p, (int, float)) or not (0.0 <= top_p <= 1.0):
            raise ValueError("top_p must be a number between 0.0 and 1.0.")

        if isinstance(repetition_penalty, bool) or not isinstance(repetition_penalty, (int, float)) or repetition_penalty <= 0:
            raise ValueError("repetition_penalty must be a positive number.")

        self.model_name_or_path = model_name_or_path.strip()
        self.enabled = enabled
        self.local_files_only = local_files_only
        self.device = device
        self.torch_dtype = torch_dtype
        self.max_new_tokens = max_new_tokens
        self.do_sample = do_sample
        self.temperature = float(temperature)
        self.top_p = float(top_p)
        self.repetition_penalty = float(repetition_penalty)
        self.trust_remote_code = trust_remote_code

        self._tokenizer: Any = None
        self._model: Any = None
        self._is_loaded: bool = False
        self._load_error: Optional[Exception] = None
        self._last_prompt: Optional[str] = None
        self._resolved_device: Optional[str] = None
        self._resolved_dtype_str: Optional[str] = None

        self._load_lock = threading.RLock()
        self._generate_lock = threading.RLock()

    @property
    def is_loaded(self) -> bool:
        """Return True if model and tokenizer are loaded."""
        return self._is_loaded

    @property
    def last_prompt(self) -> Optional[str]:
        """Return last prompt passed to generate()."""
        return self._last_prompt

    @property
    def resolved_device(self) -> Optional[str]:
        """Return the resolved hardware device string."""
        return self._resolved_device

    @property
    def resolved_dtype(self) -> Optional[str]:
        """Return the resolved torch dtype string."""
        return self._resolved_dtype_str

    @property
    def load_error(self) -> Optional[Exception]:
        """Return previous load error if any."""
        return self._load_error

    def is_available(self) -> bool:
        """Check availability without loading full model weights into RAM."""
        if not self.enabled:
            return False
        if self._load_error is not None:
            return False
        if self._is_loaded:
            return True

        torch_ok = sys.modules.get("torch") is not None or importlib.util.find_spec("torch") is not None
        if not torch_ok:
            return False

        tf_ok = sys.modules.get("transformers") is not None or importlib.util.find_spec("transformers") is not None
        if not tf_ok:
            return False

        if self.model_name_or_path.startswith(("/", ".")) or os.path.isabs(self.model_name_or_path):
            if not os.path.exists(self.model_name_or_path):
                return False

        return True

    def _resolve_device(self, torch_mod: Any) -> str:
        """Resolve requested device string into concrete device with safety checks."""
        requested = self.device.lower()
        if requested == "auto":
            try:
                if hasattr(torch_mod, "cuda") and torch_mod.cuda.is_available():
                    if getattr(torch_mod.cuda, "device_count", lambda: 0)() > 0:
                        _ = torch_mod.cuda.current_device()
                        return "cuda"
            except Exception:
                pass
            try:
                if hasattr(torch_mod, "backends") and hasattr(torch_mod.backends, "mps") and torch_mod.backends.mps.is_available():
                    return "mps"
            except Exception:
                pass
            return "cpu"
        elif requested == "cuda":
            try:
                if not (hasattr(torch_mod, "cuda") and torch_mod.cuda.is_available()):
                    raise LLMModelLoadError("CUDA device explicitly requested but CUDA is not available.")
                if getattr(torch_mod.cuda, "device_count", lambda: 0)() <= 0:
                    raise LLMModelLoadError("CUDA device explicitly requested but CUDA device count is 0.")
                _ = torch_mod.cuda.current_device()
            except LLMModelLoadError:
                raise
            except Exception as exc:
                raise LLMModelLoadError(f"CUDA accelerator check failed: {exc}") from exc
            return "cuda"
        elif requested == "mps":
            try:
                if not (hasattr(torch_mod, "backends") and hasattr(torch_mod.backends, "mps") and torch_mod.backends.mps.is_available()):
                    raise LLMModelLoadError("MPS device explicitly requested but MPS is not available.")
            except LLMModelLoadError:
                raise
            except Exception as exc:
                raise LLMModelLoadError(f"MPS accelerator check failed: {exc}") from exc
            return "mps"
        elif requested == "cpu":
            return "cpu"
        else:
            raise LLMModelLoadError(f"Unsupported device '{self.device}'.")

    def _resolve_dtype(self, torch_mod: Any, resolved_device: str) -> Any:
        """Resolve requested dtype string into torch dtype object."""
        if self.torch_dtype == "float32":
            return torch_mod.float32
        elif self.torch_dtype == "float16":
            return torch_mod.float16
        elif self.torch_dtype == "bfloat16":
            return torch_mod.bfloat16
        elif self.torch_dtype == "auto":
            if resolved_device == "cuda":
                if hasattr(torch_mod.cuda, "is_bf16_supported") and torch_mod.cuda.is_bf16_supported():
                    return torch_mod.bfloat16
                return torch_mod.float16
            elif resolved_device == "mps":
                return torch_mod.float16
            else:
                return torch_mod.float32
        else:
            raise LLMModelLoadError(f"Unsupported torch_dtype '{self.torch_dtype}'.")

    def load(self) -> None:
        """Explicitly load tokenizer and model into memory."""
        if not self.enabled:
            raise LLMClientDisabledError("LLM client is disabled.")

        if self._is_loaded:
            return

        with self._load_lock:
            if self._is_loaded:
                return

            if self._load_error is not None:
                raise self._load_error

            try:
                torch_ok = sys.modules.get("torch") is not None or importlib.util.find_spec("torch") is not None
                if not torch_ok:
                    raise LLMDependencyError("Required LLM dependency 'torch' is missing.")

                tf_ok = sys.modules.get("transformers") is not None or importlib.util.find_spec("transformers") is not None
                if not tf_ok:
                    raise LLMDependencyError("Required LLM dependency 'transformers' is missing.")

                try:
                    import torch
                    from transformers import AutoModelForCausalLM, AutoTokenizer
                except (ImportError, ModuleNotFoundError) as imp_err:
                    raise LLMDependencyError(
                        f"Required LLM dependency import failed: {imp_err}"
                    ) from imp_err

                resolved_dev = self._resolve_device(torch)
                dtype_obj = self._resolve_dtype(torch, resolved_dev)

                tokenizer = AutoTokenizer.from_pretrained(
                    self.model_name_or_path,
                    local_files_only=self.local_files_only,
                    trust_remote_code=self.trust_remote_code,
                )

                model = AutoModelForCausalLM.from_pretrained(
                    self.model_name_or_path,
                    torch_dtype=dtype_obj,
                    local_files_only=self.local_files_only,
                    trust_remote_code=self.trust_remote_code,
                )

                if hasattr(model, "to"):
                    try:
                        model = model.to(resolved_dev)
                    except Exception as dev_err:
                        if self.device == "auto" and resolved_dev != "cpu":
                            import warnings
                            warnings.warn(
                                f"Failed to initialize model on device '{resolved_dev}': {dev_err}. Falling back to 'cpu'.",
                                RuntimeWarning,
                            )
                            try:
                                model = model.to("cpu")
                                resolved_dev = "cpu"
                            except Exception as cpu_err:
                                raise LLMModelLoadError(
                                    f"Failed to move model to CPU fallback: {cpu_err}"
                                ) from cpu_err
                        else:
                            raise LLMModelLoadError(
                                f"Failed to move model to device '{resolved_dev}': {dev_err}"
                            ) from dev_err

                if hasattr(model, "eval"):
                    model.eval()

                self._tokenizer = tokenizer
                self._model = model
                self._resolved_device = resolved_dev
                self._resolved_dtype_str = str(dtype_obj).replace("torch.", "")
                self._is_loaded = True

            except (LLMClientDisabledError, LLMDependencyError, LLMModelLoadError) as known_err:
                self._tokenizer = None
                self._model = None
                self._is_loaded = False
                self._load_error = known_err
                raise
            except Exception as exc:
                self._tokenizer = None
                self._model = None
                self._is_loaded = False
                wrapped_err = LLMModelLoadError(
                    f"Failed to load model '{self.model_name_or_path}': {type(exc).__name__}"
                )
                self._load_error = wrapped_err
                raise wrapped_err from exc

    def generate(self, prompt: str) -> str:
        """Generate response string from prompt using local model."""
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError("prompt must be a non-empty string.")

        if not self.enabled:
            raise LLMClientDisabledError("LLM client is disabled.")

        self._last_prompt = prompt

        if not self._is_loaded:
            self.load()

        with self._generate_lock:
            try:
                tokenizer = self._tokenizer
                model = self._model

                messages = [{"role": "user", "content": prompt}]
                formatted_prompt = prompt
                if hasattr(tokenizer, "chat_template") and tokenizer.chat_template is not None:
                    try:
                        formatted_prompt = tokenizer.apply_chat_template(
                            messages, tokenize=False, add_generation_prompt=True
                        )
                    except Exception:
                        formatted_prompt = prompt

                inputs = tokenizer(formatted_prompt, return_tensors="pt")
                if hasattr(inputs, "to"):
                    inputs = inputs.to(self._resolved_device)
                elif isinstance(inputs, dict):
                    inputs = {
                        k: (v.to(self._resolved_device) if hasattr(v, "to") else v)
                        for k, v in inputs.items()
                    }

                gen_kwargs: Dict[str, Any] = {
                    "max_new_tokens": self.max_new_tokens,
                    "do_sample": self.do_sample,
                    "repetition_penalty": self.repetition_penalty,
                }
                if self.do_sample:
                    gen_kwargs["temperature"] = self.temperature
                    gen_kwargs["top_p"] = self.top_p

                pad_token_id = getattr(tokenizer, "pad_token_id", None)
                eos_token_id = getattr(tokenizer, "eos_token_id", None)
                if pad_token_id is None and eos_token_id is not None:
                    gen_kwargs["pad_token_id"] = eos_token_id
                elif pad_token_id is not None:
                    gen_kwargs["pad_token_id"] = pad_token_id

                if eos_token_id is not None:
                    gen_kwargs["eos_token_id"] = eos_token_id

                try:
                    # Generation is inference-only. Disabling autograd avoids
                    # graph bookkeeping and reduces CPU memory pressure across
                    # repeated section calls.
                    torch_mod = sys.modules.get("torch")
                    inference_context = torch_mod.inference_mode() if torch_mod is not None else nullcontext()
                    with inference_context:
                        outputs = model.generate(**inputs, **gen_kwargs)
                except Exception as gen_err:
                    raise LLMGenerationError(
                        f"Error during model generation: {type(gen_err).__name__}"
                    ) from gen_err

                try:
                    input_length = (
                        inputs["input_ids"].shape[1]
                        if isinstance(inputs, dict) and "input_ids" in inputs
                        else getattr(inputs, "input_ids", None).shape[1]
                    )
                    generated_tokens = outputs[0][input_length:]
                    decoded_text = tokenizer.decode(generated_tokens, skip_special_tokens=True)
                except Exception as dec_err:
                    raise LLMGenerationError(
                        f"Error decoding generated output: {type(dec_err).__name__}"
                    ) from dec_err

                return decoded_text.strip()

            except (LLMClientDisabledError, LLMGenerationError):
                raise
            except Exception as exc:
                raise LLMGenerationError(
                    f"Unexpected generation error: {type(exc).__name__}"
                ) from exc

    def cleanup(self) -> None:
        """Release loaded model and tokenizer resources."""
        with self._load_lock:
            self._model = None
            self._tokenizer = None
            self._is_loaded = False
            self._resolved_device = None
            self._resolved_dtype_str = None

            gc.collect()

            torch_mod = sys.modules.get("torch")
            if torch_mod is not None and hasattr(torch_mod, "cuda"):
                try:
                    if torch_mod.cuda.is_available():
                        torch_mod.cuda.empty_cache()
                except Exception:
                    pass
